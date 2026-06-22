import React, { useRef, useEffect, useState } from 'react';
import { Store, Loader2, Check } from 'lucide-react';
import { floatIn } from './floatIn';
import { userService } from '../../services/userService';

interface StepStoreNameProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  theme: 'light' | 'dark';
  /** The merchant's already-saved legal name (so re-entering it isn't "taken"). */
  originalValue?: string;
}

export const StepStoreName: React.FC<StepStoreNameProps> = ({ value, onChange, onNext, onBack, theme, originalValue }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const isValidLength = value.trim().length >= 2;
  const [visible, setVisible] = useState(false);

  // Business-name uniqueness check (debounced).
  const [taken, setTaken] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The merchant's own saved name should never count as taken.
  const isOwn = !!originalValue && value.trim().toLowerCase() === originalValue.trim().toLowerCase();
  const canContinue = isValidLength && !checking && (isOwn || taken === false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  // Debounced uniqueness check on the entered legal name.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTaken(null);
    if (!isValidLength || isOwn) { setChecking(false); return; }
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      const v = value.trim();
      try {
        const isTaken = await userService.validateMerchantField('legal_name', v);
        // Guard against a stale result if the value changed during the request.
        if (v === value.trim()) setTaken(isTaken);
      } catch {
        if (v === value.trim()) setTaken(false); // don't block on a backend hiccup
      } finally {
        if (v === value.trim()) setChecking(false);
      }
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, isValidLength, isOwn]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canContinue) onNext();
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
        <Store className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Legal name of business
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        The registered legal name of your business. You'll add your store name in the next step.
      </p>
      <div style={floatIn(300, visible)}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            // Max 60 chars; letters/numbers/spaces only (no special characters).
            onChange={(e) => onChange(e.target.value.replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 60))}
            onKeyDown={handleKeyDown}
            maxLength={60}
            placeholder="Enter legal business name"
            className={`w-full h-14 px-4 pr-11 rounded-xl text-base font-medium outline-none transition-all border ${
              taken === true
                ? 'border-red-500 ' + (isDark ? 'bg-slate-800 text-white' : 'bg-white text-slate-900')
                : isDark
                  ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-emerald-500'
                  : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-emerald-500'
            }`}
          />
          {/* Uniqueness status */}
          {isValidLength && !isOwn && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {checking ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : taken === false ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : null}
            </div>
          )}
        </div>
        {value.length > 0 && !isValidLength && (
          <p className="text-xs text-red-500 mt-2">Legal name must be at least 2 characters.</p>
        )}
        {taken === true && (
          <p className="text-xs text-red-500 mt-2">This business name is already registered. Please use your exact registered legal name.</p>
        )}
        <p className={`text-xs mt-3 font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
          This will be verified against GST records for validation.
        </p>
      </div>
      <div style={floatIn(400, visible)} className="mt-auto pb-safe-bottom flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="flex-1 h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </div>
    </div>
  );
};
