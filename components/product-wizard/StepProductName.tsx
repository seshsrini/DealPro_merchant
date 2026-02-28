import React, { useRef, useEffect, useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';

interface StepProductNameProps {
  name: string;
  brand: string;
  onNameChange: (value: string) => void;
  onBrandChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepProductName: React.FC<StepProductNameProps> = ({
  name, brand, onNameChange, onBrandChange, onNext, onBack, theme,
}) => {
  const nameRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const isValid = name.trim().length >= 2;
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 350);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !checking) handleContinue();
  };

  const handleContinue = async () => {
    setChecking(true);
    setModerationError(null);
    try {
      const result = await addCampaignService.moderateContent(name, brand, '');
      if (result.flagged) {
        setModerationError(result.reason || 'Content contains inappropriate language. Please revise.');
        setChecking(false);
        return;
      }
      onNext();
    } catch {
      // Non-blocking on moderation failure
      onNext();
    } finally {
      setChecking(false);
    }
  };

  const inputClass = `w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
    moderationError
      ? 'border-red-500 focus:border-red-500'
      : isDark
        ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
        : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
  }`;

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <Package className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Product details
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Enter the product name and brand.
      </p>

      <div style={floatIn(300, visible)} className="space-y-4">
        <div>
          <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => {
              onNameChange(e.target.value);
              if (moderationError) setModerationError(null);
            }}
            onKeyDown={handleKeyDown}
            maxLength={100}
            placeholder="e.g. iPhone 15 Pro Max"
            className={inputClass}
          />
          <p className={`text-xs mt-1.5 text-right ${name.length >= 90 ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {name.length}/100
          </p>
        </div>

        <div>
          <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Brand
          </label>
          <input
            type="text"
            value={brand}
            onChange={(e) => {
              onBrandChange(e.target.value);
              if (moderationError) setModerationError(null);
            }}
            onKeyDown={handleKeyDown}
            maxLength={50}
            placeholder="e.g. Apple, Samsung, Nike"
            className={`w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
              isDark
                ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
                : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
            }`}
          />
        </div>

        {moderationError && (
          <div className={`p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{moderationError}</p>
          </div>
        )}
      </div>

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
          onClick={handleContinue}
          disabled={!isValid || checking}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
        </button>
      </div>
    </div>
  );
};
