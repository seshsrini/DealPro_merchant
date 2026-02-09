
import React, { useMemo } from 'react';
import { Loader2, Heart, Cloud, MapPin, Sparkles, Activity, AlertCircle } from 'lucide-react';
import { Deal } from './types';
import { userService } from './services/userService'; // For toggling favorites
import { useTranslation } from './contexts/LanguageContext';

interface FavoritesViewProps {
  deals: Deal[];
  loading: boolean;
  onSelectDeal: (deal: Deal) => void;
  onToggleFavorite: (dealId: string) => void;
  theme?: 'dark' | 'light';
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  deals, loading, onSelectDeal, onToggleFavorite, theme = 'dark'
}) => {
  const { t, getLocalizedText } = useTranslation();
  const isDark = theme === 'dark';

  // Sort: active (live) on top, expired at the bottom.
  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const statusA = (a.status || 'active').toLowerCase();
      const statusB = (b.status || 'active').toLowerCase();
      
      if (statusA === statusB) return 0;
      if (statusA === 'active') return -1;
      if (statusB === 'active') return 1;
      return 0;
    });
  }, [deals]);

  return (
    <div className="px-6 pt-6 animate-reveal pb-32">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
            <Heart className="w-5 h-5 text-rose-500 fill-current" />
          </div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('favorites_title_1') || 'Your'}<br/><span className="text-yellow-500">{t('favorites_title_2') || 'Favorites'}</span>
          </h2>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1">
          {t('favorites_sub') || 'Access your saved deals anytime'}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <Heart className="w-4 h-4 text-rose-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">
            {t('favorites_syncing') || 'Syncing Vault Data'}
          </p>
        </div>
      ) : sortedDeals.length === 0 ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-white/5 bg-slate-950/40">
          <Cloud className="w-16 h-16 text-slate-800 mx-auto mb-6" />
          <p className="text-xl font-black text-slate-500 uppercase tracking-tighter mb-2">
            {t('favorites_empty_title') || 'Vault Empty'}
          </p>
          <p className="text-xs font-bold text-slate-600 px-10">
            {t('favorites_empty_sub') || 'Capture exclusive deals by tapping the heart icon in discovery mode.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {sortedDeals.map((deal) => {
            const isLive = (deal.status || 'active').toLowerCase() === 'active';
            
            // RESOLVE FULL TRANSLATIONS
            const shopName = deal.shopName;
            const heading = getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details); // Fix: Use deal_heading
            const gridOffer = getLocalizedText(deal.localized_offer, deal.offer_value); // Fix: Use deal_offer

            return (
              <div key={deal.campaign_id} onClick={() => onSelectDeal(deal)} className="deal-card group animate-reveal relative cursor-pointer overflow-hidden border-rose-500/10 bg-slate-900/20">
                {/* Un-favorite Toggle */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(deal.campaign_id); // Fix: Use campaign_id
                  }}
                  className="absolute top-6 right-6 z-20 w-11 h-11 glass rounded-2xl flex items-center justify-center border-rose-500/30 text-rose-500 shadow-2xl active:scale-90 transition-transform"
                >
                  <Heart className="w-5 h-5 fill-current" />
                </button>

                <div className="relative aspect-[16/10] overflow-hidden">
                  <img src={deal.thumbnail} alt={shopName} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${!isLive ? 'grayscale' : ''}`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                  
                  <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                    <div className="px-4 py-2 glass backdrop-blur-3xl rounded-xl border-white/10 text-[10px] font-black uppercase tracking-widest text-white shadow-2xl">
                      {deal.category}
                    </div>
                    
                    {isLive ? (
                      <div className="px-3 py-2 bg-emerald-600/90 backdrop-blur-md rounded-xl text-[8px] font-black uppercase tracking-widest text-white shadow-xl flex items-center gap-1.5 border border-emerald-500/20">
                        <Activity className="w-3 h-3 animate-pulse" />
                        {t('status_live') || 'Live'}
                      </div>
                    ) : (
                      <div className="px-3 py-2 bg-rose-600/90 backdrop-blur-md rounded-xl text-[8px] font-black uppercase tracking-widest text-white shadow-xl flex items-center gap-1.5 border border-rose-500/20">
                        <AlertCircle className="w-3 h-3" />
                        {t('status_expired') || 'Expired'}
                      </div>
                    )}
                  </div>

                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex flex-col gap-1 items-start mb-2">
                      <p className={`text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 ${isLive ? 'text-rose-500' : 'text-slate-500'}`}>
                        <Sparkles className={`w-3 h-3 ${isLive ? 'fill-current' : ''}`} /> {shopName}
                      </p>
                      {gridOffer && (
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                          {gridOffer}
                        </span>
                      )}
                    </div>
                    <h3 className={`text-xl font-black leading-tight mb-3 truncate ${isLive ? 'text-white' : 'text-slate-500'}`}>
                      {heading}
                    </h3>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 px-3 py-1 glass rounded-lg border-white/5 w-fit">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-300">
                          {deal.location}
                        </span>
                      </div>
                      {deal.endDate && (
                        <div className="px-3 py-1 glass rounded-lg border-white/5 w-fit">
                          <span className="text-[10px] font-bold text-slate-400">
                            Ends: {new Date(deal.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};