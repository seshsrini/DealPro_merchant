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
      <div className={`px-4 pt-4 pb-28 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          <p className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`px-4 pt-4 pb-28 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm font-medium text-red-500">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-all"
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
    <div className={`px-4 pt-4 pb-28 space-y-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Analytics</h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaign performance overview</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
          <BarChart3 className="w-4 h-4 text-blue-500" />
        </div>
      </div>

      {/* Period Selector & Reports Dropdown */}
      <div className="flex justify-between items-center gap-2">
        {/* Period Buttons */}
        <div className={`flex p-1 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {(['7', '30', 'lifetime'] as const).map(period => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                selectedPeriod === period
                  ? 'bg-slate-900 text-white'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-300'
                    : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {period === 'lifetime' ? 'All' : `${period}d`}
            </button>
          ))}
        </div>

        {/* Reports Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowReportsDropdown(!showReportsDropdown)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 border ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-amber-500 hover:border-slate-700'
                : 'bg-white border-slate-200 text-amber-600 hover:border-slate-300'
            }`}
          >
            Reports
            <ChevronDown className={`w-3 h-3 transition-transform ${showReportsDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showReportsDropdown && (
            <div className={`absolute right-0 top-full mt-1.5 w-52 rounded-xl border overflow-hidden z-50 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
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
                  }}
                  className={`w-full px-4 py-2.5 text-left text-xs font-medium transition-all flex items-center gap-2 ${
                    isDark
                      ? 'text-slate-300 hover:bg-slate-800 border-b border-slate-800 last:border-b-0'
                      : 'text-slate-600 hover:bg-slate-50 border-b border-slate-100 last:border-b-0'
                  }`}
                >
                  {item === 'Live Reports' && (
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  )}
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: BarChart3, color: 'blue', label: 'Total Campaigns', value: analytics.totalCampaigns },
          { icon: TrendingUp, color: 'emerald', label: 'Active', value: analytics.activeCampaigns },
          { icon: Store, color: 'purple', label: 'Merchants', value: analytics.totalMerchants },
          { icon: PieChart, color: 'amber', label: 'Categories', value: analytics.categoriesWithDeals.length },
        ].map((metric, i) => {
          const Icon = metric.icon;
          const colorMap: Record<string, { iconBg: string; iconBgLight: string; iconText: string }> = {
            blue: { iconBg: 'bg-blue-500/10', iconBgLight: 'bg-blue-50', iconText: 'text-blue-500' },
            emerald: { iconBg: 'bg-emerald-500/10', iconBgLight: 'bg-emerald-50', iconText: 'text-emerald-500' },
            purple: { iconBg: 'bg-purple-500/10', iconBgLight: 'bg-purple-50', iconText: 'text-purple-500' },
            amber: { iconBg: 'bg-amber-500/10', iconBgLight: 'bg-amber-50', iconText: 'text-amber-500' },
          };
          const c = colorMap[metric.color];

          return (
            <div key={i} className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? c.iconBg : c.iconBgLight}`}>
                  <Icon className={`w-3.5 h-3.5 ${c.iconText}`} />
                </div>
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{metric.label}</span>
              </div>
              <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{metric.value}</p>
            </div>
          );
        })}
      </div>

      {/* Status Breakdown */}
      <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>Campaign Status</h3>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Approved', value: analytics.statusBreakdown.approved, color: 'emerald' },
            { label: 'In Review', value: analytics.statusBreakdown.review, color: 'amber' },
            { label: 'Needs Review', value: analytics.statusBreakdown.needs_review, color: 'orange' },
            { label: 'Expired', value: analytics.statusBreakdown.expired, color: 'red' },
          ].map((status, i) => {
            const colorMap: Record<string, { bg: string; bgLight: string; text: string; textLight: string }> = {
              emerald: { bg: 'bg-emerald-500/10 border-emerald-500/20', bgLight: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-400', textLight: 'text-emerald-600' },
              amber: { bg: 'bg-amber-500/10 border-amber-500/20', bgLight: 'bg-amber-50 border-amber-200', text: 'text-amber-400', textLight: 'text-amber-600' },
              orange: { bg: 'bg-orange-500/10 border-orange-500/20', bgLight: 'bg-orange-50 border-orange-200', text: 'text-orange-400', textLight: 'text-orange-600' },
              red: { bg: 'bg-red-500/10 border-red-500/20', bgLight: 'bg-red-50 border-red-200', text: 'text-red-400', textLight: 'text-red-600' },
            };
            const c = colorMap[status.color];

            return (
              <div key={i} className={`rounded-lg border p-3 ${isDark ? c.bg : c.bgLight}`}>
                <p className={`text-[10px] font-medium mb-1 ${isDark ? c.text : c.textLight}`}>{status.label}</p>
                <p className={`text-xl font-semibold ${isDark ? c.text : c.textLight}`}>{status.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaign Trend Chart */}
      <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-blue-500" />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Campaign Creation Trend</h3>
        </div>

        {/* Line Chart */}
        <div className="relative h-48 mt-4">
          <svg viewBox="0 0 400 150" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
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
                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                strokeWidth="1"
              />
            ))}

            {/* Data visualization */}
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
                  <path d={areaPath} fill="url(#areaGradient)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((point, index) => (
                    <g key={index}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="2"
                        fill="#3b82f6"
                        stroke={isDark ? '#0f172a' : '#ffffff'}
                        strokeWidth="1"
                      />
                      <text
                        x={point.x}
                        y={point.y - 8}
                        textAnchor="middle"
                        className={`text-[8px] font-medium ${isDark ? 'fill-blue-400' : 'fill-blue-600'}`}
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

          {/* X-axis labels */}
          <div className="flex justify-between mt-2 px-1">
            {analytics.campaignTrend.map((item, index) => {
              const showLabel = analytics.campaignTrend.length <= 7 ||
                                index === 0 ||
                                index === analytics.campaignTrend.length - 1 ||
                                index % Math.ceil(analytics.campaignTrend.length / 5) === 0;

              return (
                <span
                  key={index}
                  className={`text-[8px] font-medium ${
                    showLabel
                      ? isDark ? 'text-slate-500' : 'text-slate-400'
                      : 'text-transparent'
                  }`}
                  style={{ flex: 1, textAlign: index === 0 ? 'left' : index === analytics.campaignTrend.length - 1 ? 'right' : 'center' }}
                >
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              );
            })}
          </div>

          {/* Y-axis labels */}
          <div className={`absolute -left-1 top-0 text-[8px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {maxTrendValue}
          </div>
          <div className={`absolute -left-1 bottom-8 text-[8px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            0
          </div>
        </div>
      </div>

      {/* Category Distribution */}
      <div className={`rounded-xl border p-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-4 h-4 text-amber-500" />
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Categories with Deals</h3>
        </div>

        {/* Bar Chart */}
        <div className="space-y-2.5 mb-6">
          {analytics.categoriesWithDeals.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {item.category}
                </span>
                <span className={`text-[10px] font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  {item.count} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
              <div className={`rounded-full h-2.5 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
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
          <div className="relative w-44 h-44">
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
                    stroke={isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)'}
                    strokeWidth="0.5"
                  />
                );

                acc.currentAngle = endAngle;
                return acc;
              }, { elements: [] as JSX.Element[], currentAngle: 0 }).elements}

              {/* Center circle for donut effect */}
              <circle cx="50" cy="50" r="20" fill={isDark ? '#0f172a' : '#ffffff'} />
            </svg>

            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analytics.categoriesWithDeals.length}</p>
                <p className={`text-[8px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Categories</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
