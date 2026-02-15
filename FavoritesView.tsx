
import React, { useMemo, useState } from 'react';
import { Loader2, Heart, Cloud, MapPin, Sparkles, Activity, AlertCircle, Pin } from 'lucide-react';
import { Deal } from './types';
import { pinnedDealsService } from './services/pinnedDealsService'; // For unpinning deals
import { useTranslation } from './contexts/LanguageContext';

interface FavoritesViewProps {
  deals: Deal[];
  loading: boolean;
  onSelectDeal: (deal: Deal) => void;
  onToggleFavorite: (dealId: string) => void;
  theme?: 'dark' | 'light';
  user: any; // Add user prop for fetching pinned deals
  pinnedDeals: any[]; // NEW: Pinned deals from parent
  updatePinnedDeals: () => void; // NEW: Function to refresh pinned deals
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  deals, loading, onSelectDeal, onToggleFavorite, theme = 'dark', user, pinnedDeals, updatePinnedDeals
}) => {
  const { t, getLocalizedText } = useTranslation();
  const isDark = theme === 'dark';

  // Tab state
  const [activeTab, setActiveTab] = useState<'favorites' | 'pinned'>('favorites');

  // Debug logging
  console.log('[FavoritesView] Rendered with:', {
    activeTab,
    pinnedDealsCount: pinnedDeals?.length || 0,
    pinnedDeals: pinnedDeals,
    favoritesCount: deals?.length || 0,
    loading,
    userId: user?.id
  });

  // Sort favorites by creation date if available, otherwise by status
  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      // Sort by created_at if available (newest first)
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      // Fallback: active (live) on top, expired at the bottom.
      const statusA = (a.status || 'active').toLowerCase();
      const statusB = (b.status || 'active').toLowerCase();

      if (statusA === statusB) return 0;
      if (statusA === 'active') return -1;
      if (statusB === 'active') return 1;
      return 0;
    });
  }, [deals]);

  // Handle unpin
  const handleUnpin = async (campaignId: string) => {
    if (!user?.id) return;

    try {
      await pinnedDealsService.unpinDeal(user.id, campaignId);
      // Refresh pinned deals list
      updatePinnedDeals();
    } catch (error) {
      console.error('[FavoritesView] Error unpinning deal:', error);
    }
  };

  const currentDeals = activeTab === 'favorites' ? sortedDeals : pinnedDeals;
  const isLoading = loading; // Use parent loading state

  return (
    <div className="px-6 pt-6 animate-reveal pb-32">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${
            activeTab === 'favorites'
              ? 'bg-rose-500/10 border-rose-500/20'
              : 'bg-blue-500/10 border-blue-500/20'
          }`}>
            {activeTab === 'favorites' ? (
              <Heart className="w-5 h-5 text-rose-500 fill-current" />
            ) : (
              <Pin className="w-5 h-5 text-blue-500 fill-current" />
            )}
          </div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('favorites_title_1') || 'Your'}<br/>
            <span className={activeTab === 'favorites' ? 'text-rose-500' : 'text-blue-500'}>
              {activeTab === 'favorites' ? (t('favorites_title_2') || 'Favorites') : 'Pinned'}
            </span>
          </h2>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1">
          {activeTab === 'favorites'
            ? (t('favorites_sub') || 'Access your saved deals anytime')
            : 'Your pinned deals for quick reference'
          }
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 px-6 py-4 rounded-2xl font-black uppercase text-sm tracking-wider transition-all border-2 ${
            activeTab === 'favorites'
              ? 'bg-gradient-to-r from-rose-500/20 to-pink-500/20 border-rose-500/50 text-rose-400 shadow-lg shadow-rose-500/20'
              : 'glass border-white/10 text-slate-500 hover:border-rose-500/30'
          }`}
        >
          <Heart className={`w-5 h-5 inline-block mr-2 ${activeTab === 'favorites' ? 'fill-current' : ''}`} />
          Favorites
        </button>
        <button
          onClick={() => setActiveTab('pinned')}
          className={`flex-1 px-6 py-4 rounded-2xl font-black uppercase text-sm tracking-wider transition-all border-2 ${
            activeTab === 'pinned'
              ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-500/50 text-blue-400 shadow-lg shadow-blue-500/20'
              : 'glass border-white/10 text-slate-500 hover:border-blue-500/30'
          }`}
        >
          <Pin className={`w-5 h-5 inline-block mr-2 ${activeTab === 'pinned' ? 'fill-current' : ''}`} />
          Pinned
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <Loader2 className={`w-12 h-12 animate-spin ${
              activeTab === 'favorites' ? 'text-rose-500' : 'text-blue-500'
            }`} />
            {activeTab === 'favorites' ? (
              <Heart className="w-4 h-4 text-rose-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            ) : (
              <Pin className="w-4 h-4 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            )}
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">
            {t('favorites_syncing') || 'Syncing Vault Data'}
          </p>
        </div>
      ) : currentDeals.length === 0 ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-white/5 bg-slate-950/40">
          <Cloud className="w-16 h-16 text-slate-800 mx-auto mb-6" />
          <p className="text-xl font-black text-slate-500 uppercase tracking-tighter mb-2">
            {activeTab === 'favorites'
              ? (t('favorites_empty_title') || 'Vault Empty')
              : 'No Pinned Deals'
            }
          </p>
          <p className="text-xs font-bold text-slate-600 px-10">
            {activeTab === 'favorites'
              ? (t('favorites_empty_sub') || 'Capture exclusive deals by tapping the heart icon in discovery mode.')
              : 'Pin deals you want to reference later by tapping the pin icon.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {activeTab === 'favorites' ? (
            // FAVORITES TAB
            sortedDeals.map((deal) => {
              const isLive = (deal.status || 'active').toLowerCase() === 'active';

              // RESOLVE FULL TRANSLATIONS
              const shopName = deal.shopName;
              const heading = getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details);
              const gridOffer = getLocalizedText(deal.localized_offer, deal.offer_value);

              return (
                <div key={deal.campaign_id} onClick={() => onSelectDeal(deal)} className="deal-card group animate-reveal relative cursor-pointer overflow-hidden border-rose-500/10 bg-slate-900/20">
                  {/* Un-favorite Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(deal.campaign_id);
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
            })
          ) : (
            // PINNED TAB
            pinnedDeals.map((pin) => {
              const deal = pin.campaigns;
              if (!deal) return null;

              const isLive = (deal.status || 'active').toLowerCase() === 'active';
              const shopName = deal.shop_name;
              const heading = deal.deal_heading;
              const gridOffer = deal.offer_value;

              return (
                <div key={pin.id} onClick={() => onSelectDeal({ ...deal, campaign_id: pin.campaign_id })} className="deal-card group animate-reveal relative cursor-pointer overflow-hidden border-blue-500/10 bg-slate-900/20">
                  {/* Unpin Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnpin(pin.campaign_id);
                    }}
                    className="absolute top-6 right-6 z-20 w-11 h-11 glass rounded-2xl flex items-center justify-center border-blue-500/30 text-blue-500 shadow-2xl active:scale-90 transition-transform"
                  >
                    <Pin className="w-5 h-5 fill-current" />
                  </button>

                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img src={deal.image_url} alt={shopName} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${!isLive ? 'grayscale' : ''}`} />
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
                        <p className={`text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-1.5 ${isLive ? 'text-blue-500' : 'text-slate-500'}`}>
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
                            {deal.city}
                          </span>
                        </div>
                        <div className="px-3 py-1 glass rounded-lg border-white/5 w-fit">
                          <span className="text-[9px] font-bold text-blue-400">
                            Pinned: {new Date(pin.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
