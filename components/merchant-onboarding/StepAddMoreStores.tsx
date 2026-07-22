import React, { useState, useEffect } from 'react';
import { MapPin, Plus, ArrowRight, Trash2 } from 'lucide-react';
import { StoreLocation } from '../../types';
import { floatIn } from './floatIn';
import { useTranslation } from '../../contexts/LanguageContext';

interface StepAddMoreStoresProps {
  stores: StoreLocation[];
  brandName: string;
  onAddStore: () => void;
  /** Remove a store from the list. Omit to hide the delete affordance. */
  onDeleteStore?: (index: number) => void;
  onNext: () => void;
  onBack?: () => void;
  theme: 'light' | 'dark';
}

export const StepAddMoreStores: React.FC<StepAddMoreStoresProps> = ({
  stores, brandName, onAddStore, onDeleteStore, onNext, onBack, theme
}) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  // Index awaiting delete confirmation. Deleting a store the merchant just typed
  // an address into is destructive and there's no undo, so the trash icon arms
  // first and only the second tap removes it.
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6">
        <MapPin className="w-8 h-8 text-purple-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('ob_stores_title')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {stores.length === 1 ? t('ob_stores_sub_one') : t('ob_stores_sub_many').replace('{n}', String(stores.length))}
      </p>

      {/* Store summary cards */}
      <div className="space-y-3 mb-6 overflow-y-auto max-h-[40vh]">
        {stores.map((s, i) => (
          <div
            key={i}
            style={floatIn(300 + i * 80, visible)}
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {s.store_name || brandName || t('ob_store_fallback').replace('{n}', String(i + 1))}
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {[s.street, s.locality, s.city, s.state].filter(Boolean).join(', ')}
              </p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {s.is24hrs ? t('ob_addr_open24') : `${s.shift1} - ${s.shift2}`}
              </p>
            </div>
            {/* Delete — hidden when only one store remains, since signup needs at least one */}
            {onDeleteStore && stores.length > 1 && (
              <button
                onClick={() => {
                  if (confirmIndex === i) {
                    onDeleteStore(i);
                    setConfirmIndex(null);
                  } else {
                    setConfirmIndex(i);
                  }
                }}
                onBlur={() => setConfirmIndex(prev => (prev === i ? null : prev))}
                aria-label={t('ob_stores_remove')}
                className={`shrink-0 rounded-lg transition-all active:scale-95 flex items-center gap-1 ${
                  confirmIndex === i
                    ? 'px-2.5 py-1.5 text-[11px] font-semibold bg-red-500 text-white'
                    : `p-2 ${isDark ? 'text-slate-500 hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`
                }`}
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                {confirmIndex === i && t('ob_stores_remove')}
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onAddStore}
        style={floatIn(500, visible)}
        className={`w-full h-12 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 text-sm font-medium transition-all active:scale-[0.98] mb-4 ${
          isDark
            ? 'border-slate-700 text-slate-400 hover:border-slate-500'
            : 'border-slate-300 text-slate-500 hover:border-slate-400'
        }`}
      >
        <Plus className="w-4 h-4" />
        {t('ob_stores_add')}
      </button>

      <div style={floatIn(600, visible)} className="mt-auto pb-safe-bottom flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t('ob_back')}
          </button>
        )}
        <button
          onClick={onNext}
          className="flex-1 h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {t('ob_continue')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
