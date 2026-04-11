import React, { useRef, useEffect, useState } from 'react';
import { Megaphone, Loader2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { PlaceholderTooltip, isPlaceholderTooltipDismissed } from './PlaceholderTooltip';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepHeadingProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepHeading: React.FC<StepHeadingProps> = ({ value, onChange, onNext, onBack, theme }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const isValid = value.trim().length >= 3;
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [showPlaceholderHint, setShowPlaceholderHint] = useState(false);

  const hasPlaceholder = /<[^>]+>/.test(value);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Show popup tooltip once on mount if value has template placeholders
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
      setModerationError(t('m_replace_placeholder'));
      return;
    }
    setChecking(true);
    setModerationError(null);
    try {
      const result = await addCampaignService.moderateContent(value, '', '');
      if (result.flagged) {
        setModerationError(result.reason || t('m_heading_inappropriate'));
        setChecking(false);
        return;
      }
      onNext();
    } catch {
      setModerationError(t('m_verify_fail'));
      return;
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
        <Megaphone className="w-8 h-8 text-amber-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_campaign_headline')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_headline_hint')}
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
          placeholder={t('m_enter_headline')}
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
              <p className="text-xs text-red-500">{t('m_min_3_chars')}</p>
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

      {/* Examples */}
      <div style={floatIn(400, visible)} className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('m_examples')}
        </p>
        <div className="space-y-2">
          {[t('m_example_1'), t('m_example_2'), t('m_example_3'), t('m_example_4')].map((ex) => (
            <button
              key={ex}
              onClick={() => onChange(ex)}
              className={`block text-sm ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'} transition-colors`}
            >
              "{ex}"
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
          {t('m_back')}
        </button>
        <button
          onClick={handleContinue}
          disabled={!isValid || checking}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : t('m_continue')}
        </button>
      </div>
    </div>
  );
};
