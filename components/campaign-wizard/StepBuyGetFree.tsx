/**
 * StepBuyGetFree.tsx
 *
 * "Buy and Get Free Gift" step — lets merchant add up to 3 free gift items.
 * Each gift has a photo and a short name (displayed to consumers).
 * No canvas compositing — gifts are stored as separate images.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, Gift, ArrowRight } from 'lucide-react';
import { floatIn } from './floatIn';

const MAX_GIFTS = 3;
const MAX_NAME_LENGTH = 40;

export interface FreeGiftItem {
  imageFile: File | null;
  imageUrl: string | null;
  name: string;
}

export const emptyGift = (): FreeGiftItem => ({
  imageFile: null, imageUrl: null, name: '',
});

interface StepBuyGetFreeProps {
  gifts: FreeGiftItem[];
  onChange: (gifts: FreeGiftItem[]) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepBuyGetFree: React.FC<StepBuyGetFreeProps> = ({
  gifts, onChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Ensure at least 1 slot
  const items = gifts.length > 0 ? gifts : [emptyGift()];

  const updateGift = (index: number, updates: Partial<FreeGiftItem>) => {
    const updated = items.map((g, i) => i === index ? { ...g, ...updates } : g);
    onChange(updated);
  };

  const handleImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    updateGift(index, { imageFile: file, imageUrl: URL.createObjectURL(file) });
  };

  const addGift = () => {
    if (items.length < MAX_GIFTS) {
      onChange([...items, emptyGift()]);
    }
  };

  const removeGift = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const hasValidGift = items.some(g => (g.imageFile || g.imageUrl) && g.name.trim());

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      {/* Header */}
      <div style={floatIn(0, visible)}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-pink-500/10' : 'bg-pink-50'}`}>
          <Gift className="w-8 h-8 text-pink-500" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Free Gifts
        </h2>
        <p className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Add up to {MAX_GIFTS} free gift items. Each gift needs a photo and a short name.
        </p>
      </div>

      {/* Gift slots */}
      <div className="flex-1 overflow-y-auto pb-4 space-y-4">
        {items.map((gift, idx) => (
          <div
            key={idx}
            style={floatIn(150 + idx * 100, visible)}
            className={`rounded-2xl border p-4 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Gift {idx + 1}
              </p>
              {items.length > 1 && (
                <button onClick={() => removeGift(idx)} className="p-1.5 rounded-lg bg-red-500/10 text-red-500">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              {/* Gift image */}
              <div className="shrink-0">
                <input
                  ref={el => { inputRefs.current[idx] = el; }}
                  type="file"
                  accept="image/*"
                  onChange={e => handleImage(idx, e)}
                  className="hidden"
                />
                {gift.imageUrl ? (
                  <button
                    onClick={() => inputRefs.current[idx]?.click()}
                    className={`w-20 h-20 rounded-xl overflow-hidden relative border ${isDark ? 'border-slate-600' : 'border-slate-300'}`}
                  >
                    <img src={gift.imageUrl} alt="Gift" className="w-full h-full object-cover" />
                  </button>
                ) : (
                  <button
                    onClick={() => inputRefs.current[idx]?.click()}
                    className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all ${
                      isDark ? 'border-pink-500/30 bg-pink-500/5' : 'border-pink-300 bg-pink-50/50'
                    }`}
                  >
                    <Gift className="w-5 h-5 text-pink-500" />
                    <span className="text-[9px] font-medium text-pink-500">Photo</span>
                  </button>
                )}
              </div>

              {/* Gift name */}
              <div className="flex-1">
                <p className={`text-[10px] font-medium mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Gift Name ({gift.name.length}/{MAX_NAME_LENGTH})
                </p>
                <input
                  type="text"
                  value={gift.name}
                  onChange={e => updateGift(idx, { name: e.target.value.slice(0, MAX_NAME_LENGTH) })}
                  placeholder="e.g. Laptop Sleeve, USB Drive"
                  maxLength={MAX_NAME_LENGTH}
                  className={`w-full h-10 px-3 rounded-lg text-sm font-medium outline-none transition-all border ${
                    isDark
                      ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
                      : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
                  }`}
                />
                <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  Shown below the gift image to consumers
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Add more button */}
        {items.length < MAX_GIFTS && (
          <button
            onClick={addGift}
            className={`w-full h-12 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
              isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Add another gift ({items.length}/{MAX_GIFTS})</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <div style={floatIn(400, visible)} className="mt-auto pb-8 flex gap-3">
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
          disabled={!hasValidGift}
          className="flex-[2] h-14 rounded-xl bg-pink-500 text-white text-base font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
