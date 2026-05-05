import React, { useEffect, useState } from 'react';
import { Store, CheckCircle2 } from 'lucide-react';
import { floatIn } from './floatIn';

interface MerchantStore {
  id: string;
  store_name: string;
  address: string;
  city: string;
  locality?: string;
  store_category?: string;
}

interface StepProductStoreSelectProps {
  stores: MerchantStore[];
  selectedStoreIds: string[];
  onChange: (storeIds: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepProductStoreSelect: React.FC<StepProductStoreSelectProps> = ({
  stores, selectedStoreIds, onChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const isValid = selectedStoreIds.length > 0;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auto-select if merchant has only one store
  useEffect(() => {
    if (stores.length === 1 && selectedStoreIds.length === 0) {
      onChange([stores[0].id]);
    }
  }, [stores]);

  const toggleStore = (storeId: string) => {
    if (selectedStoreIds.includes(storeId)) {
      onChange(selectedStoreIds.filter(id => id !== storeId));
    } else {
      onChange([...selectedStoreIds, storeId]);
    }
  };

  const selectAll = () => {
    onChange(stores.map(s => s.id));
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
          <Store className="w-8 h-8 text-sky-500" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Select stores
        </h2>
        <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Choose which stores carry this product. You can select multiple.
        </p>
      </div>

      {/* Select All button */}
      {stores.length > 1 && (
        <div style={floatIn(150, visible)} className="mb-3">
          <button
            onClick={selectAll}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-[0.98] ${
              selectedStoreIds.length === stores.length
                ? isDark ? 'bg-sky-500/20 text-sky-400' : 'bg-sky-100 text-sky-600'
                : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {selectedStoreIds.length === stores.length ? 'All selected' : 'Select all stores'}
          </button>
        </div>
      )}

      {/* Store list */}
      <div style={floatIn(200, visible)} className="space-y-2 flex-1 overflow-y-auto pb-4">
        {stores.map(store => {
          const isSelected = selectedStoreIds.includes(store.id);
          return (
            <button
              key={store.id}
              onClick={() => toggleStore(store.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all active:scale-[0.98] border ${
                isSelected
                  ? isDark
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-sky-500 bg-sky-50'
                  : isDark
                    ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              {/* Checkbox */}
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                isSelected
                  ? 'border-sky-500 bg-sky-500'
                  : isDark ? 'border-slate-600' : 'border-slate-300'
              }`}>
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>

              {/* Store info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${
                  isSelected
                    ? 'text-sky-500'
                    : isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {store.store_name}
                </p>
                <p className={`text-[11px] truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {[store.locality, store.city].filter(Boolean).join(', ') || store.address}
                </p>
                {store.store_category && (
                  <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                    {store.store_category}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected count */}
      {selectedStoreIds.length > 0 && (
        <p className={`text-xs text-center mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {selectedStoreIds.length} {selectedStoreIds.length === 1 ? 'store' : 'stores'} selected
        </p>
      )}

      {/* Navigation */}
      <div style={floatIn(300, visible)} className="mt-auto pb-8 flex gap-3">
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
