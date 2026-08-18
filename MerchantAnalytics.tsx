
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from './types';
import { Loader2, TrendingUp, BarChart3, Calendar, AlertCircle, TicketCheck, MousePointer2, Percent, HeartHandshake, CheckCircle2, BarChart, Package, Eye, Heart, Star, Zap, TrendingDown, Award, Brain, Target, Clock, ChevronRight, Users, Repeat, Crown } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import { mDashboardService } from './services/mDashboardService';
import { aiInsightsService, AIInsight } from './services/aiInsightsService';
import { performanceScoreService, PerformanceScore, ScoreFactor } from './services/performanceScoreService';
import { resilient } from './services/resilientData';
import { useResumeRefetch } from './services/useResumeRefetch';
import { useTranslation } from './contexts/LanguageContext';

interface MerchantAnalyticsProps {
  user: User;
  theme: 'light' | 'dark';
  setView?: (view: any) => void;
}

interface TrendData {
  date: string;
  count: number;
}

interface AnalyticsData {
  totalCampaigns: number;
  activeCampaigns: number;
  totalStores: number;
  campaignTrend: TrendData[];
  statusBreakdown: {
    approved: number;
    review: number;
    needs_review: number;
    expired: number;
  };
}

export const MerchantAnalytics: React.FC<MerchantAnalyticsProps> = ({ user, theme, setView }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | 'lifetime'>('30');

  // INTEL: DealFynd consumers signed up in each store's area (city-level today).
  interface ConsumerReachRow { store_id: string; store_name: string | null; city: string | null; state: string | null; locality: string | null; pincode: string | null; consumer_count: number; }
  const [consumerReach, setConsumerReach] = useState<ConsumerReachRow[]>([]);
  const [loadingReach, setLoadingReach] = useState(true);

  useEffect(() => {
    if (!user.id) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await resilient(async () => {
          const { data, error } = await supabase.functions.invoke('get-store-consumer-reach', { body: { merchantId: user.id } });
          if (error) throw error;
          return data;
        }, { cacheKey: `an_consumer_reach_${user.id}` });
        if (!cancelled) setConsumerReach(((data as any)?.rows as ConsumerReachRow[]) || []);
      } catch (e) {
        console.warn('[MerchantAnalytics] consumer reach failed:', (e as any)?.message || e);
      } finally {
        if (!cancelled) setLoadingReach(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const [totalLifetimeDeals, setTotalLifetimeDeals] = useState(0);
  const [totalLifetimeClicks, setTotalLifetimeClicks] = useState(0);
  const [totalLifetimeRedemptions, setTotalLifetimeRedemptions] = useState(0);
  const [totalInvitesSent, setTotalInvitesSent] = useState(0);
  const [totalInvitesAccepted, setTotalInvitesAccepted] = useState(0);

  const [loadingTotalDeals, setLoadingTotalDeals] = useState(false);
  const [loadingTotalClicks, setLoadingTotalClicks] = useState(false);
  const [loadingTotalRedemptions, setLoadingTotalRedemptions] = useState(false);
  const [loadingInvitesSent, setLoadingInvitesSent] = useState(false);
  const [loadingInvitesAccepted, setLoadingInvitesAccepted] = useState(false);

  const [catalogueStats, setCatalogueStats] = useState({
    activeProducts: 0,
    totalViews: 0,
    totalLikes: 0,
  });
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  interface ProductPerformance {
    id: string;
    name: string;
    category: string;
    imageUrl: string | null;
    views: number;
    likes: number;
    engagementScore: number;
  }
  const [topProducts, setTopProducts] = useState<ProductPerformance[]>([]);
  const [loadingTopProducts, setLoadingTopProducts] = useState(false);

  const [productInsights, setProductInsights] = useState({
    bestCategory: '',
    avgViewsPerProduct: 0,
    avgLikesPerProduct: 0,
    topPerformerName: '',
    lowPerformerCount: 0,
  });

  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [loadingAiInsights, setLoadingAiInsights] = useState(false);

  const [performanceScore, setPerformanceScore] = useState<PerformanceScore | null>(null);
  const [loadingPerformanceScore, setLoadingPerformanceScore] = useState(false);

  // Repeat customer tracking
  const [repeatData, setRepeatData] = useState<{
    totalCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    avgRedemptionsPerCustomer: number;
    totalRedemptions: number;
    frequencyBreakdown: { once: number; twice: number; threeToFive: number; sixPlus: number };
    topRepeaters: { consumerId: string; count: number; uniqueDeals: number; name?: string }[];
  } | null>(null);
  const [loadingRepeat, setLoadingRepeat] = useState(false);

  const isDark = theme === 'dark';
  const { t, locale } = useTranslation();

  const lifetimeConversionRate = useMemo(() => {
    return totalLifetimeClicks > 0
      ? ((totalLifetimeRedemptions / totalLifetimeClicks) * 100).toFixed(1) + '%'
      : '0%';
  }, [totalLifetimeRedemptions, totalLifetimeClicks]);

  const isAnyAnalyticsLoading = loadingTotalDeals || loadingTotalClicks || loadingTotalRedemptions || loadingInvitesSent || loadingInvitesAccepted;

  // App-resume re-fetch: bump a nonce on foreground so every loader below
  // re-runs. Combined with the resilient() caches, a background→resume blip no
  // longer blanks the Intel cards.
  const [resumeNonce, setResumeNonce] = useState(0);
  useResumeRefetch(useCallback(() => setResumeNonce((n) => n + 1), []));

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod, resumeNonce]);

  useEffect(() => {
    const fetchLifetimeAnalytics = async () => {
      if (!user?.id) return;
      const merchantId = user.id;
      // Each total is resilient (retry + last-good cache) and never wipes to 0
      // on failure — at worst it keeps the last good number.
      const fetches = [
        (async () => {
          setLoadingTotalDeals(true);
          try {
            const { count } = await resilient(() => mDashboardService.getTotalLifetimeDeals(merchantId), { cacheKey: `an_ltdeals_${merchantId}` });
            setTotalLifetimeDeals(count || 0);
          } catch { /* keep last-good */ }
          finally { setLoadingTotalDeals(false); }
        })(),
        (async () => {
          setLoadingTotalClicks(true);
          try {
            const { count } = await resilient(() => mDashboardService.getTotalLifetimeClicks(merchantId), { cacheKey: `an_ltclicks_${merchantId}` });
            setTotalLifetimeClicks(count || 0);
          } catch { /* keep last-good */ }
          finally { setLoadingTotalClicks(false); }
        })(),
        (async () => {
          setLoadingTotalRedemptions(true);
          try {
            const { count } = await resilient(() => mDashboardService.getTotalLifetimeRedemptions(merchantId), { cacheKey: `an_ltredeem_${merchantId}` });
            setTotalLifetimeRedemptions(count || 0);
          } catch { /* keep last-good */ }
          finally { setLoadingTotalRedemptions(false); }
        })(),
        (async () => {
          setLoadingInvitesSent(true);
          try {
            const { count } = await resilient(() => mDashboardService.getTotalInvitesSent(merchantId), { cacheKey: `an_invsent_${merchantId}` });
            setTotalInvitesSent(count || 0);
          } catch { /* keep last-good */ }
          finally { setLoadingInvitesSent(false); }
        })(),
        (async () => {
          setLoadingInvitesAccepted(true);
          try {
            const { count } = await resilient(() => mDashboardService.getTotalInvitesAccepted(merchantId), { cacheKey: `an_invacc_${merchantId}` });
            setTotalInvitesAccepted(count || 0);
          } catch { /* keep last-good */ }
          finally { setLoadingInvitesAccepted(false); }
        })(),
      ];

      await Promise.allSettled(fetches);
    };

    fetchLifetimeAnalytics();
  }, [user?.id, resumeNonce]);

  // Fetch repeat customer metrics
  useEffect(() => {
    if (!user?.id) return;
    setLoadingRepeat(true);
    resilient(() => mDashboardService.getRepeatCustomers(user.id), { cacheKey: `an_repeat_${user.id}` })
      .then(data => setRepeatData(data))
      .catch(() => { /* keep last-good repeatData */ })
      .finally(() => setLoadingRepeat(false));
  }, [user?.id, resumeNonce]);

  useEffect(() => {
    const fetchCatalogueStats = async () => {
      if (!user?.id) return;
      setLoadingCatalogue(true);
      setLoadingTopProducts(true);

      try {
        const data = await resilient(async () => {
          const { data, error } = await supabase.functions.invoke('get-product-analytics', { body: { merchantId: user.id } });
          if (error) throw error;
          return data;
        }, { cacheKey: `an_catalogue_${user.id}` });

        const { topProducts: topPerformers, productInsights, totalProducts, totalViews, totalLikes } = data;
        setTopProducts(topPerformers || []);
        setProductInsights(productInsights || {
          bestCategory: '', avgViewsPerProduct: 0, avgLikesPerProduct: 0,
          topPerformerName: '', lowPerformerCount: 0,
        });
        setCatalogueStats({
          activeProducts: totalProducts || 0,
          totalViews: totalViews || 0,
          totalLikes: totalLikes || 0,
        });
      } catch {
        /* keep last-good catalogue stats + top products */
      } finally {
        setLoadingCatalogue(false);
        setLoadingTopProducts(false);
      }
    };

    fetchCatalogueStats();
  }, [user?.id, resumeNonce]);

  useEffect(() => {
    const fetchPerformanceScore = async () => {
      if (!user?.id) return;
      setLoadingPerformanceScore(true);
      try {
        const score = await resilient(() => performanceScoreService.getScore(user.id, locale), { cacheKey: `an_perfscore_${user.id}_${locale}` });
        setPerformanceScore(score);
      } catch {
        /* keep last-good score */
      } finally {
        setLoadingPerformanceScore(false);
      }
    };

    fetchPerformanceScore();
  }, [user?.id, resumeNonce, locale]);

  useEffect(() => {
    const fetchAIInsights = async () => {
      if (!user?.id) return;
      setLoadingAiInsights(true);
      try {
        const insights = await resilient(() => aiInsightsService.getAIInsights(user.id, locale), { cacheKey: `an_aiinsights_${user.id}_${locale}` });
        setAiInsights(insights);
      } catch {
        /* keep last-good insights */
      } finally {
        setLoadingAiInsights(false);
      }
    };

    fetchAIInsights();
  }, [user?.id, resumeNonce, locale]);

  const fetchAnalytics = async () => {
    // ---- Reliability rework ---------------------------------------------
    // The previous version flipped the whole screen to "Unable to load
    // analytics" on any transient supabase function blip, even when we had
    // perfectly good analytics from a prior fetch. Testers hit the error
    // page on every other open. New strategy:
    //   1. Restore the last-known analytics from cache instantly so the screen
    //      never blanks — the user sees their numbers immediately.
    //   2. Refresh in the background with auto-retry + exponential backoff
    //      (3 attempts: 0ms, ~800ms, ~1600ms) so a single bad request doesn't
    //      surface as an error.
    //   3. Only ever show the full-screen error UI when we have NOTHING to
    //      show (no cache + all retries failed). If retries fail but cached
    //      analytics are on screen, keep them visible and just log — the user
    //      can pull to refresh / tap a period to retry.
    const cacheKey = `merchant_analytics_${user?.id ?? 'anon'}_${selectedPeriod}`;
    let haveSomethingOnScreen = false;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setAnalytics(JSON.parse(cached));
        setLoading(false);
        haveSomethingOnScreen = true;
      }
    } catch { /* malformed cache — ignore */ }

    if (!haveSomethingOnScreen) setLoading(true);
    setError(null);

    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke('merchant-analytics', {
          body: { period: selectedPeriod },
        });
        if (error) throw error;
        setAnalytics(data);
        setError(null);
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* quota — non-fatal */ }
        setLoading(false);
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1))); // 800ms, 1600ms
        }
      }
    }

    // All 3 attempts failed.
    console.warn('[MerchantAnalytics] fetch failed after retries:', lastErr);
    setLoading(false);
    if (!haveSomethingOnScreen) {
      // Truly nothing to show — surface the error screen + Retry button.
      setError('Unable to load analytics. Please try again.');
    }
    // else: keep showing the cached analytics, don't blank the screen.
  };

  if (loading) {
    return (
      <div className={`px-6 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`px-6 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm font-medium text-red-500">{t('man_error')}</p>
          <button
            onClick={fetchAnalytics}
            className="h-10 px-6 bg-slate-900 text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-all"
          >
            {t('man_retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  const maxTrendValue = Math.max(...analytics.campaignTrend.map(d => d.count), 1);

  return (
    <div className={`px-6 pt-6 pb-32 space-y-6 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

      {/* AI Insights CTA */}
      {setView && (
        <button
          onClick={() => setView('merchant_ai_insights')}
          className={`w-full p-4 rounded-xl flex items-center gap-3 text-left active:scale-[0.98] transition-all border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isDark ? 'bg-purple-500/10' : 'bg-purple-50'
          }`}>
            <Brain className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_ai_dashboard')}</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_ai_dashboard_sub')}</p>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        </button>
      )}

      {/* Header */}
      <div>
        <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('man_title')}
        </h1>
        <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {user.store_name || t('man_my_insights')}
        </p>
      </div>

      {/* Consumer reach — how many DealFynd consumers are signed up in each store's
          area. Upper part of the page, just under the header. Always rendered so
          it's never invisible; shows an empty/loading state when needed. */}
      {(
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Users className="w-[18px] h-[18px] text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Consumers in your area</p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>DealFynd shoppers signed up near each of your stores</p>
            </div>
          </div>

          {loadingReach ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : consumerReach.length === 0 ? (
            <div className={`px-4 py-6 text-center text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              No data yet — add a store, or ensure the reach function is deployed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`text-left ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <th className="font-medium text-[11px] uppercase tracking-wide px-4 py-2">Your store locality</th>
                    <th className="font-medium text-[11px] uppercase tracking-wide px-4 py-2 text-right">Consumers</th>
                  </tr>
                </thead>
                <tbody>
                  {consumerReach.map((r) => (
                    <tr key={r.store_id} className={`border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <td className={`px-4 py-3 font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {r.locality || r.city || '—'}
                        {r.pincode && <span className={`font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}> ({r.pincode})</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-lg font-bold text-emerald-500">{r.consumer_count.toLocaleString('en-IN')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Period Selector */}
      <div className={`flex gap-1 p-1 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
        {(['7', '30', 'lifetime'] as const).map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              selectedPeriod === period
                ? 'bg-slate-900 text-white'
                : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {period === 'lifetime' ? t('man_lifetime') : t('man_n_days').replace('{n}', period)}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl p-3 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_campaigns')}</span>
          </div>
          <p className={`text-2xl font-semibold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{analytics.totalCampaigns}</p>
        </div>

        <div className={`rounded-xl p-3 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_active')}</span>
          </div>
          <p className={`text-2xl font-semibold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{analytics.activeCampaigns}</p>
        </div>

        <div className={`rounded-xl p-3 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <TicketCheck className="w-3.5 h-3.5 text-amber-500" />
            <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_redeemed')}</span>
          </div>
          <p className={`text-2xl font-semibold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalLifetimeRedemptions.toLocaleString()}</p>
        </div>
      </div>

      {/* Campaign Status */}
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_campaign_status')}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-lg p-3 border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('man_approved')}</p>
            <p className="text-xl font-semibold text-emerald-500">{analytics.statusBreakdown.approved}</p>
          </div>
          <div className={`rounded-lg p-3 border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('man_in_review')}</p>
            <p className="text-xl font-semibold text-amber-500">{analytics.statusBreakdown.review}</p>
          </div>
          <div className={`rounded-lg p-3 border ${isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{t('man_needs_review')}</p>
            <p className="text-xl font-semibold text-orange-500">{analytics.statusBreakdown.needs_review}</p>
          </div>
          <div className={`rounded-lg p-3 border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
            <p className={`text-xs font-medium mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>{t('man_expired')}</p>
            <p className="text-xl font-semibold text-red-500">{analytics.statusBreakdown.expired}</p>
          </div>
        </div>
      </div>

      {/* Campaign Trend Chart */}
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-blue-500" />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_campaign_trend')}</h3>
        </div>

        <div className="relative h-48 mt-4">
          <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradientMerchant" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="0"
                y1={i * 30}
                x2="400"
                y2={i * 30}
                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                strokeWidth="1"
              />
            ))}

            {(() => {
              const data = analytics.campaignTrend;
              const maxValue = Math.max(...data.map(d => d.count), 1);
              const points = data.map((item, index) => {
                const x = (index / Math.max(data.length - 1, 1)) * 400;
                const y = 120 - (item.count / maxValue) * 100;
                return { x, y, count: item.count };
              });

              const linePath = points.map((p, i) =>
                `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              ).join(' ');

              const areaPath = `${linePath} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;

              return (
                <>
                  <path d={areaPath} fill="url(#areaGradientMerchant)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((point, index) => (
                    <g key={index}>
                      <circle cx={point.x} cy={point.y} r="2" fill="#3b82f6" stroke="white" strokeWidth="1" />
                      <text
                        x={point.x}
                        y={point.y - 8}
                        textAnchor="middle"
                        className={`text-[8px] font-medium ${isDark ? 'fill-slate-400' : 'fill-slate-500'}`}
                        style={{ fontFamily: 'inherit' }}
                      >
                        {point.count}
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>

          <div className="flex justify-between mt-3 px-1">
            {analytics.campaignTrend.map((item, index) => {
              const showLabel = analytics.campaignTrend.length <= 7 ||
                                index === 0 ||
                                index === analytics.campaignTrend.length - 1 ||
                                index % Math.ceil(analytics.campaignTrend.length / 5) === 0;
              return (
                <span
                  key={index}
                  className={`text-[8px] font-medium ${
                    showLabel ? (isDark ? 'text-slate-500' : 'text-slate-400') : 'text-transparent'
                  }`}
                  style={{ flex: 1, textAlign: index === 0 ? 'left' : index === analytics.campaignTrend.length - 1 ? 'right' : 'center' }}
                >
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              );
            })}
          </div>

          <div className={`absolute -left-1 top-0 text-[8px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {maxTrendValue}
          </div>
          <div className={`absolute -left-1 bottom-8 text-[8px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            0
          </div>
        </div>
      </div>

      {/* Lifetime Analytics */}
      <div className="space-y-4">
        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_lifetime_analytics')}</h3>

        {isAnyAnalyticsLoading ? (
          <div className={`p-12 rounded-xl border text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <Loader2 className="w-6 h-6 mx-auto mb-3 text-slate-400 animate-spin" />
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_loading_lifetime')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t('man_total_clicks'), value: totalLifetimeClicks.toLocaleString(), icon: MousePointer2, color: 'amber' },
              { label: t('man_conversion_rate'), value: lifetimeConversionRate, icon: Percent, color: 'blue' },
              { label: t('man_invites_sent'), value: totalInvitesSent.toLocaleString(), icon: HeartHandshake, color: 'purple' },
              { label: t('man_invites_accepted'), value: totalInvitesAccepted.toLocaleString(), icon: CheckCircle2, color: 'emerald' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  isDark ? `bg-${color}-500/10` : `bg-${color}-50`
                }`}>
                  <Icon className={`w-5 h-5 text-${color}-500`} />
                </div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Repeat Customer Tracking */}
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_customer_loyalty')}</h3>
          </div>
          {loadingRepeat && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        {!loadingRepeat && repeatData ? (
          repeatData.totalCustomers === 0 ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('man_no_redemption')}
            </p>
          ) : (
            <>
              {/* Key metrics row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className={`rounded-lg p-3 text-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{repeatData.totalCustomers}</p>
                  <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_total_customers')}</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                  <p className="text-xl font-bold text-violet-500">{repeatData.repeatCustomers}</p>
                  <p className={`text-[10px] font-medium ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{t('man_repeat')}</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <p className="text-xl font-bold text-emerald-500">{repeatData.repeatRate}%</p>
                  <p className={`text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('man_repeat_rate')}</p>
                </div>
              </div>

              {/* Frequency breakdown */}
              <div className="mb-4">
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_redemption_frequency')}</p>
                <div className="space-y-1.5">
                  {[
                    { label: t('man_1_time'), count: repeatData.frequencyBreakdown.once, color: 'bg-slate-400' },
                    { label: t('man_2_times'), count: repeatData.frequencyBreakdown.twice, color: 'bg-blue-500' },
                    { label: t('man_3_5_times'), count: repeatData.frequencyBreakdown.threeToFive, color: 'bg-violet-500' },
                    { label: t('man_6_plus_times'), count: repeatData.frequencyBreakdown.sixPlus, color: 'bg-amber-500' },
                  ].filter(r => r.count > 0).map(row => {
                    const pct = repeatData.totalCustomers > 0 ? Math.round((row.count / repeatData.totalCustomers) * 100) : 0;
                    return (
                      <div key={row.label} className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium w-16 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{row.label}</span>
                        <div className={`flex-1 h-5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(pct, 4)}%` }} />
                        </div>
                        <span className={`text-[11px] font-semibold w-8 text-right ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top repeaters */}
              {repeatData.topRepeaters.length > 0 && (
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_top_loyal')}</p>
                  <div className="space-y-2">
                    {repeatData.topRepeaters.map((r, i) => (
                      <div key={r.consumerId} className={`flex items-center gap-2.5 p-2 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-amber-700 text-white' : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {i < 3 ? <Crown className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{(r as any).name || t('man_customer')}</p>
                          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_n_different_deals').replace('{n}', String(r.uniqueDeals))}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-md ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
                          <span className="text-[11px] font-bold text-violet-500">{r.count}x</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avg redemptions per customer */}
              <div className={`mt-3 flex items-center gap-2 p-2.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <Repeat className="w-4 h-4 text-blue-500" />
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {t('man_avg_redemptions').replace('{n}', String(repeatData.avgRedemptionsPerCustomer))}
                </span>
              </div>
            </>
          )
        ) : !loadingRepeat ? (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_unable_customer')}</p>
        ) : null}
      </div>

      {/* Product Catalogue Stats */}
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_product_catalogue')}</h3>
          {loadingCatalogue && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t('man_products'), value: catalogueStats.activeProducts, icon: Package, color: 'blue' },
            { label: t('man_views'), value: catalogueStats.totalViews, icon: Eye, color: 'slate' },
            { label: t('man_likes'), value: catalogueStats.totalLikes, icon: Heart, color: 'pink' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`rounded-lg p-3 text-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <Icon className={`w-5 h-5 text-${color}-500 mx-auto mb-1.5`} />
              <p className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
              <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performing Products */}
      {catalogueStats.activeProducts > 0 && (
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_top_performers')}</h3>
            </div>
            {loadingTopProducts && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          </div>

          {topProducts.length > 0 ? (
            <div className="space-y-2">
              {topProducts.map((product, index) => (
                <div
                  key={product.id}
                  className={`p-3 rounded-lg flex items-center gap-3 border ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                    index === 0
                      ? 'bg-amber-500 text-white'
                      : index === 1
                      ? 'bg-slate-400 text-white'
                      : index === 2
                      ? 'bg-amber-700 text-white'
                      : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {index + 1}
                  </div>

                  <div className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{product.name}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{product.category}</p>
                  </div>

                  <div className="flex flex-col gap-0.5 text-right">
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-blue-500" />
                      <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{product.views}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-pink-500" />
                      <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{product.likes}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Package className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_no_product_data')}</p>
            </div>
          )}
        </div>
      )}

      {/* Product Insights */}
      {catalogueStats.activeProducts > 0 && (
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_smart_insights')}</h3>
          </div>

          <div className="space-y-2">
            <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <Star className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_top_category')}</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{productInsights.bestCategory}</p>
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_top_category_tip')}</p>
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_avg_performance')}</p>
                  <div className="flex gap-4 mt-1">
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{productInsights.avgViewsPerProduct}</p>
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_views_per_product')}</p>
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{productInsights.avgLikesPerProduct}</p>
                      <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_likes_per_product')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {productInsights.lowPerformerCount > 0 && (
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                    <TrendingDown className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_needs_attention')}</p>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_n_products').replace('{n}', String(productInsights.lowPerformerCount))}</p>
                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_needs_attention_tip')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Performance Score */}
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_performance_score')}</h3>
          </div>
          {loadingPerformanceScore && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        {performanceScore ? (
          <div className="space-y-4">
            {/* Score Gauge */}
            <div className="flex flex-col items-center py-4">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="56" cy="56" r="48"
                    stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    strokeWidth="10" fill="none"
                  />
                  <circle
                    cx="56" cy="56" r="48"
                    stroke="#3b82f6"
                    strokeWidth="10" fill="none"
                    strokeDasharray={`${2 * Math.PI * 48}`}
                    strokeDashoffset={`${2 * Math.PI * 48 * (1 - performanceScore.totalScore / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className={`text-3xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{performanceScore.totalScore}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/ 100</p>
                </div>
              </div>

              <div className={`mt-3 px-3 py-1 rounded-full text-xs font-medium ${
                performanceScore.grade === 'Excellent' ? isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600' :
                performanceScore.grade === 'Good' ? isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600' :
                performanceScore.grade === 'Fair' ? isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600' :
                isDark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-600'
              }`}>
                {t('man_grade_' + performanceScore.grade.toLowerCase().replace(/ /g, '_'))}
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="space-y-2">
              <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_score_breakdown')}</p>
              {performanceScore.factors.map((factor) => (
                <div key={factor.name} className={`rounded-lg p-3 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        factor.status === 'excellent' ? 'bg-emerald-500' :
                        factor.status === 'good' ? 'bg-blue-500' :
                        'bg-orange-500'
                      }`} />
                      <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{factor.name}</p>
                    </div>
                    <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {factor.score}/{factor.maxScore}
                    </p>
                  </div>

                  <div className={`w-full h-1.5 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        factor.status === 'excellent' ? 'bg-emerald-500' :
                        factor.status === 'good' ? 'bg-blue-500' :
                        'bg-orange-500'
                      }`}
                      style={{ width: `${(factor.score / factor.maxScore) * 100}%` }}
                    />
                  </div>

                  <p className={`text-[10px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{factor.message}</p>

                  {factor.tips && factor.tips.length > 0 && (
                    <div className={`mt-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {factor.tips.map((tip, idx) => (
                        <p key={idx} className="text-[10px] text-orange-500 flex items-start gap-1 mt-0.5">
                          <span className="mt-0.5">*</span>
                          <span>{tip}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Wins */}
            {performanceScore.quickWins.length > 0 && (
              <div className={`p-4 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('man_quick_wins')}</p>
                </div>
                <div className="space-y-2">
                  {performanceScore.quickWins.map((win, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <p className={`flex-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{win.tip}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                      }`}>+{win.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {setView && (
              <button
                onClick={() => setView('merchant_ai_insights')}
                className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Brain className="w-4 h-4" />
                {t('man_view_ai_dashboard')}
              </button>
            )}
          </div>
        ) : !loadingPerformanceScore ? (
          <div className="text-center py-6">
            <Award className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_calculating_score')}</p>
          </div>
        ) : null}
      </div>

      {/* AI Recommendations */}
      <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" />
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('man_ai_recommendations')}</h3>
          </div>
          {loadingAiInsights && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>

        {aiInsights.length > 0 ? (
          <div className="space-y-2">
            {aiInsights.map((insight) => {
              const impactColors = {
                high: { bg: isDark ? 'bg-red-500/10' : 'bg-red-50', border: isDark ? 'border-red-500/20' : 'border-red-200', text: 'text-red-500' },
                medium: { bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50', border: isDark ? 'border-orange-500/20' : 'border-orange-200', text: 'text-orange-500' },
                low: { bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', border: isDark ? 'border-blue-500/20' : 'border-blue-200', text: 'text-blue-500' },
              };

              const typeIcons = {
                pricing: Target,
                timing: Clock,
                action: Zap,
                category: Package,
                engagement: TrendingUp,
              };

              const colors = impactColors[insight.impact];
              const Icon = typeIcons[insight.type];

              return (
                <div key={insight.id} className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isDark ? 'bg-slate-800' : 'bg-white'
                    }`}>
                      <Icon className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-xs font-semibold ${colors.text}`}>{insight.title}</p>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${colors.text} ${
                          isDark ? 'bg-slate-800' : 'bg-white'
                        }`}>
                          {t('man_impact_' + insight.impact)}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {insight.recommendation}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                          <div
                            className={`h-full rounded-full ${
                              insight.impact === 'high' ? 'bg-red-500' :
                              insight.impact === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${insight.confidence}%` }}
                          />
                        </div>
                        <span className={`text-[9px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{insight.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !loadingAiInsights ? (
          <div className="text-center py-6">
            <Brain className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('man_ai_analyzing')}</p>
            <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('man_ai_analyzing_sub')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
