
import React, { useMemo } from 'react';
import { Deal } from './types';
import { Zap, MapPin, Calendar, Clock, Sparkles, Flame, TrendingUp } from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';

interface DealOfTheDayPageProps {
  deals: Deal[];
  loading: boolean;
  onSelectDeal: (deal: Deal) => void;
  onAdjustLocation: () => void;
  onViewAllDeals?: () => void; // NEW: Callback to view all deals in city
  locationLabel: string;
  cityName?: string; // NEW: City name for "View All Deals" button
  theme: 'light' | 'dark';
}

export const DealOfTheDayPage: React.FC<DealOfTheDayPageProps> = ({
  deals,
  loading,
  onSelectDeal,
  onAdjustLocation,
  onViewAllDeals,
  locationLabel,
  cityName,
  theme
}) => {
  const { t, locale } = useTranslation();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = React.useState<'live' | 'upcoming'>('live');

  // Group deals by date (today vs future)
  const { todayDeals, upcomingDeals } = useMemo(() => {
    // Get today's date in YYYY-MM-DD format to avoid timezone issues
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const todayList: Deal[] = [];
    const upcomingList: Deal[] = [];

    deals.forEach(deal => {
      // Extract date part from start_date (YYYY-MM-DD)
      const dealDateStr = deal.start_date.split('T')[0];

      if (dealDateStr === todayStr) {
        todayList.push(deal);
      } else if (dealDateStr > todayStr) {
        upcomingList.push(deal);
      }
    });

    // Sort upcoming by date
    upcomingList.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    return { todayDeals: todayList, upcomingDeals: upcomingList };
  }, [deals]);

  const getLocalizedText = (field: any, fallback: string) => {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    return field[locale] || field['en'] || fallback;
  };

  const formatDate = (dateString: string) => {
    // Extract date parts to avoid timezone issues
    const [year, month, day] = dateString.split('T')[0].split('-');
    // Create date in local timezone by specifying year, month (0-indexed), day
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'en-GB', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const DealCard: React.FC<{ deal: Deal; isFuture: boolean }> = ({ deal, isFuture }) => (
    <div
      onClick={() => onSelectDeal(deal)}
      className="group relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 rounded-[2.5rem] overflow-hidden border border-yellow-500/30 shadow-xl hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300 cursor-pointer active:scale-[0.98]"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #eab308 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      </div>

      {/* Status Badge */}
      <div className="absolute top-4 right-4 z-10">
        {isFuture ? (
          <div className="px-3 py-1.5 rounded-xl bg-blue-500/90 backdrop-blur-md border border-white/20 text-white text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Coming Soon
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 backdrop-blur-md border border-white/20 text-white text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1.5 animate-pulse">
            <Flame className="w-3 h-3 fill-white" />
            Live Now
          </div>
        )}
      </div>

      {/* Deal Image */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={deal.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80'}
          alt={getLocalizedText(deal.localized_heading, deal.deal_heading)}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={(e) => {
            e.currentTarget.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';
          }}
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
      </div>

      {/* Deal Content */}
      <div className="relative p-6 space-y-4">
        {/* Shop Name */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
            <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          </div>
          <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
            {getLocalizedText(deal.localized_shop_name, deal.shop_name)}
          </span>
        </div>

        {/* Deal Title */}
        <h3 className="text-xl font-black text-white leading-tight line-clamp-2">
          {getLocalizedText(deal.localized_heading, deal.deal_heading)}
        </h3>

        {/* Offer Value */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30">
          <Sparkles className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-sm font-black text-yellow-300 uppercase tracking-wide">
            {getLocalizedText(deal.localized_offer, deal.offer_value)}
          </span>
        </div>

        {/* Location & Date */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <div className={`flex items-center gap-2 ${isFuture ? 'text-green-400' : 'text-slate-400'}`}>
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              {deal.city || 'Near you'}
            </span>
          </div>
          <div className={`flex items-center gap-2 ${isFuture ? 'text-green-400' : 'text-slate-400'}`}>
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">
              {formatDate(deal.start_date)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 border-4 border-yellow-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-yellow-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Loading Deals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 pb-32 pt-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-xl shadow-yellow-500/30">
            <Zap className="w-7 h-7 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white leading-none">
              Deal of the Day
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Featured daily offers</p>
          </div>
        </div>

        {/* Location Info */}
        <button
          onClick={onAdjustLocation}
          className="w-full p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between group hover:border-yellow-500/30 transition-all"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-yellow-500" />
            <div className="text-left">
              <p className="text-[9px] text-slate-500 uppercase tracking-wider">Your Location</p>
              <p className="text-sm font-bold text-white">{locationLabel}</p>
            </div>
          </div>
          <TrendingUp className="w-4 h-4 text-slate-500 group-hover:text-yellow-500 transition-colors" />
        </button>

        {/* View All Deals in City Button */}
        {cityName && onViewAllDeals && (
          <button
            onClick={onViewAllDeals}
            className="w-full mt-4 p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-between group hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-[9px] text-blue-300 uppercase tracking-wider font-bold">Explore More</p>
                <p className="text-sm font-black text-white">All Deals in {cityName}</p>
              </div>
            </div>
            <TrendingUp className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 p-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all ${
            activeTab === 'live'
              ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-xl shadow-orange-500/30'
              : 'glass text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Flame className={`w-4 h-4 ${activeTab === 'live' ? 'fill-white' : ''}`} />
            Live
            {todayDeals.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === 'live' ? 'bg-white/20' : 'bg-orange-500 text-white'
              }`}>
                {todayDeals.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 p-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all ${
            activeTab === 'upcoming'
              ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-xl shadow-blue-500/30'
              : 'glass text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Upcoming
            {upcomingDeals.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === 'upcoming' ? 'bg-white/20' : 'bg-blue-500 text-white'
              }`}>
                {upcomingDeals.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Live Tab Content */}
      {activeTab === 'live' && (
        <>
          {todayDeals.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 mb-8">
              {todayDeals.map((deal) => (
                <DealCard key={deal.campaign_id} deal={deal} isFuture={false} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-3xl bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700/50">
                <Flame className="w-12 h-12 text-slate-600" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">No Live Deals Today</h3>
              <p className="text-sm text-slate-400 text-center max-w-xs">
                Check the Upcoming tab for future deals!
              </p>
            </div>
          )}
        </>
      )}

      {/* Upcoming Tab Content */}
      {activeTab === 'upcoming' && (
        <>
          {upcomingDeals.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 mb-8">
              {upcomingDeals.map((deal) => (
                <DealCard key={deal.campaign_id} deal={deal} isFuture={true} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-24 h-24 rounded-3xl bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700/50">
                <Clock className="w-12 h-12 text-slate-600" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">No Upcoming Deals</h3>
              <p className="text-sm text-slate-400 text-center max-w-xs">
                Check back soon for exciting future deals!
              </p>
            </div>
          )}
        </>
      )}

      {/* Empty State - Show only when both tabs are empty */}
      {todayDeals.length === 0 && upcomingDeals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-24 h-24 rounded-3xl bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700/50">
            <Zap className="w-12 h-12 text-slate-600" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">No Deals Available</h3>
          <p className="text-sm text-slate-400 text-center max-w-xs mb-6">
            Check back soon for amazing daily deals in your area!
          </p>
          <button
            onClick={onAdjustLocation}
            className="px-6 py-3 rounded-2xl bg-yellow-500 text-slate-900 font-black text-sm uppercase tracking-wider shadow-xl shadow-yellow-500/30 hover:bg-yellow-400 transition-all active:scale-95"
          >
            Adjust Location
          </button>
        </div>
      )}
    </div>
  );
};
