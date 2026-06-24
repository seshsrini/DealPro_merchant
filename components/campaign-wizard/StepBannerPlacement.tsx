import React, { useEffect, useMemo, useState } from 'react';
import { Layout, Loader2, Check } from 'lucide-react';
import { floatIn } from './floatIn';
import {
  generatePromoBanner,
  ALL_BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  BannerPlacement,
} from './StepImage';
import { TRUST_BADGES } from './StepTrustBadges';

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
  const [visible, setVisible] = useState(false);
  const [previews, setPreviews] = useState<Record<BannerPlacement, string | null>>({
    auto: null, left: null, right: null, top: null, bottom: null, none: null,
  });
  const [generating, setGenerating] = useState(true);
  const [generationError, setGenerationError] = useState<string | null>(null);

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

  // A clean (un-baked) photo is required to generate placement previews.
  // `originalImageFile` is set ONLY by a fresh upload — an existing/saved cover is
  // already a finished banner with text baked in, so baking onto it again would
  // stack a SECOND layer of text (the "double text" bug). When there's no fresh
  // upload we skip generation and show the saved cover as-is (see render below).
  const canRebake = !!originalImageFile;

  // Bake all placement variants in parallel and stash the resulting blob URLs.
  // We only re-bake when the merchant returns to this step (mount), not on every
  // render — they only get here after upload + heading/offer/badges are settled.
  useEffect(() => {
    if (!canRebake) { setGenerating(false); return; }
    let cancelled = false;
    const objectUrls: string[] = [];

    (async () => {
      setGenerating(true);
      setGenerationError(null);
      try {
        const source = originalImageFile!;
        // Bake all variants in parallel for snappy UI.
        const results = await Promise.all(
          ALL_BANNER_PLACEMENTS.map(placement =>
            generatePromoBanner(
              source,
              storeName || 'Your Store',
              dealHeading || 'Special Deal',
              offerValue || 'Great Offer',
              badgeLabels,
              undefined,
              placement,
            ).then(file => URL.createObjectURL(file)),
          ),
        );
        if (cancelled) {
          results.forEach(u => URL.revokeObjectURL(u));
          return;
        }
        const next: Record<BannerPlacement, string | null> = {
          auto: results[0], left: results[1], right: results[2], top: results[3], bottom: results[4], none: results[5],
        };
        results.forEach(u => objectUrls.push(u));
        setPreviews(next);
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
  }, [canRebake, originalImageFile, storeName, dealHeading, offerValue, badgeLabels]);

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

      {!canRebake ? (
        // Editing a saved deal without a new upload — the cover is already a
        // finished banner. Show it as-is (no re-bake → no double text) and tell
        // the merchant how to change the layout.
        <div style={floatIn(250, visible)} className="mb-6">
          {existingThumbnail ? (
            <div className={`rounded-xl overflow-hidden border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <img src={existingThumbnail} alt="Current cover" className="w-full aspect-square object-cover" />
            </div>
          ) : (
            <div className={`rounded-xl aspect-square flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <p className={`text-xs px-6 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No cover image found. Go back and upload one.</p>
            </div>
          )}
          <div className={`mt-3 p-3 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
            <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              This is your current cover. To change where the deal text sits, go back to the image step and upload a new cover photo.
            </p>
          </div>
        </div>
      ) : (
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
      )}

      {/* Hint — only relevant when the merchant can actually change placement. */}
      {canRebake && (
      <div style={floatIn(350, visible)} className={`mb-4 p-3 rounded-xl ${isDark ? 'bg-purple-500/5 border border-purple-500/10' : 'bg-purple-50/50 border border-purple-100'}`}>
        <p className={`text-[11px] ${isDark ? 'text-purple-400/70' : 'text-purple-600/80'}`}>
          {value === 'auto'
            ? 'Auto picks left or right based on where the product sits in your photo.'
            : value === 'none'
              ? 'Image only — no overlay, gradient, or text. Lets the photo speak for itself.'
              : `Text will sit on the ${BANNER_PLACEMENT_LABELS[value].toLowerCase()} of the cover image.`}
        </p>
      </div>
      )}

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
          onClick={onNext}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
