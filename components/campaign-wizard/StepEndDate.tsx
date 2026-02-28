import React, { useEffect, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { floatIn } from './floatIn';

interface StepEndDateProps {
  value: string;
  startDate: string;
  onChange: (date: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const StepEndDate: React.FC<StepEndDateProps> = ({ value, startDate, onChange, onNext, onBack, theme }) => {
  const isDark = theme === 'dark';
  const isValid = !!value && value > startDate;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) onNext();
  };

  // Calculate duration for display
  const durationDays = value && startDate
    ? Math.ceil((new Date(value).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <CalendarCheck className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        When does it end?
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Campaign starts {formatDate(startDate)}.
      </p>

      <div style={floatIn(300, visible)}>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          min={startDate}
          className={`w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
            isDark
              ? 'bg-slate-800 text-white border-slate-700 focus:border-slate-500'
              : 'bg-white text-slate-900 border-slate-200 focus:border-slate-500'
          }`}
        />
        {durationDays > 0 && (
          <p className={`text-xs mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Campaign duration: {durationDays} day{durationDays !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div style={floatIn(400, visible)} className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Duration tips
        </p>
        <ul className={`text-xs space-y-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <li>3-7 days — creates urgency, great for flash sales</li>
          <li>1-2 weeks — balanced exposure and engagement</li>
          <li>3-4 weeks — maximum reach for seasonal offers</li>
        </ul>
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
          onClick={onNext}
          disabled={!isValid}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
