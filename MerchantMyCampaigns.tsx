
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Deal, AppView } from './types';
import { addCampaignService } from './services/addCampaignService';
import { mDashboardService } from './services/mDashboardService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { useTranslation } from './contexts/LanguageContext';
import {
  Megaphone,
  Edit2,
  History,
  Clock,
  AlertCircle,
  Zap,
  Calculator,
  MousePointer2,
  TicketCheck,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Timer,
} from 'lucide-react';

const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

const getTimeRemaining = (createdAt: string | undefined): number => {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  const deadline = created + EDIT_WINDOW_MS;
  return Math.max(0, deadline - Date.now());
};

const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const EditCountdown: React.FC<{ createdAt: string | undefined; isDark: boolean }> = ({ createdAt, isDark }) => {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(createdAt));

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      const r = getTimeRemaining(createdAt);
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  if (remaining <= 0) return null;

  const isUrgent = remaining < 15 * 60 * 1000; // Less than 15 min

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium ${
      isUrgent
        ? isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
        : isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
    }`}>
      <Timer className="w-3 h-3" />
      Edit: {formatCountdown(remaining)}
    </div>
  );
};

interface MerchantMyCampaignsProps {
  user: any;
  deals: Deal[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  refreshDeals: () => Promise<void>;
  setView: (view: AppView) => void;
  preSelectedEditDealId?: string | null;
  onClearPreSelected?: () => void;
  preSelectedTab?: CampaignTab | null;
  theme?: 'light' | 'dark';
  setDealIdToEdit?: (id: string | null) => void;
}

type CampaignTab = 'active' | 'expired';

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

export const MerchantMyCampaigns: React.FC<MerchantMyCampaignsProps> = ({
  user, deals = [], loading, setLoading, refreshDeals, setView,
  preSelectedEditDealId, onClearPreSelected, preSelectedTab, theme = 'dark',
  setDealIdToEdit,
}) => {
  const { t, getLocalizedText } = useTranslation();
  const isDark = theme === 'dark';
  const tabsRef = useRef<HTMLDivElement>(null);
  const campaignListRef = useRef<HTMLDivElement>(null);

  const [activeListTab, setActiveListTab] = useState<CampaignTab>(preSelectedTab || 'active');
  const [imageLibrary, setImageLibrary] = useState<{url: string, name?: string}[]>([]);

  const [roiInputs, setRoiInputs] = useState<Record<string, {
    expectedRedemptions: number;
    averageTransactionValue: number;
    profitMarginPercentage: number;
  }>>({});
  const [showRoiCalculator, setShowRoiCalculator] = useState<Record<string, boolean>>({});

  const [perCampaignClickCounts, setPerCampaignClickCounts] = useState<Record<string, number>>({});
  const [perCampaignRedemptionCounts, setPerCampaignRedemptionCounts] = useState<Record<string, number>>({});

  const [campaignUsage, setCampaignUsage] = useState({
    campaigns_used: 0,
    campaigns_limit: 0,
    dotd_used: 0,
    dotd_limit: 0,
    has_subscription: false,
  });

  const getStatusDisplay = (status: string) => {
    switch (status.toLowerCase()) {
      case 'review': return <span className="flex items-center gap-1 text-amber-500 text-xs font-medium"><AlertCircle className="w-3 h-3" /> In Review</span>;
      case 'active': return <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Active</span>;
      case 'expired': return <span className="flex items-center gap-1 text-rose-500 text-xs font-medium"><History className="w-3 h-3" /> Expired</span>;
      case 'needs review': return <span className="flex items-center gap-1 text-orange-500 text-xs font-medium"><AlertCircle className="w-3 h-3" /> Needs Review</span>;
      default: return <span className="text-slate-500 text-xs">{status}</span>;
    }
  };

  const getCampaignImage = (deal: Deal) => {
    const libImage = imageLibrary.find(img => img.name === deal.image_name);
    return libImage?.url || deal.thumbnail || DEFAULT_DEAL_IMAGE;
  };

  useEffect(() => {
    if (preSelectedTab && tabsRef.current) {
      setTimeout(() => {
        tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [preSelectedTab]);

  // Auto-refresh deals
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      refreshDeals();
    }, 10000);
    return () => clearInterval(refreshInterval);
  }, [refreshDeals]);

  // Load image library for deal card thumbnails
  useEffect(() => {
    if (user.id) {
      addCampaignService.getMerchantImages(user.id).then(images => {
        const uniqueImages = Array.from(new Set(images.map(i => i.url)))
          .map(url => images.find(i => i.url === url)!);
        setImageLibrary(uniqueImages);
      }).catch(err => console.error("Error fetching image library:", err));
    }
  }, [user.id]);

  // Fetch campaign usage
  useEffect(() => {
    const fetchCampaignUsage = async () => {
      try {
        const usage = await merchantSubscriptionService.getCampaignUsage(user.id);
        setCampaignUsage(usage);
      } catch (err) {
        console.error("Error fetching campaign usage:", err);
      }
    };
    if (user.id) fetchCampaignUsage();
  }, [user.id, deals]);

  // Handle pre-selected edit deal (from dashboard deep link)
  useEffect(() => {
    if (preSelectedEditDealId && deals.length > 0) {
      const dealToEdit = deals.find(d => d.campaign_id === preSelectedEditDealId);
      if (dealToEdit) {
        if (setDealIdToEdit) setDealIdToEdit(preSelectedEditDealId);
        if (onClearPreSelected) onClearPreSelected();
        setView('campaign_wizard');
      }
    }
  }, [preSelectedEditDealId, deals, onClearPreSelected, setView, setDealIdToEdit]);

  const merchantDeals = useMemo(() => {
    if (!deals || !user.id) return [];
    return deals.filter(d => {
      const dMerchantId = String(d.merchantId || (d as any).merchant_id).toLowerCase();
      return dMerchantId === String(user.id).toLowerCase();
    }).sort((a, b) => (b.campaign_id || '').localeCompare(a.campaign_id || ''));
  }, [deals, user.id]);

  const filteredDeals = useMemo(() => {
    return merchantDeals.filter(d => {
      const status = (d.status || 'active').toLowerCase();
      return status === activeListTab;
    });
  }, [merchantDeals, activeListTab]);

  // Fetch per-campaign click and redemption stats
  useEffect(() => {
    const fetchCampaignStats = async () => {
      if (user?.id && filteredDeals.length > 0) {
        const campaignIds = filteredDeals.map(deal => deal.campaign_id);
        try {
          const [clicks, redemptions] = await Promise.all([
            mDashboardService.getCampaignSpecificClicks(campaignIds),
            mDashboardService.getCampaignSpecificRedemptions(user.id, campaignIds)
          ]);
          setPerCampaignClickCounts(clicks);
          setPerCampaignRedemptionCounts(redemptions);
        } catch (error: any) {
          console.error("[MerchantMyCampaigns] Stats sync error:", error);
        }
      }
    };
    fetchCampaignStats();
  }, [user?.id, filteredDeals, deals]);

  const handleEditClick = (deal: Deal) => {
    if (setDealIdToEdit) setDealIdToEdit(deal.campaign_id);
    setView('campaign_wizard');
  };

  const handleNewDeal = () => {
    if (setDealIdToEdit) setDealIdToEdit(null);
    setView('campaign_wizard');
  };

  const handleModifyExisting = () => {
    campaignListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const updateRoiInput = (campaignId: string, field: string, value: number) => {
    setRoiInputs(prev => ({
      ...prev,
      [campaignId]: {
        ...(prev[campaignId] || { expectedRedemptions: 0, averageTransactionValue: 0, profitMarginPercentage: 0 }),
        [field]: value
      }
    }));
  };

  const calculateROI = (campaignId: string) => {
    const inputs = roiInputs[campaignId];
    if (!inputs) return { projectedRevenue: 0, projectedProfit: 0 };
    const projectedRevenue = inputs.expectedRedemptions * inputs.averageTransactionValue;
    const projectedProfit = projectedRevenue * (inputs.profitMarginPercentage / 100);
    return { projectedRevenue, projectedProfit };
  };

  return (
    <div className={`px-6 pt-6 pb-32 space-y-6 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>My Campaigns</h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Create and manage your deals</p>
        </div>
        <button
          onClick={() => setView('merchant_dashboard')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Campaign Usage */}
      {campaignUsage.has_subscription && (
        <div id="ctour-usage" className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Megaphone className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaigns</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span className={campaignUsage.campaigns_used >= campaignUsage.campaigns_limit ? 'text-rose-500' : 'text-emerald-500'}>
                    {campaignUsage.campaigns_used}
                  </span>
                  <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/{campaignUsage.campaigns_limit}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deal of the Day</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span className={campaignUsage.dotd_used >= campaignUsage.dotd_limit ? 'text-rose-500' : 'text-emerald-500'}>
                    {campaignUsage.dotd_used}
                  </span>
                  <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/{campaignUsage.dotd_limit}</span>
                </p>
              </div>
            </div>
          </div>

          {(campaignUsage.campaigns_used >= campaignUsage.campaigns_limit || campaignUsage.dotd_used >= campaignUsage.dotd_limit) && (
            <div className="mt-3 space-y-2">
              {campaignUsage.campaigns_used >= campaignUsage.campaigns_limit && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200'}`}>
                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <p className={`text-xs ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                    Campaign limit reached ({campaignUsage.campaigns_used}/{campaignUsage.campaigns_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.
                  </p>
                </div>
              )}
              {campaignUsage.dotd_used >= campaignUsage.dotd_limit && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                    Deal of the Day limit reached ({campaignUsage.dotd_used}/{campaignUsage.dotd_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Landing Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          id="ctour-new-deal"
          onClick={handleNewDeal}
          className="relative overflow-hidden rounded-2xl p-4 bg-blue-600 border-2 border-blue-500 transition-all active:translate-y-0.5 active:shadow-none shadow-lg shadow-blue-600/30"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20">
              <ArrowLeft className="w-3.5 h-3.5 text-white rotate-180" />
            </div>
          </div>
          <h3 className="text-sm font-bold mb-0.5 text-left text-white">New Deal</h3>
          <p className="text-[10px] leading-tight text-left text-blue-100">
            Create step by step
          </p>
        </button>

        <button
          id="ctour-modify-deal"
          onClick={handleModifyExisting}
          className={`relative overflow-hidden rounded-2xl p-4 border-2 transition-all active:translate-y-0.5 active:shadow-none shadow-lg ${
            isDark
              ? 'bg-slate-800 border-slate-600 shadow-black/30'
              : 'bg-slate-900 border-slate-700 shadow-slate-900/30'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500/20">
              <Edit2 className="w-5 h-5 text-amber-400" />
            </div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/10">
              <ArrowLeft className="w-3.5 h-3.5 text-white/70 rotate-180" />
            </div>
          </div>
          <h3 className="text-sm font-bold mb-0.5 text-left text-white">Modify Deal</h3>
          <p className="text-[10px] leading-tight text-left text-slate-400">
            Edit existing campaign
          </p>
        </button>
      </div>

      {/* Campaigns List */}
      <div ref={campaignListRef} className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Auto-refresh active</span>
          </div>
        </div>

        {/* Tabs */}
        <div id="ctour-tabs" ref={tabsRef} className={`p-1 rounded-lg border flex gap-1 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {[
            { key: 'active' as CampaignTab, label: 'Live' },
            { key: 'expired' as CampaignTab, label: 'Expired' },
          ].map(tab => {
            const count = merchantDeals.filter(d => (d.status || 'active').toLowerCase() === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveListTab(tab.key)}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                  activeListTab === tab.key
                    ? 'bg-slate-900 text-white'
                    : isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Campaign Cards */}
        {filteredDeals.length === 0 ? (
          <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <Megaphone className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No campaigns in this category</p>
            <button
              onClick={handleNewDeal}
              className="text-xs font-medium text-blue-500 mt-2"
            >
              Create New Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDeals.map(deal => {
              const roiData = calculateROI(deal.campaign_id);
              const clicks = perCampaignClickCounts[deal.campaign_id] || 0;
              const redemptions = perCampaignRedemptionCounts[deal.campaign_id] || 0;

              return (
                <div key={deal.campaign_id}>
                  <div className={`flex gap-3 p-3 rounded-xl border ${
                    deal.is_deal_of_the_day
                      ? isDark ? 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20' : 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
                      : isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}>
                    {/* Image */}
                    <div className={`relative w-28 h-28 shrink-0 rounded-lg overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <img src={getCampaignImage(deal)} alt={deal.shopName} className="w-full h-full object-cover" />
                      {deal.is_deal_of_the_day ? (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-amber-500 text-white px-1.5 py-0.5 rounded text-[9px] font-bold">
                          <Zap className="w-2.5 h-2.5" /> DOTD
                        </div>
                      ) : (
                        <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${isDark ? 'bg-slate-900/80 text-white' : 'bg-white/80 text-slate-700'}`}>
                          {deal.category}
                        </div>
                      )}
                      <div className="absolute bottom-1.5 left-1.5">
                        {getStatusDisplay(deal.status || 'active')}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[10px] font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{deal.shopName}</p>
                          {deal.is_deal_of_the_day && (
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'
                            }`}>
                              Deal of the Day
                            </span>
                          )}
                        </div>
                        <h3 className={`text-sm font-medium leading-tight line-clamp-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details)}
                        </h3>
                        <p className="text-amber-500 text-xs font-medium mt-0.5">
                          {getLocalizedText(deal.localized_offer, deal.offerValue)}
                        </p>
                      </div>

                      {/* Date + Stats */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                          <Clock className="w-3 h-3" />
                          {deal.start_date && deal.end_date ? (
                            (() => {
                              const formatDateUTC = (dateStr: string) => {
                                const date = new Date(dateStr + 'T00:00:00Z');
                                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
                              };
                              return `${formatDateUTC(deal.start_date!)} - ${formatDateUTC(deal.end_date!)}`;
                            })()
                          ) : 'No dates'}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                          <MousePointer2 className="w-3 h-3" /> {clicks}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                          <TicketCheck className="w-3 h-3" /> {redemptions}
                        </div>
                      </div>

                      {/* Edit Countdown Timer */}
                      {deal.created_at && getTimeRemaining(deal.created_at) > 0 && (
                        <div className="mt-1.5">
                          <EditCountdown createdAt={deal.created_at} isDark={isDark} />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2">
                        {getTimeRemaining(deal.created_at) > 0 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditClick(deal); }}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all ${
                              isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        ) : (
                          <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium opacity-40 ${
                            isDark ? 'bg-slate-800 text-slate-500 border border-slate-700' : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            <Edit2 className="w-3 h-3" /> Edit window closed
                          </div>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowRoiCalculator(prev => ({...prev, [deal.campaign_id]: !prev[deal.campaign_id]})); }}
                          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all ${
                            isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Calculator className="w-3 h-3" /> {showRoiCalculator[deal.campaign_id] ? 'Hide ROI' : 'ROI'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ROI Calculator */}
                  {showRoiCalculator[deal.campaign_id] && (
                    <div className={`mt-2 p-4 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="w-4 h-4 text-blue-500" />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>ROI Calculator</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Expected Claims</label>
                          <input
                            type="number"
                            placeholder="100"
                            className={`w-full h-9 px-2 rounded-lg text-sm outline-none border ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            value={roiInputs[deal.campaign_id]?.expectedRedemptions || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'expectedRedemptions', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Avg Spend (Rs)</label>
                          <input
                            type="number"
                            placeholder="500"
                            className={`w-full h-9 px-2 rounded-lg text-sm outline-none border ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            value={roiInputs[deal.campaign_id]?.averageTransactionValue || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'averageTransactionValue', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Margin %</label>
                          <input
                            type="number"
                            placeholder="20"
                            className={`w-full h-9 px-2 rounded-lg text-sm outline-none border ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            value={roiInputs[deal.campaign_id]?.profitMarginPercentage || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'profitMarginPercentage', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      {roiData && roiData.projectedRevenue > 0 && (
                        <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                          <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                            <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Projected Revenue</p>
                            <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Rs.{Math.round(roiData.projectedRevenue).toLocaleString('en-IN')}</p>
                          </div>
                          <div className={`p-3 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                            <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Projected Profit</p>
                            <p className="text-lg font-semibold text-emerald-500">Rs.{Math.round(roiData.projectedProfit).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
