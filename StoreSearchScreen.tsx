
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppView, MerchantSearchStore } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { merchantService } from './services/merchantService';
import { Search, Store, Loader2, MapPin, X, ChevronLeft, Cloud, AlertTriangle } from 'lucide-react';

interface StoreSearchScreenProps {
  theme: 'light' | 'dark';
  setView: (view: AppView) => void;
  setSelectedStoreIdForSearch: (storeId: string | null) => void;
  setSelectedStoreNameForSearch: (storeName: string | null) => void;
}

export const StoreSearchScreen: React.FC<StoreSearchScreenProps> = ({
  theme,
  setView,
  setSelectedStoreIdForSearch,
  setSelectedStoreNameForSearch,
}) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<MerchantSearchStore[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const debounceTimeout = useRef<number | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setSearchError(null);
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    if (e.target.value.length >= 2) {
      debounceTimeout.current = setTimeout(() => fetchSuggestions(e.target.value), 300);
    } else {
      setSuggestions([]);
    }
  };

  const fetchSuggestions = useCallback(async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const result = await merchantService.searchStores(query);
      setSuggestions(result);
    } catch (err: any) {
      console.error("Store search failed:", err);
      setSearchError(err.message || "Failed to fetch store suggestions.");
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectStore = (store: MerchantSearchStore) => {
    setSelectedStoreIdForSearch(store.id);
    setSelectedStoreNameForSearch(store.store_name);
    setView('home'); // Navigate to home to display deals for this store
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSuggestions([]);
    setSearchError(null);
    setSelectedStoreIdForSearch(null); // Clear any active store filter
    setSelectedStoreNameForSearch(null);
    setView('home'); // Go back to regular deal view
  };

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal space-y-8 max-w-lg mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('store_search_title')}<br /><span className="text-yellow-500">{t('store_search_sub')}</span>
          </h2>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">{t('store_search_hint')}</p>
        </div>
        <button onClick={() => setView('home')} className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-white/10 active:scale-90 transition-transform">
          <ChevronLeft className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      <div className={`glass p-6 rounded-[3rem] border ${isDark ? 'border-white/10 bg-slate-900/40' : 'border-slate-200 bg-white/80'} shadow-2xl`}>
        <div className="relative group mb-6">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-yellow-500 transition-colors" />
          <input
            type="text"
            placeholder={t('store_search_placeholder')}
            className="input-premium pl-14 pr-14"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {isSearching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-500 animate-spin" />
          )}
          {searchTerm.length > 0 && !isSearching && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {searchError && (
          <div className="mb-4 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{searchError}</span>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className={`max-h-64 overflow-y-auto hide-scrollbar space-y-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {suggestions.map((store) => (
              <button
                key={store.id}
                onClick={() => handleSelectStore(store)}
                className={`w-full text-left p-4 rounded-xl flex items-center gap-4 transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200'}`}
              >
                <Store className="w-5 h-5 text-blue-500 shrink-0" />
                <div>
                  <p className="font-bold text-sm leading-tight">{store.store_name}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {store.address}, {store.city}, {store.state}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {searchTerm.length >= 2 && !isSearching && suggestions.length === 0 && !searchError && (
          <div className="text-center py-8">
            <Cloud className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-700' : 'text-slate-400'}`} />
            <p className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('store_search_no_results')}</p>
            <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-500'} mt-2`}>{t('store_search_adjust_query')}</p>
          </div>
        )}

        <button 
          onClick={handleClearSearch}
          className="w-full text-center text-blue-500 text-[10px] font-black uppercase tracking-widest mt-8 hover:text-blue-400 active:scale-95 transition-all"
        >
          <X className="w-3 h-3 inline-block mr-2" /> Clear Search
        </button>
      </div>
    </div>
  );
};
