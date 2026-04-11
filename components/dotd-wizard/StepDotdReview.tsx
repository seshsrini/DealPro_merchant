import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Eye, Loader2, CheckCircle2, Upload, Zap, AlertTriangle, TrendingUp, Film, ChevronLeft, ChevronRight } from 'lucide-react';
import { floatIn } from '../campaign-wizard/floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { dealOfDayService } from '../../services/dealOfDayService';
import { campaignOptimizerService, OptimizationResult } from '../../services/campaignOptimizerService';
import { perfTimer } from '../../services/perfLogger';
import { useTranslation } from '../../contexts/LanguageContext';

interface MerchantStore {
  id?: string;
  store_name: string;
  address: string;
  city: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

interface DotdWizardState {
  dealHeading: string;
  offerValue: string;
  description: string;
  dealDate: string;
  selectedStoreId: string;
  selectedImageFile: File | null;
  existingThumbnail: string | null;
  existingImageName: string | null;
  additionalImageFiles: File[];
  additionalImageUrls: string[];
  selectedVideoFile: File | null;
  existingVideoUrl: string | null;
  imagePriceOverlays?: Record<number, { discountPct: string; offerPrice: string }>;
}

interface StepDotdReviewProps {
  wizardState: DotdWizardState;
  user: any;
  stores: MerchantStore[];
  onBack: () => void;
  onPublishSuccess: () => void;
  onPublishError: (error: string) => void;
  onModerationBlock: (field: string, message: string) => void;
  theme: 'light' | 'dark';
}

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const StepDotdReview: React.FC<StepDotdReviewProps> = ({
  wizardState, user, stores,
  onBack, onPublishSuccess, onPublishError, onModerationBlock, theme,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<{ step: number; label: string } | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Scroll-snap carousel: sync dot indicator with scroll position
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

  // Run optimizer on mount
  useEffect(() => {
    const run = async () => {
      setOptimizing(true);
      try {
        const discountMatch = wizardState.offerValue.match(/(\d+)/);
        const result = await campaignOptimizerService.optimize(user.id, {
          title: wizardState.dealHeading,
          discount: discountMatch ? parseInt(discountMatch[1]) : undefined,
          launch_date: wizardState.dealDate,
          end_date: wizardState.dealDate, // Same day
          category: user.category,
          campaign_type: 'dotd',
        });
        setOptimization(result);
      } catch {
        // Non-blocking
      } finally {
        setOptimizing(false);
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const store = stores.find(s => s.id === wizardState.selectedStoreId);

  const handlePublish = async () => {
    const timer = perfTimer('save_dotd_campaign', 'deal_of_day');
    setPublishing(true);
    try {
      // Phase 1: Content moderation + Image moderation
      setProgress({ step: 1, label: 'Checking content...' });
      timer.mark('moderation_start');
      const plainDesc = stripHtml(wizardState.description);

      const moderationPromises: Promise<{ flagged: boolean; reason: string }>[] = [
        addCampaignService.moderateContent(wizardState.dealHeading, wizardState.offerValue, plainDesc),
      ];
      const allNewFiles = [wizardState.selectedImageFile, ...wizardState.additionalImageFiles].filter(Boolean) as File[];
      for (const file of allNewFiles) {
        moderationPromises.push(addCampaignService.moderateImage(file));
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
        const upload = await dealOfDayService.uploadDealImage(user.id, wizardState.selectedImageFile);
        if (upload?.publicUrl) {
          finalImageUrl = upload.publicUrl;
          finalImageName = upload.imageName;
        }
      }

      if (!finalImageUrl || !finalImageName) {
        throw new Error('Image is required for Deal of the Day');
      }

      // Upload additional images
      const mediaUrls: string[] = [];
      for (const url of wizardState.additionalImageUrls) {
        mediaUrls.push(url);
      }
      for (const file of wizardState.additionalImageFiles) {
        try {
          const result = await dealOfDayService.uploadDealImage(user.id, file);
          mediaUrls.push(result.publicUrl);
        } catch {
          console.warn('[StepDotdReview] Failed to upload additional image, skipping');
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
          console.warn('[StepDotdReview] Video upload failed, continuing without video');
          finalVideoUrl = null;
        }
      }

      // Phase 3: Create DOTD campaign
      setProgress({ step: 3, label: 'Publishing Deal of the Day...' });
      timer.mark('campaign_create');

      const payload = {
        shop_name: user.store_name,
        deal_heading: wizardState.dealHeading,
        offer_value: wizardState.offerValue,
        category: user.category,
        start_date: wizardState.dealDate,
        end_date: wizardState.dealDate, // Same day for DOTD
        long_description: wizardState.description,
        store_id: wizardState.selectedStoreId,
        image_url: finalImageUrl,
        image_name: finalImageName,
        latlong: store ? `${store.latitude}, ${store.longitude}` : '0.0, 0.0',
        ...(mediaUrls.length > 0 ? { media_urls: mediaUrls } : {}),
        ...(finalVideoUrl ? { video_url: finalVideoUrl } : {}),
        ...(() => {
          if (!wizardState.imagePriceOverlays) return {};
          const cleaned: Record<string, { discountPct: string; offerPrice: string }> = {};
          for (const [idx, raw] of Object.entries(wizardState.imagePriceOverlays)) {
            const ov = raw as { discountPct: string; offerPrice: string };
            if (ov && (ov.discountPct || ov.offerPrice)) cleaned[idx] = ov;
          }
          return Object.keys(cleaned).length > 0 ? { image_price_overlays: cleaned } : {};
        })(),
      };

      const result = await dealOfDayService.createDealOfDay(user.id, payload);
      const campaignId = result?.campaign?.campaign_id;

      // Background translation (fire-and-forget)
      addCampaignService.translateCampaignData(
        wizardState.dealHeading, wizardState.offerValue,
        wizardState.description, user.store_name
      ).then(translations => {
        if (translations && campaignId) {
          addCampaignService.updateCampaign(campaignId, {
            localized_heading: translations.heading,
            localized_offer: translations.offer,
            localized_description: translations.description,
            localized_shop_name: translations.shop_name,
          });
        }
      }).catch(err => console.error('[DotdWizard] Background translation failed:', err));

      timer.end('publish_success');
      onPublishSuccess();
    } catch (err: any) {
      timer.end('error');
      if (err.isModerationBlock && err.moderationField) {
        onModerationBlock(err.moderationField, err.message || 'This field contains content that violates our guidelines.');
      } else {
        const msg = err?.message || '';
        if (msg.includes('session') || msg.includes('Session') || msg.includes('log in')) {
          onPublishError('Your session has expired. Please close and reopen the app.');
        } else {
          onPublishError(msg || 'Unable to publish. Please try again.');
        }
      }
    } finally {
      setPublishing(false);
      setProgress(null);
    }
  };

  const scoreColor = optimization
    ? optimization.score >= 80 ? 'text-emerald-500' : optimization.score >= 60 ? 'text-amber-500' : 'text-red-500'
    : '';

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
          <Eye className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('m_review_deal')}
        </h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {t('m_check_before_pub')}
        </p>
      </div>

      {/* Deal Card Preview with Media Carousel */}
      <div style={floatIn(150, visible)} className={`rounded-2xl overflow-hidden border mb-5 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        {totalMedia > 0 && (
          <div className="relative">
            {/* Horizontal scroll-snap carousel */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {allPreviews.map((item, i) => (
                <div key={i} className="w-full flex-shrink-0 snap-center relative">
                  {item.isVideo ? (
                    <video
                      src={item.url}
                      className="w-full h-44 object-cover bg-black"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <img src={item.url} alt={`Media ${i + 1}`} className="w-full h-44 object-cover" />
                  )}
                  {/* Video badge */}
                  {item.isVideo && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 flex items-center gap-1">
                      <Film className="w-3 h-3 text-white" />
                      <span className="text-[10px] font-semibold text-white">{t('m_video')}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Counter badge */}
            {totalMedia > 1 && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/60">
                <span className="text-[10px] font-semibold text-white">{carouselIndex + 1}/{totalMedia}</span>
              </div>
            )}

            {/* Arrow buttons */}
            {totalMedia > 1 && carouselIndex > 0 && (
              <button
                onClick={() => scrollToIndex(carouselIndex - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center active:scale-90 transition-transform"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>
            )}
            {totalMedia > 1 && carouselIndex < totalMedia - 1 && (
              <button
                onClick={() => scrollToIndex(carouselIndex + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center active:scale-90 transition-transform"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        )}

        {/* Dot indicators — BELOW the image */}
        {totalMedia > 1 && (
          <div className="flex items-center justify-center gap-2 py-2.5">
            {allPreviews.map((item, i) => (
              <button
                key={i}
                onClick={() => scrollToIndex(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === carouselIndex
                    ? `w-5 h-2 ${item.isVideo ? 'bg-indigo-500' : 'bg-yellow-500'}`
                    : `w-2 h-2 ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`
                }`}
              />
            ))}
          </div>
        )}

        <div className={`p-4 ${totalMedia > 1 ? 'pt-1' : ''}`}>
          <div className="flex items-start justify-between mb-2">
            <h3 className={`font-bold text-base flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {wizardState.dealHeading}
            </h3>
            <span className="ml-2 px-2.5 py-1 rounded-lg bg-yellow-500 text-white text-xs font-bold shrink-0">
              {wizardState.offerValue}
            </span>
          </div>
          <p className={`text-xs line-clamp-2 mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {stripHtml(wizardState.description)}
          </p>
          <div className={`flex items-center justify-between text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{store?.store_name || 'Store'}, {store?.city}</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-500" />
              {formatDate(wizardState.dealDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Campaign Optimizer */}
      <div style={floatIn(300, visible)} className={`rounded-2xl p-4 border mb-5 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-yellow-500" />
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('m_campaign_score')}
          </p>
        </div>
        {optimizing ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
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

      {/* Publishing Progress */}
      {progress && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="space-y-4">
              {[
                { step: 1, label: t('m_checking_content'), icon: CheckCircle2 },
                { step: 2, label: t('m_uploading_media'), icon: Upload },
                { step: 3, label: t('m_publishing_deal'), icon: Zap },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = progress.step === item.step;
                const isDone = progress.step > item.step;
                return (
                  <div key={item.step} className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    )}
                    <span className={`text-sm font-medium ${
                      isDone ? 'text-emerald-500' : isActive ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-600' : 'text-slate-300')
                    }`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Publish button */}
      <div style={floatIn(450, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          disabled={publishing}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          } disabled:opacity-40`}
        >
          {t('m_back')}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex-[2] h-14 rounded-xl bg-yellow-500 text-white text-base font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {publishing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Zap className="w-5 h-5" />
              {t('m_publish_dotd')}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
