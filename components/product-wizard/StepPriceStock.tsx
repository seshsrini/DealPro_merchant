import React, { useRef, useEffect, useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { floatIn } from './floatIn';

/**
 * Stock count encoding (matches the products.stock_count column):
 *   null  → "10+" / Available (default — plenty)
 *   0     → Out of Stock
 *   1..10 → exact remaining count (low-stock)
 */
export type StockCount = number | null;

// Dropdown <option value="..."> ↔ stock_count value mapping.
// We use string values because <select> only stores strings; the parent
// converts back to number | null via parseStockOption().
const STOCK_OPTIONS: { value: string; label: string }[] = [
  { value: 'PLENTY',       label: '10+ (Available)' },
  { value: '10',           label: '10 left' },
  { value: '9',            label: '9 left' },
  { value: '8',            label: '8 left' },
  { value: '7',            label: '7 left' },
  { value: '6',            label: '6 left' },
  { value: '5',            label: '5 left' },
  { value: '4',            label: '4 left' },
  { value: '3',            label: '3 left' },
  { value: '2',            label: '2 left' },
  { value: '1',            label: '1 left' },
  { value: 'OUT_OF_STOCK', label: 'Out of Stock' },
];

export function parseStockOption(value: string): StockCount {
  if (value === 'PLENTY') return null;
  if (value === 'OUT_OF_STOCK') return 0;
  return parseInt(value, 10);
}

export function stockCountToOption(count: StockCount): string {
  if (count === null || count === undefined) return 'PLENTY';
  if (count === 0) return 'OUT_OF_STOCK';
  return String(count);
}

interface StepPriceStockProps {
  price: string;
  mrp: string;
  stock: StockCount;
  onPriceChange: (value: string) => void;
  onMrpChange: (value: string) => void;
  onStockChange: (value: StockCount) => void;
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

  // Selling price AND MRP are mandatory (must be a positive number) before the
  // merchant can continue.
  const priceValid = price.trim() !== '' && parseFloat(price) > 0;
  const mrpValid = mrp.trim() !== '' && parseFloat(mrp) > 0;
  const canContinue = priceValid && mrpValid;

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

        {/* Stock count */}
        <div>
          <label className={`block text-xs font-semibold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Stock Available
          </label>
          <select
            value={stockCountToOption(stock)}
            onChange={e => onStockChange(parseStockOption(e.target.value))}
            className={inputClass}
          >
            {STOCK_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className={`mt-2 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Pick "10+" if you have plenty. Pick a specific count to show a low-stock warning to shoppers.
          </p>
        </div>
      </div>

      {!canContinue && (
        <p style={floatIn(350, visible)} className={`mt-4 text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Enter both the selling price and MRP to continue.
        </p>
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
          disabled={!canContinue}
          className={`flex-[2] h-14 rounded-xl text-base font-semibold transition-all ${
            canContinue
              ? 'bg-slate-900 text-white active:scale-[0.98]'
              : isDark ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
};
