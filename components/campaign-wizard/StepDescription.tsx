import React, { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { RichTextEditor } from '../RichTextEditor';
import { PlaceholderTooltip, isPlaceholderTooltipDismissed } from './PlaceholderTooltip';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepDescriptionProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

export const StepDescription: React.FC<StepDescriptionProps> = ({ value, onChange, onNext, onBack, theme }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const plainText = stripHtml(value);
  const isValid = plainText.length >= 10;
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [showPlaceholderHint, setShowPlaceholderHint] = useState(false);

  const hasPlaceholder = /<[^>]+>/.test(plainText);

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

  const handleContinue = async () => {
    // Block if placeholder text still present
    if (hasPlaceholder) {
      setModerationError(t('m_replace_placeholder'));
      return;
    }
    setChecking(true);
    setModerationError(null);
    try {
      const result = await addCampaignService.moderateContent('', '', plainText);
      if (result.flagged) {
        setModerationError(result.reason || t('m_desc_inappropriate'));
        setChecking(false);
        return;
      }
      onNext();
    } catch {
      // Profanity check is mandatory — block if service fails
      setModerationError(t('m_verify_fail'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
        <FileText className="w-8 h-8 text-purple-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_describe_deal')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_desc_hint')}
      </p>

      <div style={floatIn(300, visible)} className="flex-1">
        <PlaceholderTooltip
          visible={showPlaceholderHint}
          onDismiss={() => setShowPlaceholderHint(false)}
          theme={theme}
        />
        <RichTextEditor
          value={value}
          onChange={(v) => {
            onChange(v);
            if (moderationError) setModerationError(null);
          }}
          maxLength={400}
          theme={theme}
        />
        <div className="flex justify-between mt-2">
          <div>
            {plainText.length > 0 && !isValid && (
              <p className="text-xs text-red-500">{t('m_min_10_chars')}</p>
            )}
          </div>
          <p className={`text-xs ${plainText.length >= 380 ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {plainText.length}/400
          </p>
        </div>

        {moderationError && (
          <div className={`mt-3 p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
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
