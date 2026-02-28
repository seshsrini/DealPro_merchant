import React, { useEffect, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { floatIn } from './floatIn';
import { ImageUploader } from '../ProductCatalog/ImageUploader';

interface StepProductImageProps {
  value: string | null;
  categoryLabel: string;
  onChange: (url: string | null) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepProductImage: React.FC<StepProductImageProps> = ({
  value, categoryLabel, onChange, onNext, onBack, theme,
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
        <ImageIcon className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Product image
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Upload a clear photo or use a placeholder icon.
      </p>

      <div style={floatIn(300, visible)}>
        <ImageUploader
          value={value}
          onChange={onChange}
          theme={theme}
          categoryLabel={categoryLabel}
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
          onClick={onNext}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
