
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from './contexts/LanguageContext';
import { AppView, Deal } from './types';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { merchantService } from './services/merchantService';
import { mDashboardService } from './services/mDashboardService';
import { perfTimer } from './services/perfLogger';
import { NotificationBadge } from './components/NotificationBadge';
import { getUpcomingFestivals, getDaysUntilDate, FestivalEvent } from './components/festivalCalendar';
import {
  Store,
  Plus,
  QrCode,
  Zap,
  Megaphone,
  AlertCircle,
  ChevronRight,
  Package,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  Clock,
  MousePointer2,
  TicketCheck,
  X,
  Film,
  Calendar,
  MapPin,
  Edit2,
} from 'lucide-react';

type CampaignTab = 'active' | 'expired';

interface MerchantDashboardProps {
  view: AppView;
  setView: (view: AppView) => void;
  user: any;
  setUser: (user: any) => void;
  deals: Deal[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  theme: 'light' | 'dark';
  refreshDeals: () => Promise<void>;
  setDealIdToEdit: (id: string | null) => void;
  onClearDealIdToEdit: () => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  setPreSelectedTab?: (tab: CampaignTab | null) => void;
}


const getBannerThemeClasses = (themeKey: string, isDark: boolean) => {
  switch (themeKey) {
    case 'indianFlag':
      return 'indian-flag-banner';
    case 'diwaliColors':
      return isDark ? 'diwali-banner-dark' : 'diwali-banner-light';
    case 'holiColors':
      return isDark ? 'holi-banner-dark' : 'holi-banner-light';
    case 'christmasColors':
      return isDark ? 'christmas-banner-dark' : 'christmas-banner-light';
    default:
      return isDark ? 'default-banner-dark' : 'default-banner-light';
  }
};

const getGreetingKey = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'm_greet_morning';
  if (hour < 17) return 'm_greet_afternoon';
  return 'm_greet_evening';
};


// --- Circular progress ring ---
const UsageRing: React.FC<{
  used: number;
  limit: number;
  color: string;
  bgColor: string;
  size?: number;
}> = ({ used, limit, color, bgColor, size = 52 }) => {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={bgColor}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
};

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({
  view, setView, user, setUser, deals, loading, setLoading, theme, refreshDeals,
  setDealIdToEdit, onClearDealIdToEdit, isScanning, setIsScanning,
  setPreSelectedTab
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const [campaignUsage, setCampaignUsage] = useState({
    campaigns_used: 0,
    campaigns_limit: 0,
    dotd_used: 0,
    dotd_limit: 0,
    has_subscription: false,
  });

  const [upcomingEvents, setUpcomingEvents] = useState<FestivalEvent[]>([]);

  // Per-deal click & redemption counts
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [redeemCounts, setRedeemCounts] = useState<Record<string, number>>({});
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const getDealImage = (deal: Deal) => (deal as any).image_url || deal.thumbnail || '';

  const activeDeals = useMemo(() => {
    return deals
      .filter(d => d.status === 'active' || d.status === 'approved')
      .sort((a, b) => (b.campaign_id || '').localeCompare(a.campaign_id || ''))
      .slice(0, 5);
  }, [deals]);

  const totalActiveDeals = useMemo(() => deals.filter(d => d.status === 'active' || d.status === 'approved').length, [deals]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fetchCampaignUsage = async () => {
      const timer = perfTimer('load_merchant_dashboard', 'merchant_dashboard');
      try {
        timer.mark('campaign_usage_call');
        const usage = await merchantSubscriptionService.getCampaignUsage(user.id);
        setCampaignUsage(usage);
        timer.end('campaign_usage_done');
      } catch (err) {
        console.error("[MerchantDashboard] Error fetching campaign usage:", err);
        timer.end('error');
      }
    };

    if (user?.id) {
      fetchCampaignUsage();
    }
  }, [user?.id, deals]);

  // Fetch per-deal clicks & redemptions for active deals
  useEffect(() => {
    if (!activeDeals.length || !user?.id) return;
    const timer = perfTimer('load_campaign_stats', 'merchant_dashboard');
    const ids = activeDeals.map(d => d.campaign_id);
    timer.mark('clicks_redemptions_call');
    Promise.all([
      mDashboardService.getCampaignSpecificClicks(ids),
      mDashboardService.getCampaignSpecificRedemptions(user.id, ids),
    ]).then(([clicks, redemptions]) => {
      setClickCounts(clicks);
      setRedeemCounts(redemptions);
      timer.end('stats_rendered');
    }).catch(() => { timer.end('error'); });
  }, [activeDeals, user?.id]);

  // Fetch merchant stores → extract states → compute upcoming festivals
  useEffect(() => {
    if (!user?.id) return;
    const timer = perfTimer('load_merchant_stores', 'merchant_dashboard');
    timer.mark('stores_call');
    merchantService.getMerchantStores(user.id).then(stores => {
      const states = [...new Set((stores || []).map(s => s.state).filter(Boolean))];
      setUpcomingEvents(getUpcomingFestivals(states.length > 0 ? states : ['all']));
      timer.end('festivals_computed');
    }).catch(() => {
      // Fallback: show national festivals only
      setUpcomingEvents(getUpcomingFestivals(['all']));
      timer.end('error_fallback');
    });
  }, [user?.id]);

  const greeting = t(getGreetingKey());

  // Float-in helper
  const fi = (delay: number): React.CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  });

  return (
    <div className={`min-h-screen pb-32 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>

      {/* ─── Hero section with greeting ─── */}
      <div
        style={fi(0)}
        className={`relative overflow-hidden px-6 pt-6 pb-5 ${
          isDark
            ? 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900'
            : 'bg-gradient-to-br from-white via-slate-50 to-white'
        }`}
      >
        {/* Subtle decorative circles */}
        <div className={`absolute -top-12 -right-12 w-40 h-40 rounded-full ${isDark ? 'bg-amber-500/5' : 'bg-amber-500/5'}`} />
        <div className={`absolute -bottom-8 -left-8 w-28 h-28 rounded-full ${isDark ? 'bg-blue-500/5' : 'bg-blue-500/5'}`} />

        <div className="flex items-start justify-between relative">
          <div className="flex-1">
            <p className={`text-xs font-medium tracking-wide uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {greeting}
            </p>
            <h1 className={`text-2xl font-bold mt-0.5 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {user.full_name || user.store_name || 'Merchant'}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {totalActiveDeals} {t('m_live_deals')}
              </div>
              {user.store_name && (
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {user.store_name}
                </span>
              )}
            </div>
          </div>
          <NotificationBadge
            merchantId={user.id}
            onClick={() => setView('merchant_notifications')}
            theme={theme}
          />
        </div>
      </div>

      <div className="px-5 space-y-4 mt-4">

        {/* ─── Campaign Usage (glass cards with rings) ─── */}
        {campaignUsage.has_subscription && (
          <div style={fi(80)} id="tour-campaign-usage">
            <div className="grid grid-cols-2 gap-3">
              {/* Campaign ring card */}
              <div className={`relative rounded-2xl p-4 border overflow-hidden ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <UsageRing
                      used={campaignUsage.campaigns_used}
                      limit={campaignUsage.campaigns_limit}
                      color={campaignUsage.campaigns_used >= campaignUsage.campaigns_limit ? '#f43f5e' : '#3b82f6'}
                      bgColor={isDark ? '#1e293b' : '#f1f5f9'}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Megaphone className="w-4 h-4 text-blue-500" />
                    </div>
                  </div>
                  <div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('m_campaigns')}</p>
                    <p className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {campaignUsage.campaigns_used}
                      <span className={`text-sm font-normal ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                        /{campaignUsage.campaigns_limit}
                      </span>
                    </p>
                  </div>
                </div>
                {campaignUsage.campaigns_used >= campaignUsage.campaigns_limit && (
                  <div className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>
                    <AlertCircle className="w-3 h-3" />
                    {t('m_limit_reached')}
                  </div>
                )}
              </div>

              {/* DOTD ring card */}
              <div className={`relative rounded-2xl p-4 border overflow-hidden ${
                isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <UsageRing
                      used={campaignUsage.dotd_used}
                      limit={campaignUsage.dotd_limit}
                      color={campaignUsage.dotd_used >= campaignUsage.dotd_limit ? '#f43f5e' : '#f59e0b'}
                      bgColor={isDark ? '#1e293b' : '#f1f5f9'}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                  <div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('m_deal_of_day')}</p>
                    <p className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {campaignUsage.dotd_used}
                      <span className={`text-sm font-normal ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                        /{campaignUsage.dotd_limit}
                      </span>
                    </p>
                  </div>
                </div>
                {campaignUsage.dotd_used >= campaignUsage.dotd_limit && (
                  <div className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>
                    <AlertCircle className="w-3 h-3" />
                    {t('m_limit_reached')}
                  </div>
                )}
              </div>
            </div>

            {/* Upgrade nudge */}
            {(campaignUsage.campaigns_used >= campaignUsage.campaigns_limit || campaignUsage.dotd_used >= campaignUsage.dotd_limit) && (
              <button
                onClick={() => setView('merchant_subscriptions')}
                className={`w-full mt-2 flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${
                  isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <span>{t('m_upgrade_plan')}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* ─── Quick Actions Grid ─── */}
        <div style={fi(160)} className="grid grid-cols-2 gap-3">
          <button
            id="tour-new-deal"
            onClick={() => setView('merchant_deals')}
            className="group relative rounded-2xl p-4 flex flex-col gap-3 text-left active:scale-[0.96] active:shadow-md transition-all overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25"
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 transition-transform group-active:scale-110" />
            <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full bg-blue-400/20 translate-x-4 translate-y-4" />
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{t('m_new_deal')}</p>
              <p className="text-[10px] mt-0.5 text-blue-100">{t('m_launch_campaign')}</p>
            </div>
          </button>

          <button
            id="tour-scan-verify"
            onClick={() => setIsScanning(true)}
            className={`group relative rounded-2xl p-4 flex flex-col gap-3 text-left active:scale-[0.96] active:shadow-md transition-all overflow-hidden shadow-lg ${
              isDark
                ? 'bg-gradient-to-br from-slate-700 to-slate-800 shadow-black/30'
                : 'bg-gradient-to-br from-slate-800 to-slate-900 shadow-slate-900/25'
            }`}
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5 transition-transform group-active:scale-110" />
            <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full bg-white/5 translate-x-4 translate-y-4" />
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{t('m_scan_verify')}</p>
              <p className="text-[10px] mt-0.5 text-slate-300">{t('m_redeem_voucher')}</p>
            </div>
          </button>
        </div>

        {/* ─── Active Deals Carousel ─── */}
        {activeDeals.length > 0 && (
          <div style={fi(240)}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('m_live_deals_title')}
              </h2>
              <button
                onClick={() => setView('merchant_deals')}
                className={`flex items-center gap-1 text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
              >
                {t('m_view_all')}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 no-scrollbar">
              {activeDeals.map((deal) => (
                <button
                  key={deal.campaign_id}
                  onClick={() => setSelectedDeal(deal)}
                  className={`shrink-0 w-56 rounded-2xl overflow-hidden border text-left active:scale-[0.97] transition-all ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Deal thumbnail */}
                  <div className={`relative w-full h-28 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    {getDealImage(deal) ? (
                      <img
                        src={getDealImage(deal)}
                        alt={deal.deal_heading}
                        className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Megaphone className={`w-8 h-8 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                      </div>
                    )}
                    {deal.is_deal_of_the_day && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                        <Zap className="w-2.5 h-2.5" />
                        DOTD
                      </span>
                    )}
                    {deal.daysLeft !== undefined && deal.daysLeft >= 0 && (
                      <span className={`absolute bottom-2 right-2 flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-black/60 text-white' : 'bg-white/80 text-slate-700'
                      }`}>
                        <Clock className="w-2.5 h-2.5" />
                        {deal.daysLeft === 0 ? t('m_last_day') : `${deal.daysLeft}d left`}
                      </span>
                    )}
                  </div>
                  {/* Deal info */}
                  <div className="p-3">
                    <p className={`text-xs font-bold leading-snug line-clamp-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {deal.deal_heading}
                    </p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                      {deal.offerValue || (deal as any).offer_value}
                    </p>
                    {/* Clicks & Claims */}
                    <div className={`flex items-center gap-3 mt-1.5 pt-1.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        <MousePointer2 className="w-3 h-3" />
                        {clickCounts[deal.campaign_id] || 0}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <TicketCheck className="w-3 h-3" />
                        {redeemCounts[deal.campaign_id] || 0}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Shortcut Row ─── */}
        <div style={fi(320)} className="grid grid-cols-4 gap-2">
          {[
            { icon: BarChart3, label: t('m_intel'), view: 'merchant_analytics' as AppView, color: 'text-violet-500', bg: isDark ? 'bg-violet-500/10' : 'bg-violet-50' },
            { icon: Package, label: t('m_catalogue'), view: 'merchant_catalogue' as AppView, color: 'text-emerald-500', bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' },
            { icon: Store, label: t('m_stores'), view: 'merchant_stores' as AppView, color: 'text-sky-500', bg: isDark ? 'bg-sky-500/10' : 'bg-sky-50' },
            { icon: Sparkles, label: t('m_ai_hub'), view: 'merchant_ai_insights' as AppView, color: 'text-amber-500', bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50' },
          ].map(({ icon: Icon, label, view: targetView, color, bg }) => (
            <button
              key={label}
              onClick={() => setView(targetView)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl active:scale-[0.95] transition-all border ${
                isDark ? 'bg-slate-900/60 border-slate-800/60 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
            </button>
          ))}
        </div>

        {/* ─── Upcoming Events ─── */}
        {upcomingEvents.length > 0 && (
          <div style={fi(400)} id="tour-festival-banner">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('m_upcoming_events')}
              </h2>
            </div>
            <div className="space-y-2.5">
              {upcomingEvents.map((event, idx) => {
                const daysAway = getDaysUntilDate(event.date);
                const isFirst = idx === 0;
                return (
                  <button
                    key={event.name + event.date}
                    onClick={() => setView('merchant_deals')}
                    className={`w-full p-3.5 rounded-2xl flex items-center gap-3 text-left active:scale-[0.98] transition-all border relative overflow-hidden ${
                      isFirst
                        ? `${getBannerThemeClasses(event.themeKey, isDark)} ${isDark ? 'border-slate-800' : 'border-slate-200'}`
                        : isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg ${
                      isFirst
                        ? isDark ? 'bg-white/10' : 'bg-white/60'
                        : isDark ? 'bg-slate-800' : 'bg-slate-50'
                    }`}>
                      {event.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {event.name}
                        </p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          daysAway <= 7
                            ? 'bg-rose-500/20 text-rose-400'
                            : daysAway === 0
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-900/10 text-slate-500'
                        }`}>
                          {daysAway === 0 ? t('m_today') : `${daysAway}d away`}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {event.dealHint}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Empty state: no deals ─── */}
        {activeDeals.length === 0 && !loading && (
          <div style={fi(240)} className={`rounded-2xl p-6 text-center border ${
            isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
              isDark ? 'bg-blue-500/10' : 'bg-blue-50'
            }`}>
              <Megaphone className={`w-7 h-7 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            </div>
            <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('m_no_active_deals')}
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('m_create_first_deal')}
            </p>
            <button
              onClick={() => setView('merchant_deals')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-bold active:scale-[0.97] transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('m_create_first_deal_btn')}
            </button>
          </div>
        )}
      </div>

      {/* Deal Detail Modal */}
      {selectedDeal && (() => {
        const deal = selectedDeal;
        const allMedia: { url: string; isVideo: boolean }[] = [];
        const mainImg = getDealImage(deal);
        if (mainImg) allMedia.push({ url: mainImg, isVideo: false });
        if ((deal as any).media_urls) {
          for (const url of (deal as any).media_urls) {
            if (url && url !== mainImg) allMedia.push({ url, isVideo: false });
          }
        }
        if ((deal as any).video_url) allMedia.push({ url: (deal as any).video_url, isVideo: true });
        const totalMedia = allMedia.length;
        const priceOverlays = (deal as any).image_price_overlays || {};

        const formatDateUTC = (dateStr: string) => {
          const date = new Date(dateStr + 'T00:00:00Z');
          return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
        };

        const plainDesc = (deal.longDescription || (deal as any).long_description || '')
          .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

        return (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-end sm:items-center justify-center" onClick={() => setSelectedDeal(null)}>
            <div
              onClick={e => e.stopPropagation()}
              className={`w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}
            >
              {/* Media Carousel */}
              {totalMedia > 0 ? (
                <>
                  <div className="relative shrink-0">
                    <div
                      id="dashboard-deal-carousel"
                      onScroll={(e) => {
                        const el = e.currentTarget;
                        const idx = Math.round(el.scrollLeft / el.clientWidth);
                        // Update dot via DOM (avoids re-render)
                        el.dataset.activeIdx = String(Math.min(idx, totalMedia - 1));
                        document.querySelectorAll('.dash-carousel-dot').forEach((dot, i) => {
                          if (i === idx) {
                            dot.className = `dash-carousel-dot rounded-full transition-all duration-300 w-5 h-2 ${allMedia[i]?.isVideo ? 'bg-indigo-500' : 'bg-blue-500'}`;
                          } else {
                            dot.className = `dash-carousel-dot rounded-full transition-all duration-300 w-2 h-2 ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`;
                          }
                        });
                      }}
                      className="flex overflow-x-auto snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                    >
                      {allMedia.map((item, i) => {
                        const overlay = priceOverlays[String(i)];
                        const hasOverlay = overlay && (overlay.discountPct || overlay.offerPrice);
                        const mrp = overlay?.offerPrice ? Math.round(parseFloat(overlay.offerPrice) * 1.3) : null;
                        return (
                          <div key={i} className="w-full flex-shrink-0 snap-center relative">
                            {item.isVideo ? (
                              <video src={item.url} className="w-full h-56 object-cover bg-black" controls muted playsInline />
                            ) : (
                              <img src={item.url} alt="" className="w-full h-56 object-cover" draggable={false} />
                            )}
                            {hasOverlay && !item.isVideo && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-3 px-4">
                                {overlay.discountPct && (
                                  <div className="inline-block bg-red-500 text-white text-xs font-black px-2 py-1 rounded mb-1.5">
                                    {overlay.discountPct}% OFF
                                  </div>
                                )}
                                <div className="flex items-baseline gap-2">
                                  {overlay.offerPrice && (
                                    <span className="text-white text-2xl font-black drop-shadow-lg">₹{overlay.offerPrice}</span>
                                  )}
                                  {mrp && (
                                    <span className="text-white/60 text-sm line-through">₹{mrp}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Close */}
                    <button onClick={() => setSelectedDeal(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </button>
                    {/* Counter */}
                    {totalMedia > 1 && (
                      <div className="absolute top-3 right-14 px-2 py-0.5 rounded-md bg-black/50">
                        <span className="text-[10px] font-semibold text-white">1/{totalMedia}</span>
                      </div>
                    )}
                    {/* DOTD badge */}
                    {deal.is_deal_of_the_day && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500 text-white px-2 py-1 rounded-lg text-xs font-bold">
                        <Zap className="w-3 h-3" /> DOTD
                      </div>
                    )}
                  </div>
                  {/* Dot indicators below image */}
                  {totalMedia > 1 && (
                    <div className="flex items-center justify-center gap-2 py-2.5">
                      {allMedia.map((item, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            const el = document.getElementById('dashboard-deal-carousel');
                            if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
                          }}
                          className={`dash-carousel-dot rounded-full transition-all duration-300 ${
                            i === 0
                              ? `w-5 h-2 ${item.isVideo ? 'bg-indigo-500' : 'bg-blue-500'}`
                              : `w-2 h-2 ${isDark ? 'bg-slate-600' : 'bg-slate-300'}`
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="relative shrink-0">
                  <div className={`w-full h-32 flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <Megaphone className={`w-10 h-10 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
                  </div>
                  <button onClick={() => setSelectedDeal(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className={`text-lg font-bold flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {deal.deal_heading || deal.details}
                    </h2>
                    <span className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm font-bold">
                      {deal.offerValue || (deal as any).offer_value}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{deal.shopName}</p>
                </div>

                {deal.start_date && deal.end_date && (
                  <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDateUTC(deal.start_date)} — {formatDateUTC(deal.end_date)}
                  </div>
                )}

                {deal.address && (
                  <div className={`flex items-start gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{deal.address}</span>
                  </div>
                )}

                {plainDesc && (
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Description</p>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{plainDesc}</p>
                  </div>
                )}

                <div className={`grid grid-cols-2 gap-2 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{clickCounts[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_clicks')}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{redeemCounts[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_redeemed')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
