import React, { useEffect, useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { floatIn } from './floatIn';
import { ProductLookup } from '../ProductCatalog/ProductLookup';
import { ProductData } from '../../services/productLookupService';

interface StepProductLookupProps {
  hintCategory: string;
  onResult: (product: ProductData) => void;
  onSkip: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepProductLookup: React.FC<StepProductLookupProps> = ({
  hintCategory, onResult, onSkip, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <Search className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Find your product
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Search by name or barcode to auto-fill details, or skip to enter manually.
      </p>

      <div style={floatIn(300, visible)}>
        <ProductLookup
          hintCategory={hintCategory}
          onResult={onResult}
          theme={theme}
        />
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
          onClick={onSkip}
          className={`flex-[2] h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
            isDark ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          Skip — Enter Manually
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
