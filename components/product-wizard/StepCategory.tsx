import React, { useEffect, useState } from 'react';
import { Grid3X3, CheckCircle2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { UNIVERSAL_CATEGORIES } from '../../services/productLookupService';

interface StepCategoryProps {
  selectedCategory: string;
  selectedSchemaId: string;
  onChange: (category: string, schemaId: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepCategory: React.FC<StepCategoryProps> = ({
  selectedCategory, selectedSchemaId, onChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const isValid = !!selectedCategory;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSelect = (label: string, schemaId: string) => {
    onChange(label, schemaId);
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <Grid3X3 className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Product category
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Choose the category that best fits your product.
      </p>

      <div style={floatIn(300, visible)} className="space-y-2 flex-1 overflow-y-auto pb-4">
        {UNIVERSAL_CATEGORIES.map(({ label, schemaId }) => {
          const isSelected = selectedCategory === label;
          return (
            <button
              key={label}
              onClick={() => handleSelect(label, schemaId)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all active:scale-[0.98] border ${
                isSelected
                  ? isDark
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-emerald-500 bg-emerald-50'
                  : isDark
                    ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className={`text-sm font-medium flex-1 ${
                isSelected
                  ? 'text-emerald-500'
                  : isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {label}
              </span>
              {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      <div style={floatIn(400, visible)} className="mt-auto pb-8 flex gap-3">
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
