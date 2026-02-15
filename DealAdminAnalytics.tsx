import React, { useState, useEffect, useRef } from 'react';
import { User } from './types';
import { Loader2, TrendingUp, PieChart, BarChart3, Calendar, Store, AlertCircle, ChevronDown } from 'lucide-react';
import { supabase } from './services/supabaseClient';

interface DealAdminAnalyticsProps {
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
  totalMerchants: number;
  categoriesWithDeals: CategoryData[];
  campaignTrend: TrendData[];
  statusBreakdown: {
    approved: number;
    review: number;
    needs_review: number;
    expired: number;
  };
}

export const DealAdminAnalytics: React.FC<DealAdminAnalyticsProps> = ({ user, theme }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'7' | '30' | 'lifetime'>('30');
  const [showReportsDropdown, setShowReportsDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowReportsDropdown(false);
      }
    };

    if (showReportsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReportsDropdown]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('dealadmin-analytics', {
        body: { period: selectedPeriod }
      });

      if (error) {
        console.error('[DealAdminAnalytics] Error fetching analytics:', error);
        setError(error.message || 'Failed to fetch analytics');
        return;
      }

      console.log('[DealAdminAnalytics] Analytics data:', data);
      setAnalytics(data);
    } catch (err: any) {
      console.error('[DealAdminAnalytics] Exception:', err);
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316'];

  if (loading) {
    return (
      <div className="px-6 pt-6 pb-32 animate-reveal">
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">
            Loading Analytics
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
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
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
  const maxCategoryValue = Math.max(...analytics.categoriesWithDeals.map(d => d.count), 1);

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">
          Analytics<br />
          <span className="text-blue-500">Dashboard</span>
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">ADMIN INSIGHTS</p>
        </div>
      </div>

      {/* Period Selector & Reports Dropdown */}
      <div className="flex justify-between items-center gap-2 mb-6">
        {/* Period Buttons */}
        <div className="flex gap-2">
          {(['7', '30', 'lifetime'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedPeriod === period
                  ? 'bg-blue-600 text-white shadow-xl'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              {period === 'lifetime' ? 'Lifetime' : `${period} Days`}
            </button>
          ))}
        </div>

        {/* Reports Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowReportsDropdown(!showReportsDropdown)}
            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 text-amber-500 hover:bg-white/10 hover:text-amber-400 flex items-center gap-2"
          >
            Reports
            <ChevronDown className={`w-3 h-3 transition-transform ${showReportsDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showReportsDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 glass rounded-xl border-white/10 shadow-2xl overflow-hidden z-50">
              {[
                'Live Reports',
                'Merchant Analytics',
                'Consumer Analytics',
                'Business Analytics',
                'City Reports',
                'State Reports',
                'Payments Dashboard'
              ].map((item, index) => (
                <button
                  key={index}
                  onClick={() => {
                    console.log(`Selected: ${item}`);
                    setShowReportsDropdown(false);
                    // TODO: Navigate to different analytics views
                  }}
                  className="w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-300 hover:bg-white/10 hover:text-white transition-all border-b border-white/5 last:border-b-0 flex items-center gap-2"
                >
                  {item === 'Live Reports' && (
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  )}
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="glass rounded-2xl p-4 border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Campaigns</span>
          </div>
          <p className="text-3xl font-black text-white">{analytics.totalCampaigns}</p>
        </div>

        <div className="glass rounded-2xl p-4 border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Active</span>
          </div>
          <p className="text-3xl font-black text-white">{analytics.activeCampaigns}</p>
        </div>

        <div className="glass rounded-2xl p-4 border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-4 h-4 text-purple-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Merchants</span>
          </div>
          <p className="text-3xl font-black text-white">{analytics.totalMerchants}</p>
        </div>

        <div className="glass rounded-2xl p-4 border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-4 h-4 text-amber-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Categories</span>
          </div>
          <p className="text-3xl font-black text-white">{analytics.categoriesWithDeals.length}</p>
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
          <Calendar className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Campaign Creation Trend</h3>
        </div>

        {/* Line Chart */}
        <div className="relative h-48 mt-6">
          <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              {/* Gradient for area fill */}
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>

              {/* Gradient for line */}
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
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
                    fill="url(#areaGradient)"
                  />

                  {/* Line */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#lineGradient)"
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
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="1"
                      />
                      {/* Value label above the point */}
                      <text
                        x={point.x}
                        y={point.y - 8}
                        textAnchor="middle"
                        className="text-[8px] font-black fill-blue-400"
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

      {/* Category Distribution */}
      <div className="glass rounded-2xl p-5 border-white/10 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Categories with Deals</h3>
        </div>

        {/* Bar Chart */}
        <div className="space-y-3 mb-6">
          {analytics.categoriesWithDeals.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">
                  {item.category}
                </span>
                <span className="text-[9px] font-black text-blue-400">
                  {item.count} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="bg-slate-800/50 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percentage}%`,
                    background: COLORS[index % COLORS.length]
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Pie Chart Visualization */}
        <div className="flex justify-center">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {analytics.categoriesWithDeals.reduce((acc, item, index) => {
                const startAngle = acc.currentAngle;
                const angle = (item.percentage / 100) * 360;
                const endAngle = startAngle + angle;

                const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

                const largeArc = angle > 180 ? 1 : 0;

                const pathData = [
                  `M 50 50`,
                  `L ${x1} ${y1}`,
                  `A 40 40 0 ${largeArc} 1 ${x2} ${y2}`,
                  `Z`
                ].join(' ');

                acc.elements.push(
                  <path
                    key={index}
                    d={pathData}
                    fill={COLORS[index % COLORS.length]}
                    stroke="rgba(0,0,0,0.2)"
                    strokeWidth="0.5"
                  />
                );

                acc.currentAngle = endAngle;
                return acc;
              }, { elements: [] as JSX.Element[], currentAngle: 0 }).elements}

              {/* Center circle for donut effect */}
              <circle cx="50" cy="50" r="20" fill={isDark ? '#0f172a' : '#1e293b'} />
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-black text-white">{analytics.categoriesWithDeals.length}</p>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Categories</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-10">
        <p className="text-[9px] font-black uppercase tracking-[0.6em] text-slate-700">ANALYTICS DASHBOARD</p>
      </div>
    </div>
  );
};
