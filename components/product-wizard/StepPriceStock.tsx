import React, { useRef, useEffect, useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { floatIn } from './floatIn';

type StockStatus = 'in_stock' | 'out_of_stock' | 'limited';

const STOCK_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'limited', label: 'Limited' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

interface StepPriceStockProps {
  price: string;
  mrp: string;
  stock: StockStatus;
  onPriceChange: (value: string) => void;
  onMrpChange: (value: string) => void;
  onStockChange: (value: StockStatus) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepPriceStock: React.FC<StepPriceStockProps> = ({
  price, mrp, stock, onPriceChange, onMrpChange, onStockChange,
  onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const priceRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setTimeout(() => priceRef.current?.focus(), 350);
  }, []);

  const hasDiscount = mrp && price && parseFloat(mrp) > parseFloat(price);
  const discountPct = hasDiscount
    ? Math.round((1 - parseFloat(price) / parseFloat(mrp)) * 100)
    : 0;

  const inputClass = `w-full h-14 px-4 rounded-xl text-base font-medium outline-none transition-all border ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
  }`;

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <IndianRupee className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Pricing & stock
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Set your selling price, MRP, and stock availability.
      </p>

      <div style={floatIn(300, visible)} className="space-y-5">
        {/* Price fields */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Selling Price (₹)
            </label>
            <input
              ref={priceRef}
              type="number"
              placeholder="0"
              value={price}
              onChange={e => onPriceChange(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              MRP (₹)
            </label>
            <input
              type="number"
              placeholder="0"
              value={mrp}
              onChange={e => onMrpChange(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Discount preview */}
        {discountPct > 0 && (
          <div className={`px-4 py-3 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <p className="text-sm font-semibold text-emerald-500">
              {discountPct}% discount from MRP
            </p>
          </div>
        )}

        {/* Stock status */}
        <div>
          <label className={`block text-xs font-semibold mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Stock Status
          </label>
          <div className="flex gap-2 flex-wrap">
            {STOCK_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onStockChange(opt.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all active:scale-[0.98] ${
                  stock === opt.value
                    ? isDark ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-emerald-500 bg-emerald-50 text-emerald-600'
                    : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
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
