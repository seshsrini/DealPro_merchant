import React, { useRef, useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { floatIn } from './floatIn';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepStoreNameProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  theme: 'light' | 'dark';
  /** Kept for prop compatibility; no longer used (uniqueness check removed). */
  originalValue?: string;
}

export const StepStoreName: React.FC<StepStoreNameProps> = ({ value, onChange, onNext, onBack, theme }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const isValidLength = value.trim().length >= 2;
  const [visible, setVisible] = useState(false);

  // NOTE: business-name uniqueness is intentionally NOT checked — two legally
  // registered businesses in different states can share the same name, so a
  // duplicate legal name is valid. The name is still verified against GST
  // records later; we only require a sensible minimum length here.
  const canContinue = isValidLength;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canContinue) onNext();
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
        <Store className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('ob_bizname_title')} <span className="text-red-500">*</span>
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('ob_bizname_sub')}
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
            placeholder={t('ob_bizname_placeholder')}
            className={`w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
              isDark
                ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-emerald-500'
                : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-emerald-500'
            }`}
          />
        </div>
        {value.length > 0 && !isValidLength && (
          <p className="text-xs text-red-500 mt-2">{t('ob_bizname_min')}</p>
        )}
        <p className={`text-xs mt-3 font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
          {t('ob_bizname_gst_note')}
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
            {t('ob_back')}
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="flex-1 h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('ob_continue')}
        </button>
      </div>
    </div>
  );
};
