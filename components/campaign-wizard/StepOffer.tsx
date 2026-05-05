import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { PlaceholderTooltip, isPlaceholderTooltipDismissed } from './PlaceholderTooltip';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepOfferProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
  storeCategory?: string | null;
}

// Bucket the merchant's store category to a suggestion set. Falls back to
// retail-style discount chips when no category or an unknown one is given,
// so the experience is never worse than the original.
type OfferBucket = 'retail' | 'food' | 'service' | 'pro' | 'hybrid';
function bucketForCategory(category?: string | null): OfferBucket {
  const c = (category || '').toLowerCase();
  if (!c) return 'retail';
  // Food-style merchants
  if (/restaurant|dining|cafe|bakery|chaat|juice|ice cream|tiffin|catering/.test(c)) return 'food';
  // Knowledge-/appointment-driven merchants where premium framing fits
  if (/professional|education|training|real estate|consult|legal|law|account|finance/.test(c)) return 'pro';
  // Hybrid: sells goods AND provides services. Needs both discount chips
  // (e.g. "10% off all medicines") AND service chips (e.g. "free home delivery").
  if (/pharmacy|healthcare|automotive|optical|pet/.test(c)) return 'hybrid';
  // Visit-/session-driven services
  if (/salon|beauty|parlor|travel|tour|entertainment|games|fitness|tailor|boutique/.test(c)) return 'service';
  return 'retail';
}

export const StepOffer: React.FC<StepOfferProps> = ({ value, onChange, onNext, onBack, theme, storeCategory }) => {
  const { t } = useTranslation();
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

  // Reactively show/hide the placeholder tooltip as the user types.
  // "Don't show again" only applies to the initial auto-popup on mount.
  const [userDismissedThisSession, setUserDismissedThisSession] = useState(false);
  useEffect(() => {
    if (hasPlaceholder && !userDismissedThisSession) {
      const t = setTimeout(() => setShowPlaceholderHint(true), 300);
      return () => clearTimeout(t);
    } else if (!hasPlaceholder) {
      setShowPlaceholderHint(false);
    }
  }, [hasPlaceholder, userDismissedThisSession]);

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
      const result = await addCampaignService.moderateContent('', value, '');
      if (result.flagged) {
        setModerationError(result.reason || t('m_offer_inappropriate'));
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
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <Sparkles className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_offer_value')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_offer_hint')}
      </p>

      <div style={floatIn(300, visible)}>
        <PlaceholderTooltip
          visible={showPlaceholderHint}
          onDismiss={() => { setShowPlaceholderHint(false); setUserDismissedThisSession(true); }}
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
          placeholder={t('m_offer_placeholder')}
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
              <p className="text-xs text-red-500">{t('m_min_2_chars')}</p>
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
          {t('m_tap_to_use')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(() => {
            const bucket = bucketForCategory(storeCategory);
            const keys: Record<OfferBucket, string[]> = {
              retail: ['m_offer_q1', 'm_offer_q2', 'm_offer_q3', 'm_offer_q4', 'm_offer_q5', 'm_offer_q6', 'm_offer_q7', 'm_offer_q8'],
              food:   ['m_offer_food_1', 'm_offer_food_2', 'm_offer_food_3', 'm_offer_food_4', 'm_offer_food_5', 'm_offer_food_6', 'm_offer_food_7', 'm_offer_food_8'],
              service:['m_offer_service_1', 'm_offer_service_2', 'm_offer_service_3', 'm_offer_service_4', 'm_offer_service_5', 'm_offer_service_6', 'm_offer_service_7', 'm_offer_service_8'],
              pro:    ['m_offer_pro_1', 'm_offer_pro_2', 'm_offer_pro_3', 'm_offer_pro_4', 'm_offer_pro_5', 'm_offer_pro_6', 'm_offer_pro_7', 'm_offer_pro_8'],
              hybrid: ['m_offer_hybrid_1', 'm_offer_hybrid_2', 'm_offer_hybrid_3', 'm_offer_hybrid_4', 'm_offer_hybrid_5', 'm_offer_hybrid_6', 'm_offer_hybrid_7', 'm_offer_hybrid_8'],
            };
            return keys[bucket].map((k) => t(k));
          })().map((chip) => (
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
