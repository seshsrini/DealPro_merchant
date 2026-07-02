
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from './contexts/LanguageContext';
import { AppView, Deal } from './types';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { merchantService } from './services/merchantService';
import { mDashboardService } from './services/mDashboardService';
import { mrpFromDiscount } from './components/campaign-wizard/StepImage';
import { PLAY_COMPLIANT } from './services/playCompliance';
import { resilient, peekCache } from './services/resilientData';
import { useResumeRefetch } from './services/useResumeRefetch';
import { perfTimer } from './services/perfLogger';
import { NotificationBadge } from './components/NotificationBadge';
import { getUpcomingFestivals, getDaysUntilDate, FestivalEvent } from './components/festivalCalendar';
import { MediaLightbox } from './components/MediaLightbox';
import { DealsLoader } from './components/DealsLoader';
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
  Gift,
  Truck,
  Printer,
} from 'lucide-react';
import { pickBadgeCornerForImage, BadgeCorner } from './utils/badgeCornerForImage';
import { POSTER_TEMPLATES, openDealPoster, buildPosterHtml, type PosterTemplate } from './utils/printDealPoster';
import { renderPosterMiniMock } from './components/PosterMiniMock';

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
  unlimited?: boolean;
}> = ({ used, limit, color, bgColor, size = 52, unlimited = false }) => {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Unlimited plans show a full ring (not a nearly-empty one) to read as "no cap".
  const pct = unlimited ? 1 : (limit > 0 ? Math.min(used / limit, 1) : 0);
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

  // Seed from cache so the New Deal / DOTD gates reflect the LAST-KNOWN usage on
  // the very first render. Without this the state starts at 0/0 (limit unknown),
  // and since the "maxed" gate needs campaigns_limit > 0, a maxed-out merchant
  // briefly saw the button ENABLED on return until the fresh usage loaded.
  // Shared with My Campaigns so whichever screen last fetched usage seeds the
  // other — a merchant who just maxed out sees the gate reflect it everywhere.
  const usageCacheKey = `campaign_usage_${user?.id}`;
  const [campaignUsage, setCampaignUsage] = useState(() => peekCache<{
    campaigns_used: number; campaigns_limit: number; dotd_used: number; dotd_limit: number; has_subscription: boolean;
  }>(usageCacheKey) || {
    campaigns_used: 0,
    campaigns_limit: 0,
    dotd_used: 0,
    dotd_limit: 0,
    has_subscription: false,
  });

  const [upcomingEvents, setUpcomingEvents] = useState<FestivalEvent[]>([]);

  // Per-deal click, claim & redemption counts
  const [clickCounts, setClickCounts] = useState<Record<string, number>>({});
  const [claimClickCounts, setClaimClickCounts] = useState<Record<string, number>>({});
  const [redeemCounts, setRedeemCounts] = useState<Record<string, number>>({});
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  // Print-poster picker & proof-read preview — mirrors the flow in MerchantMyCampaigns
  // so the merchant gets the same Print → pick design → preview → confirm experience
  // wherever they tap a deal card.
  const [posterPickerForDeal, setPosterPickerForDeal] = useState<Deal | null>(null);
  const [posterPreview, setPosterPreview] = useState<{ deal: Deal; template: PosterTemplate } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<Array<{ kind: 'image' | 'video'; url: string }>>([]);

  const getDealImage = (deal: Deal) => (deal as any).image_url || deal.thumbnail || '';

  // All live deals (unsliced) — drives the top "pulse" totals. Plan limits keep this
  // count small, so fetching stats for every one stays cheap.
  const allActiveDeals = useMemo(
    () => deals.filter(d => d.status === 'active' || d.status === 'approved'),
    [deals]
  );

  // Top 5 (most recent) for the carousel.
  const activeDeals = useMemo(() => {
    return [...allActiveDeals]
      .sort((a, b) => (b.campaign_id || '').localeCompare(a.campaign_id || ''))
      .slice(0, 5);
  }, [allActiveDeals]);

  const totalActiveDeals = allActiveDeals.length;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const [merchantStores, setMerchantStores] = useState<any[]>([]);

  // ── Resilient dashboard loaders ──
  // Every loader retries transient failures and falls back to its last-good
  // localStorage cache (resilient + cacheKey). So a background→resume blip (the
  // token-expiry window) can no longer blank the counts/stores/stats — at worst
  // they keep showing the last-good values until the next successful fetch.

  // Deals remaining/created — drives the New Deal / DOTD gates.
  const loadCampaignUsage = useCallback(async () => {
    if (!user?.id) return;
    const timer = perfTimer('load_merchant_dashboard', 'merchant_dashboard');
    try {
      const usage = await resilient(
        () => merchantSubscriptionService.getCampaignUsage(user.id),
        { cacheKey: usageCacheKey },
      );
      setCampaignUsage(usage);
      timer.end('campaign_usage_done');
    } catch (err) {
      console.warn('[MerchantDashboard] usage load failed (kept last-good):', err);
      timer.end('error');
    }
  }, [user?.id, usageCacheKey]);

  useEffect(() => { loadCampaignUsage(); }, [loadCampaignUsage, deals]);

  // Auto-refresh deals + usage every 5s so the dashboard reflects DB changes
  // (new deals, status edits, expiries) without a manual reload. The "X/limit"
  // counter is created-this-month, so an expiry won't lower it; the "Live deals"
  // count (status-based) will drop once the refreshed list excludes it.
  useEffect(() => {
    const id = setInterval(() => {
      refreshDeals();
      loadCampaignUsage();
    }, 5000);
    return () => clearInterval(id);
  }, [refreshDeals, loadCampaignUsage]);

  // Per-deal clicks & redemptions across ALL live deals — powers both the carousel
  // cards (a subset) and the top "pulse" totals (the full sum).
  const loadCampaignStats = useCallback(async () => {
    if (!allActiveDeals.length || !user?.id) return;
    const ids = allActiveDeals.map(d => d.campaign_id);
    try {
      const [clicksData, redemptions] = await Promise.all([
        resilient(() => mDashboardService.getCampaignSpecificClicks(ids), { cacheKey: `dash_clicks_${user.id}` }),
        resilient(() => mDashboardService.getCampaignSpecificRedemptions(user.id, ids), { cacheKey: `dash_redeem_${user.id}` }),
      ]);
      setClickCounts(clicksData.views);
      setClaimClickCounts(clicksData.claimClicks);
      setRedeemCounts(redemptions);
    } catch {
      /* keep previous counts */
    }
  }, [allActiveDeals, user?.id]);

  useEffect(() => { loadCampaignStats(); }, [loadCampaignStats]);

  // Merchant stores → states → upcoming festivals.
  const loadStores = useCallback(async () => {
    if (!user?.id) return;
    try {
      const stores = await resilient(
        () => merchantService.getMerchantStores(user.id),
        { cacheKey: `dash_stores_${user.id}` },
      );
      setMerchantStores(stores || []);
      const states = [...new Set((stores || []).map((s: any) => s.state).filter(Boolean))];
      setUpcomingEvents(getUpcomingFestivals(states.length > 0 ? states : ['all']));
    } catch {
      // Keep stores as-is; show national festivals as a floor.
      setUpcomingEvents(getUpcomingFestivals(['all']));
    }
  }, [user?.id]);

  useEffect(() => { loadStores(); }, [loadStores]);

  // On app resume, re-run all dashboard loaders so a stale/blank section heals.
  useResumeRefetch(useCallback(() => {
    loadCampaignUsage();
    loadCampaignStats();
    loadStores();
  }, [loadCampaignUsage, loadCampaignStats, loadStores]));

  // DOTD badge corner — picked dynamically from the selected deal's cover image so
  // it doesn't sit on top of the merchant's chosen baked text band.
  const [dotdBadgeCorner, setDotdBadgeCorner] = useState<BadgeCorner>('tl');
  useEffect(() => {
    const url = selectedDeal ? (getDealImage(selectedDeal) || '') : '';
    if (!url) { setDotdBadgeCorner('tl'); return; }
    let cancelled = false;
    pickBadgeCornerForImage(url).then(c => { if (!cancelled) setDotdBadgeCorner(c); });
    return () => { cancelled = true; };
  }, [selectedDeal]);

  const greeting = t(getGreetingKey());

  // ── Top "pulse" strip: live totals across all active deals ──
  const totalViews = useMemo(() => Object.values(clickCounts).reduce((a, b) => a + b, 0), [clickCounts]);
  const totalClaims = useMemo(() => Object.values(claimClickCounts).reduce((a, b) => a + b, 0), [claimClickCounts]);
  const totalRedeemed = useMemo(() => Object.values(redeemCounts).reduce((a, b) => a + b, 0), [redeemCounts]);

  // Primary store location (City, State) shown next to the live-deals count in the hero.
  const primaryLocation = useMemo(() => {
    const s = merchantStores[0];
    if (!s) return '';
    return [s.city, s.state].filter(Boolean).join(', ');
  }, [merchantStores]);

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
            <p className={`text-xs font-medium tracking-wide uppercase ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
              {greeting}
            </p>
            <h1 className={`text-2xl font-bold mt-0.5 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {user.full_name || user.store_name || 'Merchant'}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {loading && deals.length === 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-2 rounded bg-emerald-500/30 animate-pulse" />
                    {t('m_live_deals')}
                  </span>
                ) : (
                  <>{totalActiveDeals} {t('m_live_deals')}</>
                )}
              </div>
              {primaryLocation && (
                <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <MapPin className="w-3 h-3 shrink-0" />
                  {primaryLocation}
                </span>
              )}
              {user.store_name && (
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
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

        {/* ─── Today's pulse: live totals across all active deals ─── */}
        {allActiveDeals.length > 0 && (
          <div style={fi(60)} className="grid grid-cols-3 gap-2.5">
            {/* Views */}
            <div className={`rounded-2xl p-3 border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-1.5">
                <MousePointer2 className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_views')}</span>
              </div>
              <p className={`text-xl font-black mt-1 leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {totalViews.toLocaleString('en-IN')}
              </p>
            </div>
            {/* Claims */}
            <div className={`rounded-2xl p-3 border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-blue-500" />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_claims')}</span>
              </div>
              <p className={`text-xl font-black mt-1 leading-none ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {totalClaims.toLocaleString('en-IN')}
              </p>
            </div>
            {/* Redeemed */}
            <div className={`rounded-2xl p-3 border ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-1.5">
                <TicketCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_redeemed')}</span>
              </div>
              <p className={`text-xl font-black mt-1 leading-none ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {totalRedeemed.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        )}

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
                      color={campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_limit < 999 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit ? '#f43f5e' : '#3b82f6'}
                      bgColor={isDark ? '#1e293b' : '#f1f5f9'}
                      unlimited={campaignUsage.campaigns_limit >= 999}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Megaphone className="w-4 h-4 text-blue-500" />
                    </div>
                  </div>
                  <div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_campaigns')}</p>
                    <p className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {campaignUsage.campaigns_limit >= 999 ? (
                        <span className="text-base">Unlimited</span>
                      ) : (
                        <>
                          {campaignUsage.campaigns_used}
                          <span className={`text-sm font-bold ${isDark ? 'text-amber-400' : 'text-amber-500'}`}>
                            /{campaignUsage.campaigns_limit}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit && (
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
                      color={campaignUsage.dotd_limit > 0 && campaignUsage.dotd_limit < 999 && campaignUsage.dotd_used >= campaignUsage.dotd_limit ? '#f43f5e' : '#f59e0b'}
                      bgColor={isDark ? '#1e293b' : '#f1f5f9'}
                      unlimited={campaignUsage.dotd_limit >= 999}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                  </div>
                  <div>
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_deal_of_day')}</p>
                    <p className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {campaignUsage.dotd_limit >= 999 ? (
                        <span className="text-base">Unlimited</span>
                      ) : (
                        <>
                          {campaignUsage.dotd_used}
                          <span className={`text-sm font-bold ${isDark ? 'text-amber-400' : 'text-amber-500'}`}>
                            /{campaignUsage.dotd_limit}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                {campaignUsage.dotd_limit > 0 && campaignUsage.dotd_used >= campaignUsage.dotd_limit && (
                  <div className={`mt-2 flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-rose-400' : 'text-rose-500'}`}>
                    <AlertCircle className="w-3 h-3" />
                    {t('m_limit_reached')}
                  </div>
                )}
              </div>
            </div>

            {/* Upgrade nudge */}
            {(campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit || campaignUsage.dotd_limit > 0 && campaignUsage.dotd_used >= campaignUsage.dotd_limit) && (
              <button
                onClick={() => setView('merchant_subscriptions')}
                className={`w-full mt-2 flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${
                  isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <span>{PLAY_COMPLIANT ? 'Manage plan' : t('m_upgrade_plan')}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* ─── Quick Actions Grid ─── */}
        <div style={fi(160)} className="grid grid-cols-2 gap-3">
          {(() => {
            // Only gray the button when we've actually confirmed a subscription
            // and a real positive limit has been hit. Default 0/0 state (or a
            // failed usage fetch) used to leave the button grayed indefinitely.
            const atCampaignLimit = !!campaignUsage
              && campaignUsage.has_subscription
              && campaignUsage.campaigns_limit > 0
              && campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit;
            return (
              <button
                id="tour-new-deal"
                onClick={() => { setDealIdToEdit(null); setView('campaign_wizard'); }}
                disabled={atCampaignLimit}
                className={`group relative rounded-2xl p-4 flex flex-col gap-3 text-left transition-all overflow-hidden ${
                  atCampaignLimit
                    ? 'bg-slate-300 cursor-not-allowed opacity-60 shadow-none'
                    : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25 active:scale-[0.96] active:shadow-md'
                }`}
              >
                {!atCampaignLimit && <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 transition-transform group-active:scale-110" />}
                {!atCampaignLimit && <div className="absolute bottom-0 right-0 w-16 h-16 rounded-full bg-blue-400/20 translate-x-4 translate-y-4" />}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${atCampaignLimit ? 'bg-slate-400/40' : 'bg-white/20'}`}>
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t('m_new_deal')}</p>
                  <p className={`text-[10px] mt-0.5 ${atCampaignLimit ? 'text-slate-100' : 'text-blue-100'}`}>{t('m_launch_campaign')}</p>
                </div>
              </button>
            );
          })()}

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
                className={`flex items-center gap-1 text-[10px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-900'}`}
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
                    {/* Views, Claims & Redeemed */}
                    <div className={`flex items-center gap-3 mt-1.5 pt-1.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`} title="Views">
                        <MousePointer2 className="w-3 h-3" />
                        {clickCounts[deal.campaign_id] || 0}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`} title="Claims">
                        <Megaphone className="w-3 h-3" />
                        {claimClickCounts[deal.campaign_id] || 0}
                      </span>
                      <span className={`flex items-center gap-1 text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} title="Redeemed">
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
              <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{label}</span>
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
                      <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
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

        {/* ─── Loading state: deals still being fetched ─── */}
        {activeDeals.length === 0 && loading && (
          <div style={fi(240)}>
            <DealsLoader theme={theme} />
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
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
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

      {/* Deal Detail Modal — Consumer-style full-screen preview */}
      {selectedDeal && (() => {
        // Merge delivery info from the matching merchant store (works without redeploying get-by-merchant)
        const dealStore = merchantStores.find(s => s.id === (selectedDeal as any).store_id);
        const deal: Deal = {
          ...selectedDeal,
          ...(dealStore ? {
            delivers: (selectedDeal as any).delivers ?? dealStore.delivers ?? false,
            delivery_radius_km: (selectedDeal as any).delivery_radius_km ?? dealStore.delivery_radius_km ?? null,
            storePhone: (selectedDeal as any).storePhone ?? dealStore.store_phone ?? null,
            storePhoneAlt: (selectedDeal as any).storePhoneAlt ?? dealStore.store_phone_alt ?? null,
          } : {}),
        } as Deal;
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
          <div className="fixed inset-0 z-[300] overflow-y-auto" style={{ background: isDark ? '#0f172a' : '#ffffff' }}>
            {/* Top-right action cluster: Print + Close */}
            <div className="fixed top-4 right-4 z-[350] flex items-center gap-2">
              <button
                onClick={() => setPosterPickerForDeal(deal)}
                aria-label="Print poster"
                className="h-10 px-3 rounded-full bg-yellow-500 text-slate-900 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-lg"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => setSelectedDeal(null)}
                aria-label="Close"
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-all shadow-lg"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Consumer Preview badge */}
            <div className="fixed top-5 left-4 z-[350] px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider">
              Consumer Preview
            </div>

            {/* Image — square aspect like consumer */}
            {totalMedia > 0 && (
              <div className={`relative aspect-square overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full h-full" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                  {allMedia.map((item, i) => {
                    const overlay = priceOverlays[String(i)];
                    const hasOverlay = overlay && (overlay.discountPct || overlay.offerPrice);
                    const mrp = overlay?.offerPrice ? mrpFromDiscount(parseFloat(overlay.offerPrice), overlay.discountPct) : null;
                    return (
                      <div key={i} className="w-full h-full flex-shrink-0 snap-center relative">
                        {item.isVideo ? (
                          <video src={item.url} className="w-full h-full object-cover bg-black" controls muted playsInline />
                        ) : (
                          <button type="button" onClick={() => { setLightboxSlides(allMedia.map(m => ({ kind: m.isVideo ? 'video' as const : 'image' as const, url: m.url }))); setLightboxOpen(true); }} className="w-full h-full">
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          </button>
                        )}
                        {hasOverlay && !item.isVideo && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-8 pb-3 px-4">
                            {overlay.discountPct && <div className="inline-block bg-red-500 text-white text-xs font-black px-2 py-1 rounded mb-1.5">{overlay.discountPct}% OFF</div>}
                            <div className="flex items-baseline gap-2">
                              {overlay.offerPrice && <span className="text-white text-2xl font-black">₹{overlay.offerPrice}</span>}
                              {mrp && <span className="text-white/60 text-sm line-through">₹{mrp}</span>}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {deal.is_deal_of_the_day && (
                  <div className={`absolute flex items-center gap-1 bg-amber-500 text-white px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    // Custom offsets for the merchant view: top corners cleared the Consumer
                    // Preview pill (top-14); bottom corners cleared the carousel dots (bottom-12).
                    {
                      tl: 'top-14 left-3',
                      tr: 'top-14 right-3',
                      bl: 'bottom-12 left-3',
                      br: 'bottom-12 right-3',
                    }[dotdBadgeCorner]
                  }`}>
                    <Zap className="w-3 h-3" /> DOTD
                  </div>
                )}
                {totalMedia > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allMedia.map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-white/50 first:w-4 first:bg-white" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content — consumer-style */}
            <div className="px-4 py-6">
              {/* Store name */}
              <p className={`text-xs font-normal mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                {deal.shopName}
              </p>

              {/* Heading */}
              <h1 className={`text-xl font-semibold mb-3 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {deal.deal_heading || deal.details}
              </h1>

              {/* Category */}
              {deal.category && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{deal.category}</span>
                </div>
              )}

              {/* Delivery info — clean left-aligned card (matches consumer side) */}
              {(deal as any).delivers && (
                <div className={`mb-4 flex items-start gap-3 p-3 rounded-xl border ${
                  isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/60 border-emerald-200'
                }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'
                  }`}>
                    <Truck className={`w-5 h-5 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                      {(deal as any).delivery_radius_km
                        ? (deal as any).delivery_radius_km >= 10
                          ? 'City-wide delivery available'
                          : `Delivery available within ${(deal as any).delivery_radius_km} km`
                        : 'Delivery available — contact store'}
                    </p>
                    <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                      Delivered by the merchant or their partner; DealPro is not liable.
                    </p>
                  </div>
                </div>
              )}

              {/* Rating */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map(star => (
                    <svg key={star} className={`w-4 h-4 ${star <= Math.floor((deal as any).averageRating || 0) ? 'text-yellow-500' : isDark ? 'text-slate-600' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className={`text-sm font-normal ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                  {(deal as any).averageRating > 0 ? `${((deal as any).averageRating).toFixed(1)} (${(deal as any).ratingCount || 0} reviews)` : 'No reviews yet'}
                </span>
              </div>

              {/* Offer */}
              <div className="mb-6">
                <p className="text-2xl font-semibold text-yellow-600 mb-1">
                  {deal.offerValue || (deal as any).offer_value}
                </p>
                {deal.end_date && (
                  <p className={`text-sm font-normal ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                    Valid till {formatDateUTC(deal.end_date)}
                  </p>
                )}
              </div>

              {/* Free Gifts */}
              {(deal as any).free_gifts && (deal as any).free_gifts.length > 0 && (
                <div className={`mb-6 p-4 rounded-xl border ${isDark ? 'border-pink-500/20 bg-pink-500/5' : 'border-pink-200 bg-pink-50/50'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="w-4 h-4 text-pink-500" />
                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-pink-400' : 'text-pink-600'}`}>Free Gifts Included</span>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-1">
                    {(deal as any).free_gifts.map((gift: { image_url: string; name: string }, i: number) => (
                      <div key={i} className="flex flex-col items-center shrink-0" style={{ width: 80 }}>
                        <div className={`w-[72px] h-[72px] rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                          <img src={gift.image_url} alt={gift.name} className="w-full h-full object-cover" />
                        </div>
                        <p className={`text-[11px] font-medium text-center mt-1.5 leading-tight line-clamp-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{gift.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Redeem button placeholder */}
              <div className="w-full h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-medium mb-6 opacity-40 cursor-not-allowed">
                Get Before It's Gone!
              </div>

              {/* Redeem instructions */}
              <div className={`flex items-start gap-3 p-3 rounded-lg mb-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <span className={`text-sm font-normal leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Show the claim QR code at the store to redeem this deal. The merchant will scan it to verify.
                </span>
              </div>

              {/* Details */}
              {plainDesc && (
                <div className="mb-4">
                  <div className={`w-full h-14 flex items-center gap-3 px-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <Sparkles className="w-5 h-5 text-slate-400" />
                    <span className={`text-sm font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>Details</span>
                  </div>
                  <div className={`px-4 py-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{plainDesc}</p>
                  </div>
                </div>
              )}

              {/* Store Info */}
              <div className="mb-4">
                <div className={`w-full h-14 flex items-center gap-3 px-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <Store className="w-5 h-5 text-slate-400" />
                  <span className={`text-sm font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>Store Info</span>
                </div>
                <div className={`px-4 py-4 space-y-3 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  {deal.shopName && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Store Name</p>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{deal.shopName}</p>
                    </div>
                  )}
                  {deal.address && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Address</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{deal.address}</p>
                    </div>
                  )}
                  {deal.landmark && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Landmark</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{deal.landmark}</p>
                    </div>
                  )}
                  {(deal as any).storePhone && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Phone</p>
                      <a href={`tel:${(deal as any).storePhone}`} className="text-sm text-blue-500 font-medium">{(deal as any).storePhone}</a>
                      {(deal as any).storePhoneAlt && (
                        <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                          {' / '}
                          <a href={`tel:${(deal as any).storePhoneAlt}`} className="text-blue-500 font-medium">{(deal as any).storePhoneAlt}</a>
                        </span>
                      )}
                    </div>
                  )}
                  {(deal as any).storeHrs && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Store Hours</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{(deal as any).storeHrs}</p>
                    </div>
                  )}
                  {deal.start_date && deal.end_date && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Campaign Period</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatDateUTC(deal.start_date)} — {formatDateUTC(deal.end_date)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Campaign Performance */}
              <div className={`rounded-xl border p-4 mb-4 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Campaign Performance</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{clickCounts[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_clicks')}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{claimClickCounts[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Claims</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{redeemCounts[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_redeemed')}</p>
                  </div>
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setSelectedDeal(null)}
                className={`w-full h-12 rounded-xl text-sm font-medium active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
              >
                Close Preview
              </button>

              <div className="pb-8" />
            </div>
          </div>
        );
      })()}

      {/* Full-screen media lightbox with pinch-to-zoom */}
      {lightboxOpen && lightboxSlides.length > 0 && (
        <MediaLightbox
          slides={lightboxSlides}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* Poster Template Picker — opens when merchant taps Print on a deal */}
      {posterPickerForDeal && (
        <div
          className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setPosterPickerForDeal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}
          >
            <div className={`sticky top-0 px-5 pt-5 pb-3 flex items-center justify-between ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
              <div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Pick a poster design
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                  A4 portrait, high-resolution. Print and stick in your store.
                </p>
              </div>
              <button
                onClick={() => setPosterPickerForDeal(null)}
                aria-label="Close"
                className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 pb-5">
              {POSTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    const dealForPreview = posterPickerForDeal;
                    if (!dealForPreview) return;
                    setPosterPickerForDeal(null);
                    setPosterPreview({ deal: dealForPreview, template: tpl.id as PosterTemplate });
                  }}
                  className={`rounded-2xl p-4 text-left active:scale-[0.98] transition-all border ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:border-yellow-500'
                      : 'bg-slate-50 border-slate-200 hover:border-yellow-500'
                  }`}
                >
                  {renderPosterMiniMock(tpl.id as PosterTemplate)}
                  <div className={`text-sm font-bold mt-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {tpl.label}
                  </div>
                  <div className={`text-[11px] leading-snug mt-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                    {tpl.description}
                  </div>
                </button>
              ))}
            </div>

            <div className={`px-5 pb-6 pt-1 text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
              Tip: you'll get a preview to proof-read before the print dialog opens.
            </div>
          </div>
        </div>
      )}

      {/* Proof-read preview — shows the actual rendered poster in an iframe
          BEFORE the print dialog fires. Same component pattern as MerchantMyCampaigns. */}
      {posterPreview && (
        <div
          className="fixed inset-0 z-[420] bg-black/80 backdrop-blur-sm flex flex-col"
          onClick={() => setPosterPreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`flex flex-col flex-1 max-w-2xl w-full mx-auto ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}
          >
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="min-w-0">
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Proof-read your poster
                </h3>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                  Check the wording fits cleanly before you print.
                </p>
              </div>
              <button
                onClick={() => setPosterPreview(null)}
                aria-label="Close preview"
                className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3 flex items-start justify-center bg-slate-300/40">
              <div
                style={{
                  width: 380,
                  height: 538,
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                }}
              >
                <iframe
                  key={posterPreview.template}
                  title="Poster preview"
                  srcDoc={buildPosterHtml(posterPreview.deal, posterPreview.template, { autoPrint: false })}
                  style={{
                    width: '210mm',
                    height: '297mm',
                    border: 0,
                    background: 'white',
                    display: 'block',
                    transform: 'scale(0.479)',
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                  sandbox="allow-same-origin"
                />
              </div>
            </div>

            {/* Footer action buttons — extra bottom padding via safe-area so the
                Print/Back buttons sit clear of the Android gesture bar. */}
            <div
              className={`flex gap-3 px-5 pt-4 border-t ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}
            >
              <button
                onClick={() => {
                  const previewed = posterPreview;
                  setPosterPreview(null);
                  setPosterPickerForDeal(previewed.deal);
                }}
                className={`flex-1 h-12 rounded-xl text-sm font-medium active:scale-[0.98] transition-all ${
                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Back to designs
              </button>
              <button
                onClick={() => {
                  const previewed = posterPreview;
                  setPosterPreview(null);
                  openDealPoster(previewed.deal, previewed.template);
                }}
                className="flex-1 h-12 rounded-xl bg-yellow-500 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Printer className="w-4 h-4" />
                Print this poster
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
