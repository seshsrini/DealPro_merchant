import React, { useState, useEffect } from 'react';
import { Loader2, Tags } from 'lucide-react';
import { addCampaignService } from '../../services/addCampaignService';
import { floatIn } from './floatIn';

const FALLBACK_CATEGORIES = [
  'Grocery', 'Restaurant', 'Electronics', 'Fashion', 'Beauty',
  'Health', 'Books', 'Home', 'Automotive', 'Tires',
  'Sports', 'Jewellery', 'Toys', 'Furniture', 'General',
];

interface StepCategoryProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepCategory: React.FC<StepCategoryProps> = ({ value, onChange, onNext, onBack, theme }) => {
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    addCampaignService.getStoreCategories()
      .then((cats) => setCategories(cats.length > 0 ? cats : FALLBACK_CATEGORIES))
      .catch(() => setCategories(FALLBACK_CATEGORIES))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
        <Tags className="w-8 h-8 text-blue-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Store category
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Select your primary category
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div style={floatIn(300, visible)} className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[50vh] pb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              className={`px-3 py-3 rounded-xl text-sm font-medium text-center transition-all active:scale-[0.95] border ${
                value === cat
                  ? 'bg-slate-900 text-white border-slate-900'
                  : isDark
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

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
          disabled={!value}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
