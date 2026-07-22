import React, { useState, useEffect } from 'react';
import { Sparkles, User, Store, MapPin, ShieldCheck, FileText, CreditCard, ArrowRight } from 'lucide-react';
import { floatIn } from './floatIn';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepWelcomeProps {
  onNext: () => void;
  theme: 'light' | 'dark';
}

const STEPS_PREVIEW = [
  { icon: User, labelKey: 'ob_welcome_step_name', color: 'text-blue-500' },
  { icon: Store, labelKey: 'ob_welcome_step_store', color: 'text-emerald-500' },
  { icon: MapPin, labelKey: 'ob_welcome_step_address', color: 'text-purple-500' },
  { icon: ShieldCheck, labelKey: 'ob_welcome_step_verify', color: 'text-amber-500' },
  { icon: FileText, labelKey: 'ob_welcome_step_terms', color: 'text-slate-500' },
  { icon: CreditCard, labelKey: 'ob_welcome_step_plan', color: 'text-pink-500' },
];

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onNext, theme }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div
        style={floatIn(0, visible)}
        className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4"
      >
        <Sparkles className="w-7 h-7 text-amber-500" />
      </div>

      <h2
        style={floatIn(100, visible)}
        className={`text-2xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}
      >
        {t('ob_welcome_title')}
      </h2>
      <p
        style={floatIn(200, visible)}
        className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        {t('ob_welcome_sub')}
      </p>

      <div className="space-y-2 mb-4">
        {STEPS_PREVIEW.map(({ icon: Icon, labelKey, color }, i) => (
          <div
            key={i}
            style={floatIn(300 + i * 80, visible)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
              isDark ? 'bg-slate-800/60' : 'bg-slate-50'
            }`}
          >
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {t(labelKey)}
            </span>
          </div>
        ))}
      </div>

      <p
        style={floatIn(800, visible)}
        className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
      >
        {t('ob_welcome_time')}
      </p>

      <div style={floatIn(900, visible)} className="mt-auto pb-safe-bottom">
        <button
          onClick={onNext}
          className="w-full h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {t('ob_welcome_cta')} <ArrowRight className="w-4 h-4" />
        </button>
        {/* Build stamp — lets a tester confirm at a glance they're on the latest
            WEB build without reaching the Profile footer. Fastest way to catch a
            stale APK during signup. */}
        <p className={`mt-3 text-center text-[9px] tracking-wide ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          Build {__BUILD_ID__}
        </p>
      </div>
    </div>
  );
};
