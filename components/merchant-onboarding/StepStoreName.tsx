import React, { useRef, useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import { floatIn } from './floatIn';

interface StepStoreNameProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  theme: 'light' | 'dark';
}

export const StepStoreName: React.FC<StepStoreNameProps> = ({ value, onChange, onNext, onBack, theme }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const isValid = value.trim().length >= 2;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) onNext();
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6">
        <Store className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Your store name
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Your brand or business name that customers will see.
      </p>
      <div style={floatIn(300, visible)}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter store / brand name"
          className={`w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
            isDark
              ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-emerald-500'
              : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-emerald-500'
          }`}
        />
        {value.length > 0 && !isValid && (
          <p className="text-xs text-red-500 mt-2">Store name must be at least 2 characters.</p>
        )}
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
          disabled={!isValid}
          className="flex-1 h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
