
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, MapPin as MapPinIcon, Cloud, Zap, Compass, Star, Clock, Tag, Sparkles, Filter, Store } from 'lucide-react';
import { Deal, AppView, User } from './types'; // Import User type
import { useTranslation } from './contexts/LanguageContext';
import { addCampaignService } from './services/addCampaignService'; // Import addCampaignService to fetch categories
import { ConsumerProfile } from './consumerProfile';

interface DealsMainPageProps {
  view: string;
  deals: Deal[]; // These deals are now pre-filtered by ConsumerStack/server
  loading: boolean;
  userCoords: { latitude: number; longitude: number } | null;
  searchRadius: number;
  locationLabel: string;
  onSelectDeal: (deal: Deal) => void;
  onAdjustLocation: () => void;
  onCitySearch?: (city: string) => void;
  isCityFilterActive?: boolean;
  user?: User; // Use the updated User type
  setUser?: (user: User) => void; // Use the updated User type
  setView?: (view: AppView) => void;
  onVerificationHubClick?: () => void; // Added for consumerProfile
  onShowCityDeals: (city: string) => void;
  cityForFilterButton: string | null; // NEW: Explicit city name for the button
  selectedStoreNameForSearch: string | null; // NEW: Prop for selected store name
  theme?: 'dark' | 'light';
}

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

const formatExpiryDate = (dateStr?: string) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const currentYear = new Date().getFullYear();
    const expiryYear = date.getFullYear();

    if (expiryYear === currentYear) {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } else {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch (e) {
    return null;
  }
};

export const DealsMainPage: React.FC<DealsMainPageProps> = ({
  view, deals, loading, userCoords, searchRadius, locationLabel, onSelectDeal, onAdjustLocation, onCitySearch, isCityFilterActive, user, setUser, setView, onVerificationHubClick,
  onShowCityDeals,
  cityForFilterButton,
  selectedStoreNameForSearch, // Destructure new prop
  theme
}) => {
  const [internalActiveView, setInternalActiveView] = useState<string>(view);
  const { t, getLocalizedText } = useTranslation();

  const [availableCategories, setAvailableCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [isViewingSpecificCity, setIsViewingSpecificCity] = useState(false); 

  useEffect(() => {
    setInternalActiveView(view);
  }, [view]);

  // Sync internal isViewingSpecificCity with parent's cityFilter status
  useEffect(() => {
    setIsViewingSpecificCity(!!isCityFilterActive);
  }, [isCityFilterActive]);


  // Fetch categories when component mounts
  useEffect(() => {
    const fetchCategories = async () => {
      setIsCategoriesLoading(true);
      try {
        const fetched = await addCampaignService.getStoreCategories();
        setAvailableCategories(['All', ...fetched]);
      } catch (err) {
        console.error("Error fetching store categories:", err);
        setAvailableCategories(['All']); // Fallback to just "All"
      } finally {
        setIsCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const filteredDeals = useMemo(() => {
    console.log('[DealsMainPage] Filtering deals:', {
      selectedCategory,
      totalDeals: deals.length,
      dealCategories: deals.map(d => ({ id: d.campaign_id, category: d.category }))
    });

    // First filter: Remove expired deals
    const now = new Date();
    const activeDeals = deals.filter(deal => {
      if (!deal.endDate) return true; // If no end date, include the deal
      const endDate = new Date(deal.endDate);
      return endDate >= now; // Only include deals that haven't expired
    });

    // Second filter: Category filter
    if (selectedCategory === 'All') {
      return activeDeals;
    }

    const filtered = activeDeals.filter(deal => {
      const matches = deal.category === selectedCategory;
      if (!matches) {
        console.log('[DealsMainPage] Category mismatch:', {
          dealId: deal.campaign_id,
          dealCategory: deal.category,
          selectedCategory
        });
      }
      return matches;
    });

    console.log('[DealsMainPage] Filtered result:', {
      selectedCategory,
      filteredCount: filtered.length,
      totalDeals: deals.length,
      activeDealsCount: activeDeals.length
    });

    return filtered;
  }, [deals, selectedCategory]);

  
  return (
    <div className="px-6 pt-6 pb-32 animate-reveal">
      {(view === 'home' || view === 'deals' || view === 'deals_of_day') && (
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">
              {selectedStoreNameForSearch ? selectedStoreNameForSearch : (view === 'deals_of_day' ? t('home_daily_waves') : t('home_deals'))}<br />
              <span className="text-blue-500">{selectedStoreNameForSearch ? t('home_deals') : (view === 'deals_of_day' ? '' : t('home_near_you'))}</span>
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">{t('home_your_sector')}</p>
            </div>
          </div>
          {/* Hide adjust location button if a specific store is selected */}
          {!selectedStoreNameForSearch && (
            <button onClick={onAdjustLocation} className="text-blue-500 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
              <Zap className="w-4 h-4 inline-block mr-1" />{locationLabel.toUpperCase()}
            </button>
          )}
        </div>
      )}

      {view === 'profile' && user && (
        <ConsumerProfile user={user} setUser={setUser!} setView={setView!} onVerificationHubClick={onVerificationHubClick} theme={theme} />
      )}

      {loading && (view === 'home' || view === 'deals' || view === 'deals_of_day') ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">{t('home_syncing_grid')}</p>
        </div>
      ) : (view === 'home' || view === 'deals' || view === 'deals_of_day') && deals.length === 0 ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-white/5 bg-slate-950/40">
          <Cloud className="w-16 h-16 text-slate-800 mx-auto mb-6" />
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">{t('home_no_deals_sector')}</p>
          <p className="text-xs font-bold text-slate-500 px-10">
            {selectedStoreNameForSearch 
              ? `No deals found for ${selectedStoreNameForSearch}.` 
              : "Try adjusting your search radius or location."}
          </p>
        </div>
      ) : (view === 'home' || view === 'deals' || view === 'deals_of_day') && (
        <div className="space-y-6">
          {/* NEW: Show all deals in City button (only if not filtering by store) */}
          {cityForFilterButton && !isViewingSpecificCity && !selectedStoreNameForSearch && (
            <button
              onClick={() => {
                onShowCityDeals(cityForFilterButton);
                setSelectedCategory('All'); // Reset category filter when applying city-wide filter
              }}
              className="w-full text-blue-500 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 mt-4 py-3 glass rounded-2xl border-white/10 bg-blue-500/5 shadow-inner"
            >
              <Compass className="w-4 h-4 inline-block" /> SHOW ALL DEALS IN {cityForFilterButton.toUpperCase()} CITY
            </button>
          )}

          {/* Category Filter - Added as requested */}
          <div className="relative group p-2 glass rounded-[2.5rem] border-white/10 bg-slate-900/40 shadow-inner">
            <div className="absolute top-2 left-5 flex items-center gap-2 text-slate-500">
              <Filter className="w-3 h-3" />
              <span className="text-[9px] font-black uppercase tracking-widest">Filter By Sector</span>
            </div>
            <div className="mt-8 flex overflow-x-auto hide-scrollbar gap-3 pb-2 px-1">
              {isCategoriesLoading ? (
                <div className="flex items-center justify-center w-full py-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                availableCategories.map(category => (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      // If a category is selected, the city-wide filter is implicitly deselected
                      if (isViewingSpecificCity) setIsViewingSpecificCity(false);
                    }}
                    className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95
                      ${selectedCategory === category
                        ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                  >
                    {category}
                  </button>
                ))
              )}
            </div>
          </div>
          {/* End Category Filter */}

          {/* Modified Grid Layout for Deals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDeals.map((deal) => (
              <div key={deal.campaign_id} onClick={() => onSelectDeal(deal)} className="deal-card group animate-reveal cursor-pointer">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-800"> {/* Smaller image area */}
                  <img 
                    src={deal.thumbnail || DEFAULT_DEAL_IMAGE} 
                    alt={deal.shopName} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    onError={(e) => {
                      e.currentTarget.src = "https://api.iconify.design/lucide:shopping-bag.svg?color=%233b82f6";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-blue-600/90 backdrop-blur-md border border-white/20 text-white text-[8px] font-black uppercase tracking-widest shadow-md">
                    {deal.category}
                  </div>
                  {deal.isDealOfTheDay && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-amber-500/90 backdrop-blur-md border border-white/20 text-white text-[8px] font-black uppercase tracking-widest shadow-md flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 fill-white" />DOTD
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1">{getLocalizedText(deal.localized_shop_name, deal.shopName)}</p>
                    <h3 className="text-sm font-black text-white leading-tight uppercase line-clamp-2">
                      {getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details)}
                    </h3>
                    <p className="text-amber-400 text-[9px] font-black uppercase tracking-widest mt-1">
                      {getLocalizedText(deal.localized_offer, deal.offer_value)}
                    </p>
                  </div>
                </div>
                <div className="p-3 flex items-center justify-between bg-white/5 border border-white/10 rounded-b-xl"> {/* Reduced padding and border-radius */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 glass rounded-md border-white/10"> {/* Reduced padding and border-radius */}
                    <Clock className="w-2.5 h-2.5 text-slate-500" /> {/* Smaller icon */}
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter"> {/* Smaller text */}
                      Valid Till {formatExpiryDate(deal.end_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 rounded-md"> {/* Reduced padding and border-radius */}
                    <Star className="w-2.5 h-2.5 text-blue-500" /> {/* Smaller icon */}
                    <span className="text-xs font-bold text-blue-400"> {/* Smaller text */}
                      {deal.rating && deal.rating > 0 ? deal.rating.toFixed(1) : 'NA'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <p className="text-[9px] font-black uppercase tracking-[0.6em] text-slate-700">GRID SECURE</p>
          </div>
        </div>
      )}
    </div>
  );
};