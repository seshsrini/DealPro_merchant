import React from 'react';
import { Lock } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

/**
 * Shown in place of the Catalogue screen for merchants on the ₹199 plan, which
 * does not include the product catalogue. Reachable only as a backstop (e.g. a
 * deep link or a dashboard shortcut) since the bottom-nav tab is disabled — so
 * it explains why and points to the plans page to upgrade.
 */
export const CatalogueLocked: React.FC<{ theme: 'light' | 'dark'; onUpgrade: () => void }> = ({ theme, onUpgrade }) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 min-h-[60vh]">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <Lock className={`w-7 h-7 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
      </div>
      <h2 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_cat_locked_title')}</h2>
      <p className={`text-sm mb-6 max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_cat_locked_desc')}</p>
      <button
        onClick={onUpgrade}
        className="h-12 px-6 rounded-xl bg-amber-500 text-white text-sm font-bold active:scale-[0.98] transition-all shadow-md shadow-amber-500/30"
      >
        {t('m_manage_plan')}
      </button>
    </div>
  );
};
