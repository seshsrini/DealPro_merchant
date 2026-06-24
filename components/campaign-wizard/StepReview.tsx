import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Eye, Loader2, CheckCircle2, Upload, Rocket, AlertTriangle, TrendingUp, Film, ChevronLeft, ChevronRight, Edit2, Gift } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { campaignOptimizerService, OptimizationResult } from '../../services/campaignOptimizerService';
import { perfTimer } from '../../services/perfLogger';
import { useTranslation } from '../../contexts/LanguageContext';
import { ensureFreshToken, supabase, recoverSessionOrSilentReauth } from '../../services/supabaseClient';
import { biometricService } from '../../services/biometricService';
import { userService } from '../../services/userService';
import { generatePromoBanner, generateFreeGiftsImage, BannerPlacement } from './StepImage';
import { TRUST_BADGES } from './StepTrustBadges';
import { FreeGiftItem } from './StepBuyGetFree';
import { UploadVideoLoader } from '../UploadVideoLoader';

interface MerchantStore {
  id?: string;
  store_name: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

interface WizardState {
  dealHeading: string;
  offerValue: string;
  description: string;
  startDate: string;
  endDate: string;
  selectedStoreId: string;
  selectedImageFile: File | null;
  existingThumbnail: string | null;
  existingImageName: string | null;
  additionalImageFiles: File[];
  additionalImageUrls: string[];
  selectedVideoFile: File | null;
  existingVideoUrl: string | null;
  imagePriceOverlays?: Record<number, { discountPct: string; offerPrice: string }>;
  trustBadgeIds?: string[];
  skipBannerGeneration?: boolean;
  freeGifts?: FreeGiftItem[];
  originalImageFile?: File | null;
  bannerPlacement?: BannerPlacement;
}

interface StepReviewProps {
  wizardState: WizardState;
  user: any;
  stores: MerchantStore[];
  editingDealId: string | null;
  onBack: () => void;
  onPublishSuccess: () => void;
  onPublishError: (error: string) => void;
  onEditSection?: (stepIndex: number) => void;
  onUpdateMainImage?: (file: File) => void;
  onUpdateOriginalImage?: (file: File | null) => void;
  onUpdateAdditional?: (
    files: File[],
    urls: string[],
    overlays: Record<number, { discountPct: string; offerPrice: string }>,
  ) => void;
  theme: 'light' | 'dark';
  editStepMap?: Record<string, number>;
  isBuyGetFreeMode?: boolean;
}

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const StepReview: React.FC<StepReviewProps> = ({
  wizardState, user, stores, editingDealId,
  onPublishSuccess, onPublishError, onEditSection, onUpdateMainImage,
  onUpdateAdditional, theme,
  editStepMap, isBuyGetFreeMode,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publishingRef = useRef(false); // Ref guard to prevent double-submit
  const [generatingBanner, setGeneratingBanner] = useState(false);
  const [progress, setProgress] = useState<{ step: number; label: string } | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resolve edit step indices — use dynamic map if provided, fallback to default
  const EDIT_STEPS = useMemo(() => {
    if (editStepMap) return editStepMap;
    return { store: 0, image: 2, heading: 3, offer: 4, description: 5, badges: 6, startDate: 7, endDate: 8 };
  }, [editStepMap]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Build preview URLs with proper memoization and cleanup
  const allPreviews = useMemo(() => {
    const items: { url: string; isVideo: boolean; isObjectUrl: boolean }[] = [];

    if (wizardState.selectedImageFile) {
      items.push({ url: URL.createObjectURL(wizardState.selectedImageFile), isVideo: false, isObjectUrl: true });
    } else if (wizardState.existingThumbnail) {
      items.push({ url: wizardState.existingThumbnail, isVideo: false, isObjectUrl: false });
    }
    for (const url of wizardState.additionalImageUrls) {
      items.push({ url, isVideo: false, isObjectUrl: false });
    }
    for (const file of wizardState.additionalImageFiles) {
      items.push({ url: URL.createObjectURL(file), isVideo: false, isObjectUrl: true });
    }
    if (wizardState.selectedVideoFile) {
      items.push({ url: URL.createObjectURL(wizardState.selectedVideoFile), isVideo: true, isObjectUrl: true });
    } else if (wizardState.existingVideoUrl) {
      items.push({ url: wizardState.existingVideoUrl, isVideo: true, isObjectUrl: false });
    }
    return items;
  }, [
    wizardState.selectedImageFile, wizardState.existingThumbnail,
    wizardState.additionalImageUrls, wizardState.additionalImageFiles,
    wizardState.selectedVideoFile, wizardState.existingVideoUrl,
  ]);

  // Cleanup object URLs on change
  useEffect(() => {
    return () => {
      allPreviews.filter(p => p.isObjectUrl).forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [allPreviews]);

  const totalMedia = allPreviews.length;

  // Scroll-snap based carousel: sync dot indicator with scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || totalMedia <= 1) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setCarouselIndex(Math.min(idx, totalMedia - 1));
  }, [totalMedia]);

  const scrollToIndex = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
    setCarouselIndex(idx);
  }, []);

  // Auto-generate promo banner on mount (skip for Buy & Get Free mode).
  // Re-runs whenever the merchant changes bannerPlacement on the Layout step.
  const bakedForPlacementRef = useRef<BannerPlacement | null>(null);
  useEffect(() => {
    if (!onUpdateMainImage || wizardState.skipBannerGeneration) return;
    // Only a freshly-uploaded photo (originalImageFile) is a clean source we can
    // bake text onto. An existing/saved cover is already a finished banner with
    // text baked in — re-baking it would stack a SECOND layer of text (the
    // "double text" bug). So with no fresh upload we leave the existing cover as
    // is; the carousel falls back to wizardState.existingThumbnail.
    const original = wizardState.originalImageFile;
    if (!original) return;
    const desired: BannerPlacement = wizardState.bannerPlacement ?? 'auto';
    if (bakedForPlacementRef.current === desired) return;
    bakedForPlacementRef.current = desired;
    (async () => {
      setGeneratingBanner(true);
      try {
        const badgeLabels = (wizardState.trustBadgeIds || [])
          .map(id => TRUST_BADGES.find(b => b.id === id)?.label)
          .filter(Boolean) as string[];
        const banner = await generatePromoBanner(
          original,
          store?.store_name || user.store_name || 'Your Store',
          wizardState.dealHeading || 'Special Deal',
          wizardState.offerValue || 'Great Offer',
          badgeLabels,
          undefined,
          desired,
        );
        onUpdateMainImage(banner);
      } catch (err) {
        console.error('[StepReview] Auto banner generation failed:', err);
      } finally {
        setGeneratingBanner(false);
      }
    })();
  }, [wizardState.bannerPlacement]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate banners for tagged additional images (slots 1..N) — same treatment as cover,
  // but the offer section uses the per-image tag (discount % / offer price) instead of the deal-wide offer.
  const additionalBannersGeneratedRef = useRef(false);
  useEffect(() => {
    if (additionalBannersGeneratedRef.current || !onUpdateAdditional || wizardState.skipBannerGeneration) return;
    const overlays = wizardState.imagePriceOverlays || {};
    const taggedSlots = Object.keys(overlays)
      .map(Number)
      .filter(i => i >= 1 && (overlays[i]?.discountPct || overlays[i]?.offerPrice));
    if (taggedSlots.length === 0) return;
    additionalBannersGeneratedRef.current = true;
    (async () => {
      setGeneratingBanner(true);
      try {
        const badgeLabels = (wizardState.trustBadgeIds || [])
          .map(id => TRUST_BADGES.find(b => b.id === id)?.label)
          .filter(Boolean) as string[];

        const urls = wizardState.additionalImageUrls;
        const files = wizardState.additionalImageFiles;
        // Combined display order: URLs first (slots 1..urls.length), then Files
        const newUrls: string[] = [];
        const newFiles: File[] = [];
        const newOverlays: Record<number, { discountPct: string; offerPrice: string }> = { ...overlays };

        // URLs occupy combined slots 1..urls.length
        for (let i = 0; i < urls.length; i++) {
          const slot = i + 1;
          const ov = overlays[slot];
          const tagged = ov && (ov.discountPct || ov.offerPrice);
          if (tagged) {
            try {
              const res = await fetch(urls[i]);
              const blob = await res.blob();
              const srcFile = new File([blob], `existing-add-${slot}.jpg`, { type: blob.type || 'image/jpeg' });
              const banner = await generatePromoBanner(
                srcFile,
                store?.store_name || user.store_name || 'Your Store',
                wizardState.dealHeading || 'Special Deal',
                wizardState.offerValue || 'Great Offer',
                badgeLabels,
                { discountPct: ov.discountPct, offerPrice: ov.offerPrice },
              );
              newFiles.push(banner);
              delete newOverlays[slot];
            } catch (err) {
              console.warn('[StepReview] Failed to bake tagged URL image, keeping original:', err);
              newUrls.push(urls[i]);
            }
          } else {
            newUrls.push(urls[i]);
          }
        }

        // Files occupy combined slots (urls.length + 1) .. (urls.length + files.length)
        for (let j = 0; j < files.length; j++) {
          const slot = urls.length + j + 1;
          const ov = overlays[slot];
          const tagged = ov && (ov.discountPct || ov.offerPrice);
          if (tagged) {
            try {
              const banner = await generatePromoBanner(
                files[j],
                store?.store_name || user.store_name || 'Your Store',
                wizardState.dealHeading || 'Special Deal',
                wizardState.offerValue || 'Great Offer',
                badgeLabels,
                { discountPct: ov.discountPct, offerPrice: ov.offerPrice },
              );
              newFiles.push(banner);
              delete newOverlays[slot];
            } catch (err) {
              console.warn('[StepReview] Failed to bake tagged file image, keeping original:', err);
              newFiles.push(files[j]);
            }
          } else {
            newFiles.push(files[j]);
          }
        }

        onUpdateAdditional(newFiles, newUrls, newOverlays);
      } catch (err) {
        console.error('[StepReview] Additional banner generation failed:', err);
      } finally {
        setGeneratingBanner(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Run optimizer on mount
  useEffect(() => {
    const run = async () => {
      setOptimizing(true);
      try {
        const discountMatch = wizardState.offerValue.match(/(\d+)/);
        const result = await campaignOptimizerService.optimize(user.id, {
          title: wizardState.dealHeading,
          discount: discountMatch ? parseInt(discountMatch[1]) : undefined,
          launch_date: wizardState.startDate,
          end_date: wizardState.endDate,
          category: user.category,
        });
        setOptimization(result);
      } catch {
        // Non-blocking
      } finally {
        setOptimizing(false);
      }
    };
    run();
  }, []);

  const store = stores.find(s => s.id === wizardState.selectedStoreId);

  // Free gifts with valid data
  const validGifts = (wizardState.freeGifts || []).filter(g => (g.imageFile || g.imageUrl) && g.name.trim());

  const handlePublish = async () => {
    if (publishingRef.current) return; // Prevent double-submit
    publishingRef.current = true;
    const timer = perfTimer('save_campaign', 'add_deal');
    setPublishing(true);
    try {
      // Phase 0: Recover a working session before the multi-step publish.
      // Tries refreshSession() first; if the refresh token is also dead (e.g. user
      // backgrounded the app for hours), falls back to silent re-auth using the
      // cached merchant phone. This eliminates "session expired" at publish time
      // unless the cached phone itself is gone (truly logged out).
      const recovered = await recoverSessionOrSilentReauth({
        getSavedUser: () => biometricService.getSavedUser(),
        reAuth: (phone, cc) => userService.merchantOtpLogin(phone, cc),
      });
      if (!recovered) {
        // Last resort — try ensureFreshToken from cache, then proceed and let the
        // per-call invoke wrapper's 401 retry catch any straggler.
        try { await ensureFreshToken(); } catch {
          console.warn('[StepReview] All session recovery paths failed, proceeding anyway');
        }
      }

      // Phase 1: Content + Image moderation
      setProgress({ step: 1, label: 'Checking content...' });
      timer.mark('moderation_start');
      const plainDesc = stripHtml(wizardState.description);
      // Image profanity + copyright are now run at the StepImage "Continue" step
      // (upload-time gate). At publish we only re-run the TEXT moderation since the
      // heading/offer/description can be edited after leaving the image step.
      const moderationPromises: Promise<{ flagged: boolean; reason: string }>[] = [
        addCampaignService.moderateContent(wizardState.dealHeading, wizardState.offerValue, plainDesc),
      ];
      // Also moderate gift images
      for (const gift of validGifts) {
        if (gift.imageFile) {
          moderationPromises.push(addCampaignService.moderateImage(gift.imageFile));
        }
      }
      const results = await Promise.all(moderationPromises);
      for (const result of results) {
        if (result.flagged) throw new Error(result.reason);
      }

      // Phase 2: Upload all media
      setProgress({ step: 2, label: 'Uploading media...' });
      timer.mark('media_upload');

      // Upload primary image
      let finalImageUrl = wizardState.existingThumbnail;
      let finalImageName = wizardState.existingImageName;
      if (wizardState.selectedImageFile) {
        let upload: { publicUrl: string; imageName: string } | null = null;
        try {
          upload = await addCampaignService.uploadDealImage(user.id, wizardState.selectedImageFile);
        } catch {
          setProgress({ step: 2, label: 'Retrying image upload...' });
          try {
            upload = await addCampaignService.uploadDealImage(user.id, wizardState.selectedImageFile);
          } catch { /* will be caught by validation below */ }
        }
        if (upload?.publicUrl) {
          finalImageUrl = upload.publicUrl;
          finalImageName = upload.imageName;
        }
      }

      if (!finalImageUrl) {
        throw new Error('Image upload failed. Please go back and re-select your image, then try again.');
      }

      // Upload additional images
      const mediaUrls: string[] = [];
      // Include existing additional URLs
      for (const url of wizardState.additionalImageUrls) {
        mediaUrls.push(url);
      }
      // Upload new additional files
      for (const file of wizardState.additionalImageFiles) {
        try {
          const result = await addCampaignService.uploadDealImage(user.id, file);
          mediaUrls.push(result.publicUrl);
        } catch {
          console.warn('[StepReview] Failed to upload additional image, skipping');
        }
      }

      // Upload video if present
      let finalVideoUrl: string | null = wizardState.existingVideoUrl;
      if (wizardState.selectedVideoFile) {
        setProgress({ step: 2, label: 'Uploading video...' });
        try {
          const videoResult = await addCampaignService.uploadDealVideo(user.id, wizardState.selectedVideoFile);
          finalVideoUrl = videoResult.publicUrl;
        } catch {
          console.warn('[StepReview] Video upload failed, continuing without video');
          finalVideoUrl = null;
        }
      }

      // Upload free gift images
      const freeGiftsPayload: { image_url: string; name: string }[] = [];
      if (validGifts.length > 0) {
        setProgress({ step: 2, label: 'Uploading gift images...' });
        for (const gift of validGifts) {
          let giftImageUrl = gift.imageUrl;
          if (gift.imageFile) {
            try {
              const giftUpload = await addCampaignService.uploadDealImage(user.id, gift.imageFile);
              giftImageUrl = giftUpload.publicUrl;
            } catch {
              console.warn('[StepReview] Failed to upload gift image, using existing URL');
            }
          }
          if (giftImageUrl) {
            freeGiftsPayload.push({ image_url: giftImageUrl, name: gift.name.trim() });
          }
        }

        // Auto-generate "Free Gifts" showcase image and add to media
        try {
          setProgress({ step: 2, label: 'Creating gifts showcase...' });
          const giftsWithUrls = freeGiftsPayload.map(g => ({ imageUrl: g.image_url, name: g.name }));
          const giftsImage = await generateFreeGiftsImage(giftsWithUrls, store?.store_name || user.store_name || 'Store');
          const giftsUpload = await addCampaignService.uploadDealImage(user.id, giftsImage);
          mediaUrls.push(giftsUpload.publicUrl);
        } catch (err) {
          console.warn('[StepReview] Failed to generate gifts showcase image:', err);
        }
      }

      // Phase 3: Create/Update campaign
      setProgress({ step: 3, label: editingDealId ? 'Updating deal...' : 'Publishing deal...' });
      timer.mark('campaign_create');
      const payload: Record<string, any> = {
        merchant_id: user.id,
        shop_name: store?.store_name || user.store_name,
        deal_heading: wizardState.dealHeading,
        offer_value: wizardState.offerValue,
        category: user.category,
        long_description: wizardState.description,
        start_date: wizardState.startDate,
        end_date: wizardState.endDate,
        store_id: wizardState.selectedStoreId,
        image_url: finalImageUrl,
        image_name: finalImageName,
        latlong: store ? `${store.latitude}, ${store.longitude}` : '0.0, 0.0',
        is_deal_of_the_day: false,
        trust_badges: wizardState.trustBadgeIds || [],
      };

      if (mediaUrls.length > 0) payload.media_urls = mediaUrls;
      if (finalVideoUrl) payload.video_url = finalVideoUrl;
      if (freeGiftsPayload.length > 0) payload.free_gifts = freeGiftsPayload;

      // Image price overlays — only include non-empty overlays
      if (wizardState.imagePriceOverlays) {
        const cleanedOverlays: Record<string, { discountPct: string; offerPrice: string }> = {};
        for (const [idx, overlay] of Object.entries(wizardState.imagePriceOverlays)) {
          const ov = overlay as { discountPct: string; offerPrice: string };
          if (ov && (ov.discountPct || ov.offerPrice)) {
            cleanedOverlays[idx] = ov;
          }
        }
        if (Object.keys(cleanedOverlays).length > 0) {
          payload.image_price_overlays = cleanedOverlays;
        }
      }

      let campaignId: string;
      if (editingDealId) {
        await addCampaignService.updateCampaign(editingDealId, payload);
        campaignId = editingDealId;
      } else {
        const result = await addCampaignService.createCampaign(payload);
        campaignId = result?.campaign?.campaign_id;
      }

      // Background translation (fire-and-forget)
      addCampaignService.translateCampaignData(
        wizardState.dealHeading, wizardState.offerValue,
        wizardState.description, store?.store_name || user.store_name
      ).then(translations => {
        if (translations && campaignId) {
          addCampaignService.updateCampaign(campaignId, {
            localized_heading: translations.heading,
            localized_offer: translations.offer,
            localized_description: translations.description,
            localized_shop_name: translations.shop_name,
          });
        }
      }).catch(err => console.error('[CampaignWizard] Background translation failed:', err));

      timer.end('publish_success');
      onPublishSuccess();
    } catch (err: any) {
      timer.end('error');
      const msg = err?.message || '';
      if (msg.includes('session') || msg.includes('Session') || msg.includes('log in')) {
        onPublishError('Your session has expired. Please close and reopen the app.');
      } else {
        onPublishError(msg || 'Unable to publish. Please try again.');
      }
    } finally {
      setPublishing(false);
      publishingRef.current = false;
      setProgress(null);
    }
  };

  const scoreColor = optimization
    ? optimization.score >= 80 ? 'text-emerald-500' : optimization.score >= 60 ? 'text-amber-500' : 'text-red-500'
    : '';

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
          <Eye className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('m_review_campaign')}
        </h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {t('m_check_before_pub')}
        </p>
      </div>

      {/* Consumer-style Deal Card Preview */}
      <div style={floatIn(150, visible)}>
        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Consumer Preview
        </p>
        <div className={`rounded-none overflow-hidden ${isDark ? 'bg-slate-900/50' : 'bg-white'}`}>
          {/* Image — square aspect like consumer feed */}
          {totalMedia > 0 && (
            <div className="relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {allPreviews.map((item, i) => (
                  <div key={i} className="w-full flex-shrink-0 snap-center relative">
                    {item.isVideo ? (
                      <video src={item.url} className="w-full aspect-square object-cover bg-black" controls muted playsInline />
                    ) : (
                      <img src={item.url} alt={`Media ${i + 1}`} className="w-full aspect-square object-cover" />
                    )}
                    {item.isVideo && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 flex items-center gap-1">
                        <Film className="w-3 h-3 text-white" />
                        <span className="text-[10px] font-semibold text-white">{t('m_video')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {totalMedia > 1 && (
                <>
                  {carouselIndex > 0 && (
                    <button onClick={() => scrollToIndex(carouselIndex - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"><ChevronLeft className="w-4 h-4 text-white" /></button>
                  )}
                  {carouselIndex < totalMedia - 1 && (
                    <button onClick={() => scrollToIndex(carouselIndex + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"><ChevronRight className="w-4 h-4 text-white" /></button>
                  )}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allPreviews.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all ${i === carouselIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Text content — matches consumer deal card exactly */}
          <div className="p-3">
            <p className={`text-xs font-normal mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {store?.store_name || user.store_name}
            </p>
            <h3 className={`text-sm font-normal line-clamp-2 mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {wizardState.dealHeading || 'Deal Heading'}
            </h3>
            <p className="text-sm font-semibold text-yellow-500 mb-1">
              {wizardState.offerValue || 'Offer Value'}
            </p>
            <div className={`flex items-center gap-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className="text-xs font-normal">
                Valid till {formatDate(wizardState.endDate) || '—'}
              </span>
            </div>
          </div>

          {/* Free Gifts Preview */}
          {validGifts.length > 0 && (
            <div className={`px-3 pb-3 pt-1 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Gift className="w-3.5 h-3.5 text-pink-500" />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>
                  Free Gifts Included
                </span>
              </div>
              <div className="flex gap-3 overflow-x-auto">
                {validGifts.map((gift, i) => (
                  <div key={i} className="flex flex-col items-center shrink-0" style={{ width: 72 }}>
                    <div className={`w-16 h-16 rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {gift.imageUrl && (
                        <img src={gift.imageUrl} alt={gift.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <p className={`text-[10px] font-medium text-center mt-1 leading-tight line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {gift.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div className="mb-5" />

      {/* Editable Section Summary */}
      {onEditSection && (
        <div style={floatIn(225, visible)} className={`rounded-2xl border mb-5 divide-y ${isDark ? 'border-slate-700 bg-slate-800/50 divide-slate-700' : 'border-slate-200 bg-slate-50 divide-slate-200'}`}>
          {/* Store */}
          <button onClick={() => onEditSection(EDIT_STEPS.store)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Store</p>
              <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{store?.store_name || 'Not selected'}{store?.city ? `, ${store.city}` : ''}</p>
            </div>
            <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </button>

          {/* Image */}
          <button onClick={() => onEditSection(EDIT_STEPS.image)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Media</p>
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalMedia} {totalMedia === 1 ? 'photo' : 'photos/videos'}</p>
            </div>
            <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </button>

          {/* Free Gifts (Buy & Get Free mode only) */}
          {isBuyGetFreeMode && EDIT_STEPS.freeGifts !== undefined && (
            <button onClick={() => onEditSection(EDIT_STEPS.freeGifts)} className="w-full flex items-center justify-between px-4 py-3 text-left">
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Free Gifts</p>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {validGifts.length} {validGifts.length === 1 ? 'gift' : 'gifts'}
                </p>
              </div>
              <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>
          )}

          {/* Heading */}
          <button onClick={() => onEditSection(EDIT_STEPS.heading)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Heading</p>
              <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{wizardState.dealHeading || 'Not set'}</p>
            </div>
            <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </button>

          {/* Offer */}
          <button onClick={() => onEditSection(EDIT_STEPS.offer)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Offer</p>
              <p className={`text-sm font-medium truncate text-emerald-500`}>{wizardState.offerValue || 'Not set'}</p>
            </div>
            <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </button>

          {/* Description */}
          <button onClick={() => onEditSection(EDIT_STEPS.description)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Description</p>
              <p className={`text-xs line-clamp-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{stripHtml(wizardState.description) || 'Not set'}</p>
            </div>
            <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </button>

          {/* Dates */}
          <div className="flex">
            <button onClick={() => onEditSection(EDIT_STEPS.startDate)} className="flex-1 flex items-center justify-between px-4 py-3 text-left">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Start</p>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatDate(wizardState.startDate) || 'Not set'}</p>
              </div>
              <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>
            <div className={`w-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <button onClick={() => onEditSection(EDIT_STEPS.endDate)} className="flex-1 flex items-center justify-between px-4 py-3 text-left">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>End</p>
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatDate(wizardState.endDate) || 'Not set'}</p>
              </div>
              <Edit2 className={`w-3.5 h-3.5 shrink-0 ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>
          </div>
        </div>
      )}

      {/* Campaign Optimizer */}
      <div style={floatIn(300, visible)} className={`rounded-2xl p-4 border mb-5 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('m_campaign_score')}
          </p>
        </div>
        {optimizing ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_analyzing')}</span>
          </div>
        ) : optimization ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-3xl font-black ${scoreColor}`}>{optimization.score}</span>
              <div>
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{optimization.grade}</span>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {t('m_predicted')} {optimization.predictedEngagement} {t('m_engagement')}
                </p>
              </div>
            </div>
            {optimization.quickFixes.length > 0 && (
              <div className="space-y-1.5">
                {optimization.quickFixes.slice(0, 3).map((fix, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fix}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('m_score_unavailable')}</p>
        )}
      </div>

      {/* Publishing Progress — video distraction with progress bar. */}
      {progress && (
        <UploadVideoLoader
          step={progress.step}
          totalSteps={3}
          label={progress.label}
          theme={theme}
        />
      )}

      {/* Publish button — no Back here by design: the merchant edits any section
          via its pencil (which returns to this Review screen) and closes with the
          top X. A Back button would walk them out of Review unexpectedly. */}
      <div style={floatIn(450, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex-1 h-14 rounded-xl bg-emerald-600 text-white text-base font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {publishing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              {editingDealId ? t('m_update_campaign') : t('m_publish_campaign')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
