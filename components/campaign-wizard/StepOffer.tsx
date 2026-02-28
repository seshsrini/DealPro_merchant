import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { PlaceholderTooltip, isPlaceholderTooltipDismissed } from './PlaceholderTooltip';

interface StepOfferProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepOffer: React.FC<StepOfferProps> = ({ value, onChange, onNext, onBack, theme }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const isValid = value.trim().length >= 2;
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [showPlaceholderHint, setShowPlaceholderHint] = useState(false);

  const hasPlaceholder = /<[^>]+>/.test(value);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hasPlaceholder && !isPlaceholderTooltipDismissed()) {
      const t = setTimeout(() => setShowPlaceholderHint(true), 500);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && !checking) handleContinue();
  };

  const handleContinue = async () => {
    // Block if placeholder text still present
    if (hasPlaceholder) {
      setModerationError('Please replace the <...> placeholder with your own text.');
      return;
    }
    setChecking(true);
    setModerationError(null);
    try {
      const result = await addCampaignService.moderateContent('', value, '');
      if (result.flagged) {
        setModerationError(result.reason || 'This offer contains inappropriate content. Please revise.');
        setChecking(false);
        return;
      }
      onNext();
    } catch {
      // Profanity check is mandatory — block if service fails
      setModerationError('Unable to verify content. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <Sparkles className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Offer value
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        What's the deal? Be specific so customers know what they get.
      </p>

      <div style={floatIn(300, visible)}>
        <PlaceholderTooltip
          visible={showPlaceholderHint}
          onDismiss={() => setShowPlaceholderHint(false)}
          theme={theme}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (moderationError) setModerationError(null);
          }}
          onKeyDown={handleKeyDown}
          maxLength={50}
          placeholder="e.g., 50% OFF or Buy 1 Get 1 Free"
          className={`w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
            moderationError
              ? 'border-red-500 focus:border-red-500'
              : isDark
                ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
                : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
          }`}
        />
        <div className="flex justify-between mt-2">
          <div>
            {value.length > 0 && !isValid && (
              <p className="text-xs text-red-500">At least 2 characters required.</p>
            )}
          </div>
          <p className={`text-xs ${value.length >= 45 ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {value.length}/50
          </p>
        </div>

        {moderationError && (
          <div className={`mt-3 p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{moderationError}</p>
          </div>
        )}
      </div>

      {/* Quick pick suggestions */}
      <div style={floatIn(400, visible)} className={`mt-6 rounded-xl p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Tap to use
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            '30% OFF all items',
            'Buy 1 Get 1 Free',
            'Flat ₹200 Off',
            'Upto 50% OFF',
            'Free Delivery',
            'Flat 15% off first order',
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => {
                onChange(chip);
                if (moderationError) setModerationError(null);
              }}
              className={`h-10 px-3 rounded-lg text-xs font-medium transition-all active:scale-95 text-center ${
                value === chip
                  ? 'bg-emerald-500 text-white'
                  : isDark
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div style={floatIn(500, visible)} className="mt-auto pb-8 flex gap-3">
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
