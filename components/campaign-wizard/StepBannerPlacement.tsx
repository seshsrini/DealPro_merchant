import React, { useEffect, useMemo, useState } from 'react';
import { Layout, Loader2, Check, AlertTriangle } from 'lucide-react';
import { floatIn } from './floatIn';
import {
  generatePromoBanner,
  ALL_BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  BannerPlacement,
} from './StepImage';
import { TRUST_BADGES } from './StepTrustBadges';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepBannerPlacementProps {
  /** Preserved original photo (set on upload). Required to bake the previews cleanly. */
  originalImageFile: File | null;
  /** Fallback when editing an existing deal — fetched once and reused for all preview bakes. */
  existingThumbnail: string | null;
  storeName: string;
  dealHeading: string;
  offerValue: string;
  trustBadgeIds?: string[];
  value: BannerPlacement;
  onChange: (placement: BannerPlacement) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepBannerPlacement: React.FC<StepBannerPlacementProps> = ({
  originalImageFile, existingThumbnail, storeName, dealHeading, offerValue,
  trustBadgeIds, value, onChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [previews, setPreviews] = useState<Record<BannerPlacement, string | null>>({
    auto: null, left: null, right: null, top: null, bottom: null, none: null,
  });
  const [generating, setGenerating] = useState(true);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // The chosen layout is baked into the image, so committing is one-way. Confirm
  // before proceeding so the merchant knows changing it means starting over.
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const badgeLabels = useMemo(
    () => (trustBadgeIds || [])
      .map(id => TRUST_BADGES.find(b => b.id === id)?.label)
      .filter(Boolean) as string[],
    [trustBadgeIds],
  );

  // Bake the placement variants and stash the resulting blob URLs.
  // We only re-bake when the merchant returns to this step (mount), not on every render —
  // they would only get here after upload + heading/offer/badges are settled.
  //
  // IMPORTANT: bake ONE AT A TIME, not in parallel. Each bake allocates a canvas
  // sized to the source photo (up to ~4000×4000 → ~64 MB) plus a decoded bitmap.
  // Baking all five at once spiked peak memory to ~300–500 MB, which OOM-killed
  // the Android WebView renderer — the app "suddenly refreshed" mid-wizard and,
  // because the draft auto-saves, reopening then prompted to finish the deal.
  // Sequential baking keeps only one canvas live at a time; previews also fill in
  // progressively, which reads as more responsive.
  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    (async () => {
      setGenerating(true);
      setGenerationError(null);
      // Reset so a re-bake never shows now-revoked URLs from a previous run.
      setPreviews({ auto: null, left: null, right: null, top: null, bottom: null, none: null });
      try {
        // Resolve a single source File for all bakes.
        let source = originalImageFile;
        if (!source && existingThumbnail) {
          const res = await fetch(existingThumbnail);
          const blob = await res.blob();
          source = new File([blob], 'existing.jpg', { type: blob.type || 'image/jpeg' });
        }
        if (!source) {
          setGenerationError('No cover image found. Go back and upload an image first.');
          return;
        }
        let anySucceeded = false;
        for (const placement of ALL_BANNER_PLACEMENTS) {
          if (cancelled) return;
          try {
            const file = await generatePromoBanner(
              source,
              storeName || 'Your Store',
              dealHeading || 'Special Deal',
              offerValue || 'Great Offer',
              badgeLabels,
              undefined,
              placement,
            );
            if (cancelled) return;
            const url = URL.createObjectURL(file);
            objectUrls.push(url);
            anySucceeded = true;
            setPreviews(prev => ({ ...prev, [placement]: url }));
          } catch (err) {
            console.error('[StepBannerPlacement] Failed to generate preview for', placement, err);
          }
          // Yield to the event loop between bakes so the UI can paint and the
          // WebView can reclaim the previous canvas before the next allocates.
          await new Promise(r => setTimeout(r, 0));
        }
        if (!cancelled && !anySucceeded) {
          setGenerationError('Could not generate banner previews. Tap Next to continue with the auto layout.');
        }
      } catch (err) {
        console.error('[StepBannerPlacement] Failed to generate previews:', err);
        if (!cancelled) setGenerationError('Could not generate banner previews. Tap Next to continue with the auto layout.');
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
      objectUrls.forEach(u => URL.revokeObjectURL(u));
    };
  }, [originalImageFile, existingThumbnail, storeName, dealHeading, offerValue, badgeLabels]);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
        <Layout className="w-8 h-8 text-purple-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Banner Layout
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Choose where the deal text sits on your cover image. Auto picks the best side based on the photo.
      </p>

      {generationError && (
        <div style={floatIn(0, true)} className={`mb-4 p-3 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
          <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{generationError}</p>
        </div>
      )}

      <div style={floatIn(250, visible)} className="grid grid-cols-2 gap-3 mb-6">
        {ALL_BANNER_PLACEMENTS.map((placement) => {
          const isSelected = value === placement;
          const previewUrl = previews[placement];
          return (
            <button
              key={placement}
              onClick={() => onChange(placement)}
              disabled={generating && !previewUrl}
              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all active:scale-[0.98] ${
                isSelected
                  ? 'border-purple-500 ring-2 ring-purple-500/30'
                  : isDark ? 'border-slate-700' : 'border-slate-200'
              }`}
            >
              {previewUrl ? (
                <img src={previewUrl} alt={`${placement} layout`} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              )}

              {/* Label pill */}
              <div className={`absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
                isSelected ? 'bg-purple-500 text-white' : 'bg-black/60 text-white'
              }`}>
                {BANNER_PLACEMENT_LABELS[placement]}
              </div>

              {/* Selected check */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      <div style={floatIn(350, visible)} className={`mb-4 p-3 rounded-xl ${isDark ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-purple-50/50 border border-purple-100'}`}>
        <p className={`text-[11px] ${isDark ? 'text-purple-400/70' : 'text-purple-600/80'}`}>
          {value === 'auto'
            ? 'Auto picks left or right based on where the product sits in your photo.'
            : value === 'none'
              ? 'Image only — no overlay, gradient, or text. Lets the photo speak for itself.'
              : `Text will sit on the ${BANNER_PLACEMENT_LABELS[value].toLowerCase()} of the cover image.`}
        </p>
      </div>

      {/* Navigation */}
      <div style={floatIn(450, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Back
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center"
        >
          Continue
        </button>
      </div>

      {/* Final-choice warning — the layout is baked into the image, so changing it
          later means starting the deal over. Confirm before committing. */}
      {showConfirm && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className={`w-full max-w-sm rounded-2xl p-6 text-center ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
            <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-amber-500/15' : 'bg-amber-100'}`}>
              <AlertTriangle className={`w-6 h-6 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('m_banner_final_title')}
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('m_banner_final_msg').replace('{layout}', BANNER_PLACEMENT_LABELS[value])}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className={`flex-1 h-12 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {t('m_banner_go_back')}
              </button>
              <button
                onClick={() => { setShowConfirm(false); onNext(); }}
                className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              >
                {t('m_continue')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
