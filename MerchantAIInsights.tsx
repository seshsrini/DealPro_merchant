/**
 * MerchantAIInsights.tsx
 * Dedicated AI Insights Dashboard
 * Comprehensive AI-powered recommendations and predictions
 */

import React, { useState, useEffect } from 'react';
import { User } from './types';
import {
  Brain,
  Loader2,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Target,
  Award,
  Lightbulb,
  ChevronRight,
  Sparkles,
  BarChart3,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Minus,
  ArrowDownRight,
  Calendar,
  Zap,
  Info,
  TrendingDown as TrendingDownIcon,
  ArrowLeft,
} from 'lucide-react';
import { aiInsightsDashboardService, DashboardInsights } from './services/aiInsightsDashboardService';
import { customerSegmentationService, SegmentationInsights } from './services/customerSegmentationService';
import { revenueForecastService, RevenueForecast } from './services/revenueForecastService';

interface MerchantAIInsightsProps {
  user: User;
  theme: 'light' | 'dark';
  setView: (view: any) => void;
}

export const MerchantAIInsights: React.FC<MerchantAIInsightsProps> = ({ user, theme, setView }) => {
  const isDark = theme === 'dark';
  const [insights, setInsights] = useState<DashboardInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [segmentation, setSegmentation] = useState<SegmentationInsights | null>(null);
  const [loadingSegmentation, setLoadingSegmentation] = useState(true);
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(true);

  useEffect(() => {
    fetchInsights();
    fetchSegmentation();
    fetchForecast();
  }, [user?.id]);

  const fetchInsights = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await aiInsightsDashboardService.getDashboardInsights(user.id);
      setInsights(data);
      console.log('[MerchantAIInsights] Dashboard insights fetched successfully');
    } catch (error) {
      console.error('[MerchantAIInsights] Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSegmentation = async () => {
    if (!user?.id) return;

    setLoadingSegmentation(true);
    try {
      const data = await customerSegmentationService.getSegments(user.id);
      setSegmentation(data);
      console.log('[MerchantAIInsights] Customer segmentation fetched successfully');
    } catch (error) {
      console.error('[MerchantAIInsights] Error fetching segmentation:', error);
    } finally {
      setLoadingSegmentation(false);
    }
  };

  const fetchForecast = async () => {
    if (!user?.id) return;

    setLoadingForecast(true);
    try {
      const data = await revenueForecastService.getForecast(user.id);
      setForecast(data);
      console.log('[MerchantAIInsights] Revenue forecast fetched successfully');
    } catch (error) {
      console.error('[MerchantAIInsights] Error fetching forecast:', error);
    } finally {
      setLoadingForecast(false);
    }
  };

  if (loading) {
    return (
      <div className={`px-5 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Brain className="w-14 h-14 text-purple-500" />
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            AI Analyzing Your Business
          </p>
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className={`px-5 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="text-center py-20">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Failed to load AI insights</p>
          <button
            onClick={fetchInsights}
            className="mt-4 h-11 px-6 bg-slate-900 text-white rounded-xl font-medium text-sm active:scale-[0.98] transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`px-5 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => setView('merchant_dashboard')} className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-[0.95] transition-all ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-700'}`} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Brain className="w-6 h-6 text-purple-500" />
            <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>AI Insights</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-12">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Powered by machine learning
          </p>
        </div>
      </div>

      {/* Performance Predictions */}
      <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
            <BarChart3 className="w-4 h-4 text-purple-500" />
          </div>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Next Week Predictions</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Predicted Views</p>
            </div>
            <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{insights.performancePredictions.nextWeekViews}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              <p className="text-xs text-emerald-500 font-medium">+{insights.performancePredictions.growthRate}% growth</p>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Award className="w-3.5 h-3.5 text-pink-500" />
              <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Predicted Likes</p>
            </div>
            <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{insights.performancePredictions.nextWeekLikes}</p>
            <div className="flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              <p className="text-xs text-emerald-500 font-medium">+{insights.performancePredictions.growthRate}% growth</p>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{insights.performancePredictions.confidence}% confidence based on historical trends</span>
        </div>
      </div>

      {/* Product Description Optimizer */}
      {insights.productOptimizations.length > 0 && (
        <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
              <FileText className="w-4 h-4 text-cyan-500" />
            </div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Product Description Optimizer</h3>
          </div>

          <div className="space-y-3">
            {insights.productOptimizations.map((opt) => (
              <div
                key={opt.productId}
                className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{opt.productName}</p>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 text-xs font-medium">
                    {opt.impactScore}% Impact
                  </span>
                </div>

                <div className="mb-2">
                  <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Current:</p>
                  <p className={`text-xs italic ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {opt.currentDescription || '(No description)'}
                  </p>
                </div>

                <div className="mb-2">
                  <p className="text-xs font-medium text-cyan-500 mb-0.5">AI Suggested:</p>
                  <p className={`text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{opt.suggestedDescription}</p>
                </div>

                <div>
                  <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Improvements:</p>
                  <ul className="space-y-1">
                    {opt.improvements.map((imp, idx) => (
                      <li key={idx} className={`flex items-start gap-2 text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <ChevronRight className="w-3 h-3 text-cyan-500 flex-shrink-0 mt-0.5" />
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing Strategies */}
      {insights.pricingStrategies.length > 0 && (
        <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Pricing Strategies</h3>
          </div>

          <div className="space-y-3">
            {insights.pricingStrategies.map((strategy) => (
              <div
                key={strategy.category}
                className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-3.5 h-3.5 text-emerald-500" />
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{strategy.category}</p>
                  </div>
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{strategy.productCount} products</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Discount Range</p>
                    <p className="text-lg font-semibold text-emerald-500">
                      {strategy.recommendedDiscountMin}-{strategy.recommendedDiscountMax}%
                    </p>
                  </div>
                  <div className={`rounded-lg p-2 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Expected Lift</p>
                    <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{strategy.expectedLift}</p>
                  </div>
                </div>

                <div className={`rounded-lg p-3 border ${isDark ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50 border-emerald-100'}`}>
                  <p className="text-xs font-medium text-emerald-500 mb-1">Optimal Strategy</p>
                  <p className={`text-xs mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{strategy.optimalPrice}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{strategy.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demand Forecasting */}
      {insights.demandForecasts.length > 0 && (
        <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <TrendingUp className="w-4 h-4 text-yellow-500" />
            </div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Demand Forecasting</h3>
          </div>

          <div className="space-y-3">
            {insights.demandForecasts.map((forecast) => {
              const trendIcons = {
                rising: { Icon: ArrowUpRight, color: 'text-emerald-500', bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50' },
                stable: { Icon: Minus, color: 'text-blue-500', bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50' },
                declining: { Icon: ArrowDownRight, color: 'text-red-500', bg: isDark ? 'bg-red-500/10' : 'bg-red-50' },
              };

              const { Icon, color, bg } = trendIcons[forecast.trend];

              return (
                <div
                  key={forecast.category}
                  className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-yellow-500" />
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{forecast.category}</p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${bg}`}>
                      <Icon className={`w-3 h-3 ${color}`} />
                      <span className={`text-xs font-medium capitalize ${color}`}>{forecast.trend}</span>
                    </div>
                  </div>

                  <div className={`rounded-lg p-3 mb-3 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Next Week Prediction</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{forecast.nextWeekPrediction}</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{forecast.confidence}% confidence</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{forecast.recommendation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Recommendations */}
      {insights.categoryRecommendations.length > 0 && (
        <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
              <Target className="w-4 h-4 text-orange-500" />
            </div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Expand to New Categories</h3>
          </div>

          <div className="space-y-3">
            {insights.categoryRecommendations.map((rec) => {
              const difficultyColors = {
                easy: isDark ? 'text-emerald-400 bg-emerald-500/10' : 'text-emerald-600 bg-emerald-50',
                medium: isDark ? 'text-yellow-400 bg-yellow-500/10' : 'text-yellow-600 bg-yellow-50',
                hard: isDark ? 'text-red-400 bg-red-500/10' : 'text-red-600 bg-red-50',
              };

              return (
                <div
                  key={rec.suggestedCategory}
                  className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{rec.suggestedCategory}</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${difficultyColors[rec.difficulty]}`}>
                        {rec.difficulty}
                      </span>
                      <span className="text-xs text-orange-500 font-medium">Priority: {rec.priority}/5</span>
                    </div>
                  </div>

                  <p className={`text-xs mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{rec.reason}</p>

                  <div className={`rounded-lg p-2 border ${isDark ? 'bg-orange-500/5 border-orange-500/10' : 'bg-orange-50 border-orange-100'}`}>
                    <p className="text-xs text-orange-500 font-medium">Potential reach: {rec.potentialReach}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Competitive Insights */}
      <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Competitive Position</h3>
        </div>

        <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-purple-500/5 border-purple-500/10' : 'bg-purple-50 border-purple-100'}`}>
          <p className="text-xs font-medium text-purple-500 mb-1">Your Position</p>
          <p className={`text-2xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{insights.competitiveInsights.yourPosition}</p>
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{insights.competitiveInsights.suggestion}</p>
        </div>

        <div>
          <p className={`text-xs font-medium mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Action Items</p>
          <div className="space-y-2">
            {insights.competitiveInsights.actionItems.map((action, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{action}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Segmentation Insights */}
      <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
            <Users className="w-4 h-4 text-cyan-500" />
          </div>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Customer Segments</h3>
          {loadingSegmentation && <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />}
        </div>

        {segmentation && segmentation.totalCustomers > 0 ? (
          <>
            {/* Customer Overview */}
            <div className={`rounded-xl p-4 mb-4 border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-xs font-medium text-cyan-500 mb-1">Total Active Customers</p>
              <p className={`text-3xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{segmentation.totalCustomers.toLocaleString()}</p>

              {/* Engagement Breakdown */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-lg p-2 border ${isDark ? 'bg-green-500/5 border-green-500/10' : 'bg-green-50 border-green-100'}`}>
                  <p className="text-xs font-medium text-green-500 mb-0.5">Active</p>
                  <p className="text-lg font-semibold text-green-500">{segmentation.engagementStatus.active}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{Math.round((segmentation.engagementStatus.active / segmentation.totalCustomers) * 100)}%</p>
                </div>
                <div className={`rounded-lg p-2 border ${isDark ? 'bg-yellow-500/5 border-yellow-500/10' : 'bg-yellow-50 border-yellow-100'}`}>
                  <p className="text-xs font-medium text-yellow-500 mb-0.5">Occasional</p>
                  <p className="text-lg font-semibold text-yellow-500">{segmentation.engagementStatus.occasional}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{Math.round((segmentation.engagementStatus.occasional / segmentation.totalCustomers) * 100)}%</p>
                </div>
                <div className={`rounded-lg p-2 border ${isDark ? 'bg-red-500/5 border-red-500/10' : 'bg-red-50 border-red-100'}`}>
                  <p className="text-xs font-medium text-red-500 mb-0.5">Dormant</p>
                  <p className="text-lg font-semibold text-red-500">{segmentation.engagementStatus.dormant}</p>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{Math.round((segmentation.engagementStatus.dormant / segmentation.totalCustomers) * 100)}%</p>
                </div>
              </div>
            </div>

            {/* Segment Cards */}
            <div className="space-y-3 mb-4">
              {segmentation.segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`rounded-xl p-4 border ${
                    segment.value === 'high'
                      ? isDark ? 'bg-slate-800/50 border-green-500/20' : 'bg-green-50/50 border-green-200'
                      : segment.value === 'medium'
                      ? isDark ? 'bg-slate-800/50 border-blue-500/20' : 'bg-blue-50/50 border-blue-200'
                      : isDark ? 'bg-slate-800/50 border-purple-500/20' : 'bg-purple-50/50 border-purple-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className={`text-sm font-semibold ${
                          segment.value === 'high' ? 'text-green-500' :
                          segment.value === 'medium' ? 'text-blue-500' :
                          'text-purple-500'
                        }`}>
                          {segment.name}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          segment.value === 'high'
                            ? isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-600'
                            : segment.value === 'medium'
                            ? isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-100 text-blue-600'
                            : isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'
                        }`}>
                          {segment.value}
                        </span>
                      </div>
                      <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{segment.description}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{segment.count}</p>
                      <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{segment.percentage}%</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Avg Redemptions</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{segment.avgRedemptions}/month</p>
                    </div>
                    <div>
                      <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Preferred Discount</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{segment.preferredDiscount}</p>
                    </div>
                    <div>
                      <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Top Category</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{segment.topCategory}</p>
                    </div>
                    <div>
                      <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Peak Time</p>
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{segment.peakTime}</p>
                    </div>
                  </div>

                  <div className={`pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{segment.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Insights */}
            {segmentation.topInsights.length > 0 && (
              <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-blue-500/5 border-blue-500/10' : 'bg-blue-50 border-blue-100'}`}>
                <p className="text-xs font-medium text-blue-500 mb-3">Key Insights</p>
                <div className="space-y-2">
                  {segmentation.topInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {segmentation.recommendations.length > 0 && (
              <div className={`rounded-xl p-4 border ${isDark ? 'bg-cyan-500/5 border-cyan-500/10' : 'bg-cyan-50 border-cyan-100'}`}>
                <p className="text-xs font-medium text-cyan-500 mb-3">Action Recommendations</p>
                <div className="space-y-2">
                  {segmentation.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : !loadingSegmentation ? (
          <div className="text-center py-8">
            <Users className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-cyan-500/30' : 'text-cyan-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{segmentation?.topInsights[0] || 'No customer data yet'}</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {segmentation?.recommendations[0] || 'Create campaigns to start gathering customer insights'}
            </p>
          </div>
        ) : null}
      </div>

      {/* Revenue Forecast & Predictions */}
      <div className={`rounded-xl p-4 border mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Revenue Forecast</h3>
          {loadingForecast && <Loader2 className="w-4 h-4 text-green-500 animate-spin ml-2" />}
        </div>

        {!loadingForecast && forecast && forecast.historicalData.length > 0 ? (
          <>
            {/* Current Performance */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>This Month</p>
                <p className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{forecast.currentMonthRevenue.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  {forecast.growthRate >= 0 ? (
                    <>
                      <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                      <p className="text-xs text-emerald-500 font-medium">+{forecast.growthRate}% vs last month</p>
                    </>
                  ) : (
                    <>
                      <ArrowDownRight className="w-3 h-3 text-red-500" />
                      <p className="text-xs text-red-500 font-medium">{forecast.growthRate}% vs last month</p>
                    </>
                  )}
                </div>
              </div>

              <div className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Trend</p>
                <div className="flex items-center gap-2 mb-1">
                  {forecast.trends.direction === 'up' && <TrendingUp className="w-5 h-5 text-emerald-500" />}
                  {forecast.trends.direction === 'down' && <TrendingDownIcon className="w-5 h-5 text-red-500" />}
                  {forecast.trends.direction === 'stable' && <Minus className="w-5 h-5 text-amber-500" />}
                  <span className={`text-sm font-semibold ${
                    forecast.trends.direction === 'up' ? 'text-emerald-500' :
                    forecast.trends.direction === 'down' ? 'text-red-500' : 'text-amber-500'
                  }`}>
                    {forecast.trends.direction === 'up' ? 'Growing' :
                     forecast.trends.direction === 'down' ? 'Declining' : 'Stable'}
                  </span>
                </div>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{forecast.trends.message}</p>
              </div>
            </div>

            {/* Forecasts */}
            <div className="mb-4">
              <p className={`text-xs font-medium mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Future Predictions</p>
              <div className="space-y-2">
                {[
                  { data: forecast.forecasts.next30Days, label: 'Next 30 Days' },
                  { data: forecast.forecasts.next60Days, label: 'Next 60 Days' },
                  { data: forecast.forecasts.next90Days, label: 'Next 90 Days' },
                ].map(({ data, label }) => (
                  <div key={label} className={`p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{label}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        {data.confidence} confidence
                      </span>
                    </div>
                    <p className={`text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{data.predictedRevenue.toLocaleString()}</p>
                    <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <span>Range: ₹{data.minRevenue.toLocaleString()} - ₹{data.maxRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What-If Scenarios */}
            {forecast.whatIfScenarios.length > 0 && (
              <div className="mb-4">
                <p className={`text-xs font-medium mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>What-If Scenarios</p>
                <div className="space-y-2">
                  {forecast.whatIfScenarios.slice(0, 3).map((scenario, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        scenario.impact === 'positive'
                          ? isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'
                          : scenario.impact === 'negative'
                          ? isDark ? 'border-red-500/20 bg-red-500/5' : 'border-red-200 bg-red-50'
                          : isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {scenario.impact === 'positive' && <Zap className="w-3 h-3 text-emerald-500" />}
                            {scenario.impact === 'negative' && <AlertCircle className="w-3 h-3 text-red-500" />}
                            <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{scenario.scenario}</p>
                          </div>
                          <p className={`text-xs mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{scenario.description}</p>
                          <p className={`text-xs font-medium ${
                            scenario.impact === 'positive' ? 'text-emerald-500' : 'text-red-500'
                          }`}>
                            Expected: {scenario.expectedChange}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{scenario.predictedRevenue.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historical Data */}
            {forecast.historicalData.length > 0 && (
              <div className="mb-4">
                <p className={`text-xs font-medium mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Historical Revenue</p>
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="space-y-2">
                    {forecast.historicalData.slice(-6).map((month, idx) => {
                      const maxRevenue = Math.max(...forecast.historicalData.map(m => m.revenue));
                      const barWidth = (month.revenue / maxRevenue) * 100;
                      return (
                        <div key={month.month}>
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{month.month}</p>
                            <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{month.revenue.toLocaleString()}</p>
                          </div>
                          <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{month.redemptions} redemptions</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Seasonal Insights */}
            {forecast.seasonalInsights.length > 0 && (
              <div className={`mb-4 rounded-xl p-4 border ${isDark ? 'bg-purple-500/5 border-purple-500/10' : 'bg-purple-50 border-purple-100'}`}>
                <p className="text-xs font-medium text-purple-500 mb-3">Seasonal Insights</p>
                <div className="space-y-2">
                  {forecast.seasonalInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Insights */}
            {forecast.topInsights.length > 0 && (
              <div className={`rounded-xl p-4 border ${isDark ? 'bg-cyan-500/5 border-cyan-500/10' : 'bg-cyan-50 border-cyan-100'}`}>
                <p className="text-xs font-medium text-cyan-500 mb-3">Key Insights</p>
                <div className="space-y-2">
                  {forecast.topInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : !loadingForecast ? (
          <div className="text-center py-8">
            <TrendingUp className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-green-500/30' : 'text-green-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No revenue data yet</p>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Create campaigns and track redemptions to enable revenue forecasting
            </p>
          </div>
        ) : null}
      </div>

      {/* AI Assistant Chat */}
    </div>
  );
};
