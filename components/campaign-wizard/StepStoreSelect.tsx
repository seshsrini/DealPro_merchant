import React, { useEffect, useState } from 'react';
import { MapPin, Check } from 'lucide-react';
import { floatIn } from './floatIn';
import { useTranslation } from '../../contexts/LanguageContext';

interface MerchantStore {
  id?: string;
  store_name: string;
  address: string;
  city: string;
  state?: string;
  store_category?: string;
  latitude?: number;
  longitude?: number;
}

interface StepStoreSelectProps {
  stores: MerchantStore[];
  selectedStoreId: string;
  onChange: (storeId: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepStoreSelect: React.FC<StepStoreSelectProps> = ({
  stores, selectedStoreId, onChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const isValid = !!selectedStoreId;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auto-select if only one store
  useEffect(() => {
    if (stores.length === 1 && stores[0].id && !selectedStoreId) {
      onChange(stores[0].id);
    }
  }, [stores, selectedStoreId, onChange]);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
        <MapPin className="w-8 h-8 text-rose-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_select_store')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_choose_store')}
      </p>

      <div style={floatIn(300, visible)} className="space-y-3 flex-1 overflow-y-auto max-h-[50vh]">
        {stores.map((store, i) => {
          const isSelected = selectedStoreId === store.id;
          return (
            <button
              key={store.id || i}
              onClick={() => store.id && onChange(store.id)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                isSelected
                  ? isDark
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-blue-500 bg-blue-50'
                  : isDark
                    ? 'border-slate-700 hover:border-slate-600'
                    : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-sm truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {store.store_name}
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {store.address}, {store.city}
                  </p>
                  {store.state && (
                    <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {store.state}
                    </p>
                  )}
                  {store.store_category && (
                    <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                      isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {store.store_category}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shrink-0 ml-3">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {stores.length === 0 && (
          <div className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <p className="text-sm">{t('m_no_stores')}</p>
          </div>
        )}
      </div>

      <div style={floatIn(400, visible)} className="mt-auto pt-6 pb-8 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t('m_back')}
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('m_continue')}
        </button>
      </div>
    </div>
  );
};
