import React, { useState, useEffect, useMemo } from 'react';
import { User } from './types';
import { Loader2, TrendingUp, PieChart, BarChart3, Calendar, AlertCircle, TicketCheck, MousePointer2, Percent, HeartHandshake, CheckCircle2, BarChart } from 'lucide-react';
import { supabase } from './services/supabaseClient';
import { mDashboardService } from './services/mDashboardService';

interface MerchantAnalyticsProps {
  user: User;
  theme: 'light' | 'dark';
}

interface CategoryData {
  category: string;
  count: number;
  percentage: number;
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

export const MerchantAnalytics: React.FC<MerchantAnalyticsProps> = ({ user, theme }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | 'lifetime'>('30');

  // Lifetime analytics states
  const [totalLifetimeDeals, setTotalLifetimeDeals] = useState(0);
  const [totalLifetimeClicks, setTotalLifetimeClicks] = useState(0);
  const [totalLifetimeRedemptions, setTotalLifetimeRedemptions] = useState(0);
  const [totalInvitesSent, setTotalInvitesSent] = useState(0);
  const [totalInvitesAccepted, setTotalInvitesAccepted] = useState(0);

  // Lifetime analytics loading states
  const [loadingTotalDeals, setLoadingTotalDeals] = useState(false);
  const [loadingTotalClicks, setLoadingTotalClicks] = useState(false);
  const [loadingTotalRedemptions, setLoadingTotalRedemptions] = useState(false);
  const [loadingInvitesSent, setLoadingInvitesSent] = useState(false);
  const [loadingInvitesAccepted, setLoadingInvitesAccepted] = useState(false);

  const isDark = theme === 'dark';

  // Lifetime conversion rate
  const lifetimeConversionRate = useMemo(() => {
    return totalLifetimeClicks > 0
      ? ((totalLifetimeRedemptions / totalLifetimeClicks) * 100).toFixed(1) + '%'
      : '0%';
  }, [totalLifetimeRedemptions, totalLifetimeClicks]);

  // Overall loading for the lifetime analytics section
  const isAnyAnalyticsLoading = loadingTotalDeals || loadingTotalClicks || loadingTotalRedemptions || loadingInvitesSent || loadingInvitesAccepted;

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  // Fetch lifetime analytics
  useEffect(() => {
    const fetchLifetimeAnalytics = async () => {
      if (!user?.id) {
        console.log("[MerchantAnalytics] User ID not available for lifetime analytics, skipping fetch.");
        return;
      }

      const merchantId = user.id;

      const fetches = [
        (async () => {
          setLoadingTotalDeals(true);
          try {
            console.log("[MerchantAnalytics] Fetching totalLifetimeDeals for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalLifetimeDeals(merchantId);
            setTotalLifetimeDeals(count || 0);
            console.log("[MerchantAnalytics] totalLifetimeDeals fetched:", count);
          } catch (error) {
            console.error("[MerchantAnalytics] Error fetching totalLifetimeDeals:", error);
            setTotalLifetimeDeals(0);
          } finally {
            setLoadingTotalDeals(false);
          }
        })(),
        (async () => {
          setLoadingTotalClicks(true);
          try {
            console.log("[MerchantAnalytics] Fetching totalLifetimeClicks for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalLifetimeClicks(merchantId);
            setTotalLifetimeClicks(count || 0);
            console.log("[MerchantAnalytics] totalLifetimeClicks fetched:", count);
          } catch (error) {
            console.error("[MerchantAnalytics] Error fetching totalLifetimeClicks:", error);
            setTotalLifetimeClicks(0);
          } finally {
            setLoadingTotalClicks(false);
          }
        })(),
        (async () => {
          setLoadingTotalRedemptions(true);
          try {
            console.log("[MerchantAnalytics] Fetching totalLifetimeRedemptions for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalLifetimeRedemptions(merchantId);
            setTotalLifetimeRedemptions(count || 0);
            console.log("[MerchantAnalytics] totalLifetimeRedemptions fetched:", count);
          } catch (error) {
            console.error("[MerchantAnalytics] Error fetching totalLifetimeRedemptions:", error);
            setTotalLifetimeRedemptions(0);
          } finally {
            setLoadingTotalRedemptions(false);
          }
        })(),
        (async () => {
          setLoadingInvitesSent(true);
          try {
            console.log("[MerchantAnalytics] Fetching totalInvitesSent for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalInvitesSent(merchantId);
            setTotalInvitesSent(count || 0);
            console.log("[MerchantAnalytics] totalInvitesSent fetched:", count);
          } catch (error) {
            console.error("[MerchantAnalytics] Error fetching totalInvitesSent:", error);
            setTotalInvitesSent(0);
          } finally {
            setLoadingInvitesSent(false);
          }
        })(),
        (async () => {
          setLoadingInvitesAccepted(true);
          try {
            console.log("[MerchantAnalytics] Fetching totalInvitesAccepted for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalInvitesAccepted(merchantId);
            setTotalInvitesAccepted(count || 0);
            console.log("[MerchantAnalytics] totalInvitesAccepted fetched:", count);
          } catch (error) {
            console.error("[MerchantAnalytics] Error fetching totalInvitesAccepted:", error);
            setTotalInvitesAccepted(0);
          } finally {
            setLoadingInvitesAccepted(false);
          }
        })(),
      ];

      await Promise.allSettled(fetches);
      console.log("[MerchantAnalytics] All lifetime analytics fetches attempted.");
    };

    fetchLifetimeAnalytics();
  }, [user?.id]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('merchant-analytics', {
        body: { period: selectedPeriod }
      });

      if (error) {
        console.error('[MerchantAnalytics] Error fetching analytics:', error);
        setError(error.message || 'Failed to fetch analytics');
        return;
      }

      console.log('[MerchantAnalytics] Analytics data:', data);
      setAnalytics(data);
    } catch (err: any) {
      console.error('[MerchantAnalytics] Exception:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#ef4444', '#06b6d4', '#f97316'];

  if (loading) {
    return (
      <div className="px-6 pt-6 pb-32 animate-reveal">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">
            Loading Intel
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 pt-6 pb-32 animate-reveal">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <p className="text-sm font-bold text-red-500">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-6 py-3 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const maxTrendValue = Math.max(...analytics.campaignTrend.map(d => d.count), 1);

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">
          Campaign<br />
          <span className="text-yellow-500">Intel</span>
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <p className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.3em]">{user.store_name || 'MY INSIGHTS'}</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 mb-6">
        {(['7', '30', 'lifetime'] as const).map(period => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              selectedPeriod === period
                ? 'bg-yellow-600 text-white shadow-xl'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {period === 'lifetime' ? 'Lifetime' : `${period} Days`}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-2xl p-4 border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-yellow-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Campaigns</span>
          </div>
          <p className="text-3xl font-black text-white text-center">{analytics.totalCampaigns}</p>
        </div>

        <div className="glass rounded-2xl p-4 border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Active</span>
          </div>
          <p className="text-3xl font-black text-white text-center">{analytics.activeCampaigns}</p>
        </div>

        <div className="glass rounded-2xl p-4 border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <TicketCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Redemptions</span>
          </div>
          <p className="text-3xl font-black text-white text-center">{totalLifetimeRedemptions.toLocaleString()}</p>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="glass rounded-2xl p-5 border-white/10 mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4">Campaign Status</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-green-400 mb-1">Approved</p>
            <p className="text-2xl font-black text-green-500">{analytics.statusBreakdown.approved}</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-yellow-400 mb-1">In Review</p>
            <p className="text-2xl font-black text-yellow-500">{analytics.statusBreakdown.review}</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-1">Needs Review</p>
            <p className="text-2xl font-black text-orange-500">{analytics.statusBreakdown.needs_review}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-1">Expired</p>
            <p className="text-2xl font-black text-red-500">{analytics.statusBreakdown.expired}</p>
          </div>
        </div>
      </div>

      {/* Campaign Trend Chart */}
      <div className="glass rounded-2xl p-5 border-white/10 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-yellow-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Campaign Creation Trend</h3>
        </div>

        {/* Line Chart */}
        <div className="relative h-48 mt-6">
          <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              {/* Gradient for area fill */}
              <linearGradient id="areaGradientMerchant" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>

              {/* Gradient for line */}
              <linearGradient id="lineGradientMerchant" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <line
                key={i}
                x1="0"
                y1={i * 30}
                x2="400"
                y2={i * 30}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}

            {/* Data visualization */}
            {(() => {
              const data = analytics.campaignTrend;
              const maxValue = Math.max(...data.map(d => d.count), 1);
              const points = data.map((item, index) => {
                const x = (index / Math.max(data.length - 1, 1)) * 400;
                const y = 120 - (item.count / maxValue) * 100; // Invert Y and scale
                return { x, y, count: item.count };
              });

              // Create path data for the line
              const linePath = points.map((p, i) =>
                `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
              ).join(' ');

              // Create path data for the area (filled region under the line)
              const areaPath = `${linePath} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`;

              return (
                <>
                  {/* Area fill */}
                  <path
                    d={areaPath}
                    fill="url(#areaGradientMerchant)"
                  />

                  {/* Line */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#lineGradientMerchant)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data points with values */}
                  {points.map((point, index) => (
                    <g key={index}>
                      {/* Small dot at the point */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="2"
                        fill="#f59e0b"
                        stroke="white"
                        strokeWidth="1"
                      />
                      {/* Value label above the point */}
                      <text
                        x={point.x}
                        y={point.y - 8}
                        textAnchor="middle"
                        className="text-[8px] font-black fill-yellow-400"
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

          {/* X-axis labels (dates) */}
          <div className="flex justify-between mt-3 px-1">
            {analytics.campaignTrend.map((item, index) => {
              // Show only every Nth label to avoid crowding
              const showLabel = analytics.campaignTrend.length <= 7 ||
                                index === 0 ||
                                index === analytics.campaignTrend.length - 1 ||
                                index % Math.ceil(analytics.campaignTrend.length / 5) === 0;

              return (
                <span
                  key={index}
                  className={`text-[8px] font-black uppercase tracking-wider ${
                    showLabel ? 'text-slate-400' : 'text-transparent'
                  }`}
                  style={{ flex: 1, textAlign: index === 0 ? 'left' : index === analytics.campaignTrend.length - 1 ? 'right' : 'center' }}
                >
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              );
            })}
          </div>

          {/* Y-axis label */}
          <div className="absolute -left-1 top-0 text-[8px] font-black text-slate-400 uppercase tracking-wider">
            {maxTrendValue}
          </div>
          <div className="absolute -left-1 bottom-8 text-[8px] font-black text-slate-400 uppercase tracking-wider">
            0
          </div>
        </div>
      </div>

      {/* Lifetime Analytics Report */}
      <div className="mt-10 space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-yellow-600">Lifetime Analytics Report</h3>
          <div className="px-2 py-1 glass rounded-lg border-white/5">
            <span className="text-[10px] font-black text-yellow-500">Overall</span>
          </div>
        </div>

        {isAnyAnalyticsLoading ? (
          <div className="p-12 rounded-[2.5rem] border border-white/5 bg-slate-900/20 text-center animate-reveal">
            <BarChart className="w-8 h-8 mx-auto mb-4 text-slate-800" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Fetching Lifetime Data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Clicks */}
            <div className="group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border border-amber-500/20 bg-gradient-to-br from-amber-900/10 to-amber-500/5 shadow-2xl shadow-amber-500/10 overflow-hidden relative">
              <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 bg-amber-500"></div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-amber-500/10">
                <MousePointer2 className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-300">Total Clicks</p>
                <p className="text-3xl font-black text-white">{totalLifetimeClicks.toLocaleString()}</p>
              </div>
            </div>

            {/* Lifetime Conversion Rate */}
            <div className="group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border border-orange-500/20 bg-gradient-to-br from-orange-900/10 to-orange-500/5 shadow-2xl shadow-orange-500/10 overflow-hidden relative">
              <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 bg-orange-500"></div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-orange-500/10">
                <Percent className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-300">Conversion Rate</p>
                <p className="text-3xl font-black text-white">{lifetimeConversionRate}</p>
              </div>
            </div>

            {/* Referral Invites Sent */}
            <div className="group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border border-indigo-500/20 bg-gradient-to-br from-indigo-900/10 to-indigo-500/5 shadow-2xl shadow-indigo-500/10 overflow-hidden relative">
              <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 bg-indigo-500"></div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-500/10">
                <HeartHandshake className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-300">Referral Invites Sent</p>
                <p className="text-3xl font-black text-white">{totalInvitesSent.toLocaleString()}</p>
              </div>
            </div>

            {/* Referral Invites Accepted */}
            <div className="group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border border-purple-500/20 bg-gradient-to-br from-purple-900/10 to-purple-500/5 shadow-2xl shadow-purple-500/10 overflow-hidden relative">
              <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 bg-purple-500"></div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-purple-500/10">
                <CheckCircle2 className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-300">Referral Invites Accepted</p>
                <p className="text-3xl font-black text-white">{totalInvitesAccepted.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-center mt-10">
        <p className="text-[9px] font-black uppercase tracking-[0.6em] text-slate-700">MERCHANT INTEL</p>
      </div>
    </div>
  );
};
