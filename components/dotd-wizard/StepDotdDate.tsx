import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { floatIn } from '../campaign-wizard/floatIn';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepDotdDateProps {
  value: string;
  onChange: (date: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

const getMinDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 2); // +2 days advance notice
  return d.toISOString().split('T')[0];
};

export const StepDotdDate: React.FC<StepDotdDateProps> = ({ value, onChange, onNext, onBack, theme }) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const minDate = getMinDate();
  const isValid = !!value && value >= minDate;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) onNext();
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
        <Calendar className="w-8 h-8 text-yellow-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_deal_date')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_pick_deal_date')}
      </p>

      <div style={floatIn(300, visible)}>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          min={minDate}
          className={`w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
            isDark
              ? 'bg-slate-800 text-white border-slate-700 focus:border-slate-500'
              : 'bg-white text-slate-900 border-slate-200 focus:border-slate-500'
          }`}
        />
      </div>

      <div style={floatIn(400, visible)} className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Deal of the Day is a single-day feature. Your deal will be prominently shown to all customers on the selected date. Minimum 2 days advance notice required.
        </p>
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
          onClick={onNext}
          disabled={!isValid}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('m_continue')}
        </button>
      </div>
    </div>
  );
};
