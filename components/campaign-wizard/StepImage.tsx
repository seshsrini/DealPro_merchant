import React, { useRef, useEffect, useState } from 'react';
import { ImageIcon, Upload, Check, X, Loader2, Film, Plus, GripVertical, Tag, Percent } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { useTranslation } from '../../contexts/LanguageContext';

const MAX_IMAGES = 5;
const MAX_VIDEO_SIZE_MB = 50;
const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm';

export interface ImagePriceOverlay {
  discountPct: string;   // e.g. "30"
  offerPrice: string;    // e.g. "699"
}

interface MediaItem {
  type: 'file' | 'url';
  file?: File;
  url?: string;
  preview: string;
}

interface StepImageProps {
  selectedFile: File | null;
  existingThumbnail: string | null;
  additionalImageFiles: File[];
  additionalImageUrls: string[];
  selectedVideoFile: File | null;
  existingVideoUrl: string | null;
  imageLibrary: { url: string; name?: string }[];
  isLibraryLoading: boolean;
  imagePriceOverlays?: Record<number, ImagePriceOverlay>;
  onFileSelected: (file: File | null) => void;
  onExistingSelected: (url: string, name: string | null) => void;
  onAdditionalImagesChange: (files: File[], urls: string[]) => void;
  onVideoChange: (file: File | null, url: string | null) => void;
  onPriceOverlayChange?: (overlays: Record<number, ImagePriceOverlay>) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepImage: React.FC<StepImageProps> = ({
  selectedFile, existingThumbnail, additionalImageFiles, additionalImageUrls,
  selectedVideoFile, existingVideoUrl, imageLibrary, isLibraryLoading,
  imagePriceOverlays, onFileSelected, onExistingSelected, onAdditionalImagesChange,
  onVideoChange, onPriceOverlayChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [editingOverlayIdx, setEditingOverlayIdx] = useState<number | null>(null);
  const overlays = imagePriceOverlays || {};
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Build the combined images list for display
  const allImages: MediaItem[] = [];

  // Primary image (slot 0)
  if (selectedFile) {
    allImages.push({ type: 'file', file: selectedFile, preview: URL.createObjectURL(selectedFile) });
  } else if (existingThumbnail) {
    allImages.push({ type: 'url', url: existingThumbnail, preview: existingThumbnail });
  }

  // Additional images
  for (const url of additionalImageUrls) {
    allImages.push({ type: 'url', url, preview: url });
  }
  for (const file of additionalImageFiles) {
    allImages.push({ type: 'file', file, preview: URL.createObjectURL(file) });
  }

  const totalImages = allImages.length;
  const canAddMore = totalImages < MAX_IMAGES;
  const hasImage = totalImages > 0;

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      allImages.forEach(item => {
        if (item.type === 'file' && item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [selectedFile, additionalImageFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setModerationError(null);

    if (!hasImage) {
      // First image goes to primary slot
      onFileSelected(files[0]);
      if (files.length > 1) {
        const remaining = files.slice(1, MAX_IMAGES);
        onAdditionalImagesChange([...additionalImageFiles, ...remaining], additionalImageUrls);
      }
    } else {
      // Add to additional images
      const slotsAvailable = MAX_IMAGES - totalImages;
      const toAdd = files.slice(0, slotsAvailable);
      if (toAdd.length > 0) {
        onAdditionalImagesChange([...additionalImageFiles, ...toAdd], additionalImageUrls);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setVideoError(null);
    if (!file) return;

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setVideoError(`Video must be under ${MAX_VIDEO_SIZE_MB}MB`);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }
    onVideoChange(file, null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    if (index === 0) {
      // Removing primary image
      onFileSelected(null);
      onExistingSelected('', null);
      // Promote first additional to primary if available
      if (additionalImageUrls.length > 0) {
        const [promoUrl, ...restUrls] = additionalImageUrls;
        onExistingSelected(promoUrl, null);
        onAdditionalImagesChange(additionalImageFiles, restUrls);
      } else if (additionalImageFiles.length > 0) {
        const [promoFile, ...restFiles] = additionalImageFiles;
        onFileSelected(promoFile);
        onAdditionalImagesChange(restFiles, additionalImageUrls);
      }
    } else {
      // Removing an additional image
      const additionalIndex = index - (selectedFile || existingThumbnail ? 1 : 0);
      const urlCount = additionalImageUrls.length;

      if (additionalIndex < urlCount) {
        const newUrls = [...additionalImageUrls];
        newUrls.splice(additionalIndex, 1);
        onAdditionalImagesChange(additionalImageFiles, newUrls);
      } else {
        const fileIndex = additionalIndex - urlCount;
        const newFiles = [...additionalImageFiles];
        newFiles.splice(fileIndex, 1);
        onAdditionalImagesChange(newFiles, additionalImageUrls);
      }
    }
  };

  const removeVideo = () => {
    onVideoChange(null, null);
    setVideoError(null);
  };

  const handleLibrarySelect = (url: string, name?: string) => {
    setModerationError(null);
    if (!hasImage) {
      onFileSelected(null);
      onExistingSelected(url, name || null);
    } else if (canAddMore) {
      onAdditionalImagesChange(additionalImageFiles, [...additionalImageUrls, url]);
    }
    setShowLibrary(false);
  };

  const handleContinue = async () => {
    // Moderate all new image files
    const filesToCheck = [selectedFile, ...additionalImageFiles].filter(Boolean) as File[];
    if (filesToCheck.length > 0) {
      setChecking(true);
      setModerationError(null);
      try {
        for (const file of filesToCheck) {
          const result = await addCampaignService.moderateImage(file);
          if (result.flagged) {
            setModerationError(result.reason || t('m_img_inappropriate'));
            setChecking(false);
            return;
          }
        }
      } catch {
        setModerationError(t('m_img_verify_fail'));
        setChecking(false);
        return;
      } finally {
        setChecking(false);
      }
    }
    onNext();
  };

  const hasVideo = !!selectedVideoFile || !!existingVideoUrl;
  const videoPreviewUrl = selectedVideoFile ? URL.createObjectURL(selectedVideoFile) : existingVideoUrl;

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
        <ImageIcon className="w-8 h-8 text-blue-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_add_media')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_upload_hint')}
      </p>

      {/* ── Image Grid ── */}
      <div style={floatIn(250, visible)} className="mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('m_images')} ({totalImages}/{MAX_IMAGES})
          </p>
          {imageLibrary.length > 0 && (
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className={`text-xs font-semibold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}
            >
              {showLibrary ? t('m_hide_library') : t('m_your_images')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Existing images */}
          {allImages.map((img, i) => {
            const overlay = overlays[i];
            const hasOverlay = overlay && (overlay.discountPct || overlay.offerPrice);
            const mrp = overlay?.offerPrice ? Math.round(parseFloat(overlay.offerPrice) * 1.3) : null;
            return (
              <div
                key={`img-${i}`}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  i === 0
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                {/* Price overlay on image */}
                {hasOverlay && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-4 pb-1.5 px-2">
                    {overlay.discountPct && (
                      <span className="inline-block bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded mb-0.5">
                        {overlay.discountPct}% OFF
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {overlay.offerPrice && (
                        <span className="text-white text-[10px] font-bold">₹{overlay.offerPrice}</span>
                      )}
                      {mrp && (
                        <span className="text-white/50 text-[8px] line-through">₹{mrp}</span>
                      )}
                    </div>
                  </div>
                )}
                {i === 0 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-blue-500 text-[9px] font-bold text-white uppercase tracking-wide">
                    {t('m_cover')}
                  </div>
                )}
                {/* Tag button to add/edit price overlay */}
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingOverlayIdx(editingOverlayIdx === i ? null : i); }}
                  className={`absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    hasOverlay ? 'bg-emerald-500' : 'bg-black/40 hover:bg-black/60'
                  }`}
                >
                  <Tag className="w-3 h-3 text-white" />
                </button>
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            );
          })}

          {/* Add more button */}
          {canAddMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                isDark
                  ? 'border-slate-700 hover:border-slate-500 text-slate-400'
                  : 'border-slate-300 hover:border-slate-400 text-slate-400'
              }`}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{t('m_add')}</span>
            </button>
          )}
        </div>

        {/* Price overlay editor — shown when tag button tapped */}
        {editingOverlayIdx !== null && editingOverlayIdx < totalImages && (
          <div className={`mt-3 p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2.5">
              <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Price tag — Image {editingOverlayIdx + 1}
              </p>
              <div className="flex items-center gap-2">
                {overlays[editingOverlayIdx]?.discountPct || overlays[editingOverlayIdx]?.offerPrice ? (
                  <button
                    onClick={() => {
                      const updated = { ...overlays };
                      delete updated[editingOverlayIdx!];
                      onPriceOverlayChange?.(updated);
                    }}
                    className="text-[10px] font-medium text-red-400"
                  >
                    Clear
                  </button>
                ) : null}
                <button onClick={() => setEditingOverlayIdx(null)}>
                  <X className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={`text-[10px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>% Off</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="30"
                    value={overlays[editingOverlayIdx]?.discountPct || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                      const updated = { ...overlays, [editingOverlayIdx!]: { ...overlays[editingOverlayIdx!], discountPct: val } } as Record<number, ImagePriceOverlay>;
                      onPriceOverlayChange?.(updated);
                    }}
                    className={`w-full h-9 px-3 pr-7 rounded-lg text-sm outline-none border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                  <Percent className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>
              </div>
              <div className="flex-1">
                <label className={`text-[10px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Offer Price (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="699"
                  value={overlays[editingOverlayIdx]?.offerPrice || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                    const updated = { ...overlays, [editingOverlayIdx!]: { ...overlays[editingOverlayIdx!], offerPrice: val } } as Record<number, ImagePriceOverlay>;
                    onPriceOverlayChange?.(updated);
                  }}
                  className={`w-full h-9 px-3 rounded-lg text-sm outline-none border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>
              <div className="flex-1">
                <label className={`text-[10px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MRP (auto)</label>
                <div className={`w-full h-9 px-3 rounded-lg text-sm flex items-center border ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  {overlays[editingOverlayIdx]?.offerPrice
                    ? `₹${Math.round(parseFloat(overlays[editingOverlayIdx].offerPrice) * 1.3)}`
                    : '—'}
                </div>
              </div>
            </div>
            <p className={`text-[9px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Optional — adds price tag overlay on the image. MRP = offer price + 30%.
            </p>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES}
        onChange={handleVideoChange}
        className="hidden"
      />

      {/* ── Image Library ── */}
      {showLibrary && (
        <div style={floatIn(0, true)} className="mb-4">
          {isLibraryLoading ? (
            <div className={`h-20 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
              {imageLibrary.map((img, i) => {
                const alreadyUsed = allImages.some(a => a.url === img.url);
                return (
                  <button
                    key={img.url + i}
                    onClick={() => !alreadyUsed && handleLibrarySelect(img.url, img.name)}
                    disabled={alreadyUsed || !canAddMore}
                    className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                      alreadyUsed
                        ? 'opacity-40 border-emerald-500'
                        : !canAddMore
                          ? 'opacity-30 cursor-not-allowed border-slate-300'
                          : isDark ? 'border-slate-700 hover:border-blue-500' : 'border-slate-200 hover:border-blue-500'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {alreadyUsed && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Video Section ── */}
      <div style={floatIn(350, visible)} className="mb-4">
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('m_video_optional')}
        </p>

        {hasVideo ? (
          <div className={`relative rounded-xl overflow-hidden border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <video
              src={videoPreviewUrl || undefined}
              className="w-full h-32 object-cover bg-black"
              muted
              playsInline
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 flex items-center gap-1">
              <Film className="w-3 h-3 text-white" />
              <span className="text-[10px] font-semibold text-white">
                {selectedVideoFile ? selectedVideoFile.name.slice(0, 20) : 'Video'}
              </span>
            </div>
            <button
              onClick={removeVideo}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => videoInputRef.current?.click()}
            className={`w-full h-14 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
              isDark
                ? 'border-slate-700 hover:border-slate-500 text-slate-400'
                : 'border-slate-300 hover:border-slate-400 text-slate-500'
            }`}
          >
            <Film className="w-5 h-5" />
            <span className="text-sm font-semibold">{t('m_add_video')}</span>
            <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('m_video_max')} {MAX_VIDEO_SIZE_MB}MB</span>
          </button>
        )}

        {videoError && (
          <p className={`text-xs mt-2 ${isDark ? 'text-red-400' : 'text-red-500'}`}>{videoError}</p>
        )}
      </div>

      {/* Moderation error */}
      {moderationError && (
        <div style={floatIn(0, true)} className={`mb-4 p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{moderationError}</p>
        </div>
      )}

      {/* Hint */}
      {totalImages > 0 && totalImages < 3 && (
        <div style={floatIn(400, visible)} className={`mb-4 p-3 rounded-xl ${isDark ? 'bg-blue-500/5 border border-blue-500/10' : 'bg-blue-50/50 border border-blue-100'}`}>
          <p className={`text-[11px] ${isDark ? 'text-blue-400/70' : 'text-blue-500/70'}`}>
            {t('m_img_tip')}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div style={floatIn(500, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t('m_back')}
        </button>
        <button
          onClick={handleContinue}
          disabled={!hasImage || checking}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : t('m_continue')}
        </button>
      </div>
    </div>
  );
};
