
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Deal, AppView } from './types';
import { addCampaignService } from './services/addCampaignService';
import { mDashboardService } from './services/mDashboardService';
import { merchantService } from './services/merchantService';
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
  X,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Film,
  MapPin,
  Calendar,
  Store,
  Gift,
  Truck,
  Printer,
} from 'lucide-react';
import { MediaLightbox } from './components/MediaLightbox';
import { POSTER_TEMPLATES, openDealPoster, buildPosterHtml, type PosterTemplate } from './utils/printDealPoster';
import { renderPosterMiniMock } from './components/PosterMiniMock';
import { DealsLoader } from './components/DealsLoader';
import { pickBadgeCornerForImage, BadgeCorner } from './utils/badgeCornerForImage';

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
  // 'dotd_only' filters to is_deal_of_the_day deals and retargets the
  // create button + limit check at DOTD instead of regular campaigns.
  mode?: 'all' | 'dotd_only';
}

type CampaignTab = 'active' | 'expired';

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

export const MerchantMyCampaigns: React.FC<MerchantMyCampaignsProps> = ({
  user, deals = [], loading, setLoading, refreshDeals, setView,
  preSelectedEditDealId, onClearPreSelected, preSelectedTab, theme = 'dark',
  setDealIdToEdit, mode = 'all',
}) => {
  const isDotdMode = mode === 'dotd_only';
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
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [merchantStores, setMerchantStores] = useState<any[]>([]);
  // Poster picker for in-store print (4 templates). Opened from the deal-detail
  // top-right Printer button. Null when closed.
  const [posterPickerForDeal, setPosterPickerForDeal] = useState<Deal | null>(null);
  // Proof-read preview shown after the merchant picks a template, before the
  // actual print window opens. They can confirm or go back to pick another.
  const [posterPreview, setPosterPreview] = useState<{ deal: Deal; template: PosterTemplate } | null>(null);

  // DOTD badge corner — picked dynamically from the selected deal's cover image.
  const [dotdBadgeCorner, setDotdBadgeCorner] = useState<BadgeCorner>('tl');
  useEffect(() => {
    const url = selectedDeal ? ((selectedDeal as any).image_url || selectedDeal.thumbnail || '') : '';
    if (!url) { setDotdBadgeCorner('tl'); return; }
    let cancelled = false;
    pickBadgeCornerForImage(url).then(c => { if (!cancelled) setDotdBadgeCorner(c); });
    return () => { cancelled = true; };
  }, [selectedDeal]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<Array<{ kind: 'image' | 'video'; url: string }>>([]);
  const [detailCarouselIndex, setDetailCarouselIndex] = useState(0);

  const [perCampaignClickCounts, setPerCampaignClickCounts] = useState<Record<string, number>>({});
  const [perCampaignClaimClicks, setPerCampaignClaimClicks] = useState<Record<string, number>>({});
  const [perCampaignRedemptionCounts, setPerCampaignRedemptionCounts] = useState<Record<string, number>>({});

  const [campaignUsage, setCampaignUsage] = useState({
    campaigns_used: 0,
    campaigns_limit: 0,
    dotd_used: 0,
    dotd_limit: 0,
    has_subscription: false,
  });

  // Auto-Renew state
  const [renewDeal, setRenewDeal] = useState<Deal | null>(null);
  const [renewStartDate, setRenewStartDate] = useState('');
  const [renewEndDate, setRenewEndDate] = useState('');
  const [renewing, setRenewing] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState(false);

  const handleRenewClick = (deal: Deal) => {
    // Default start = today, end = 7 days from now
    const today = new Date();
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    setRenewStartDate(today.toISOString().split('T')[0]);
    setRenewEndDate(weekLater.toISOString().split('T')[0]);
    setRenewDeal(deal);
    setRenewSuccess(false);
  };

  const handleRenewConfirm = async () => {
    if (!renewDeal || !renewStartDate || !renewEndDate) return;
    setRenewing(true);
    try {
      await addCampaignService.updateCampaign(renewDeal.campaign_id, {
        start_date: renewStartDate,
        end_date: renewEndDate,
        status: 'active',
      });
      setRenewSuccess(true);
      await refreshDeals();
      setTimeout(() => {
        setRenewDeal(null);
        setRenewSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('[MerchantMyCampaigns] Renew failed:', err);
    } finally {
      setRenewing(false);
    }
  };

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

  // Load merchant stores once — used to enrich the selected deal with delivery + phone info at render time
  useEffect(() => {
    if (!user?.id) return;
    merchantService.getMerchantStores(user.id)
      .then(stores => setMerchantStores(stores || []))
      .catch(() => setMerchantStores([]));
  }, [user?.id]);

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

  // Fetch campaign usage. One retry on transient failure (auth refresh blip,
  // 5xx) so the New Deal button doesn't stay greyed forever just because the
  // first request failed.
  useEffect(() => {
    let cancelled = false;
    const fetchCampaignUsage = async () => {
      const tryOnce = () => merchantSubscriptionService.getCampaignUsage(user.id);
      try {
        let usage;
        try {
          usage = await tryOnce();
        } catch (firstErr) {
          if (cancelled) return;
          console.warn('[MerchantMyCampaigns] usage fetch failed, retrying:', firstErr);
          await new Promise((r) => setTimeout(r, 800));
          usage = await tryOnce();
        }
        if (!cancelled) setCampaignUsage(usage);
      } catch (err) {
        console.error('Error fetching campaign usage:', err);
      }
    };
    if (user.id) fetchCampaignUsage();
    return () => { cancelled = true; };
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
      if (dMerchantId !== String(user.id).toLowerCase()) return false;
      if (isDotdMode && !d.is_deal_of_the_day) return false;
      return true;
    }).sort((a, b) => (b.campaign_id || '').localeCompare(a.campaign_id || ''));
  }, [deals, user.id, isDotdMode]);

  const filteredDeals = useMemo(() => {
    return merchantDeals.filter(d => {
      const status = (d.status || 'active').toLowerCase();
      return status === activeListTab;
    });
  }, [merchantDeals, activeListTab]);

  // Fetch per-campaign click and redemption stats for ALL campaigns (not just
  // the active tab) so counts persist when switching between active/expired.
  useEffect(() => {
    const fetchCampaignStats = async () => {
      if (user?.id && merchantDeals.length > 0) {
        const campaignIds = merchantDeals.map(deal => deal.campaign_id);
        try {
          const [clicksData, redemptions] = await Promise.all([
            mDashboardService.getCampaignSpecificClicks(campaignIds),
            mDashboardService.getCampaignSpecificRedemptions(user.id, campaignIds)
          ]);
          setPerCampaignClickCounts(clicksData.views);
          setPerCampaignClaimClicks(clicksData.claimClicks);
          setPerCampaignRedemptionCounts(redemptions);
        } catch (error: any) {
          console.error("[MerchantMyCampaigns] Stats sync error:", error);
        }
      }
    };
    fetchCampaignStats();
  }, [user?.id, merchantDeals]);

  const handleEditClick = (deal: Deal) => {
    if (setDealIdToEdit) setDealIdToEdit(deal.campaign_id);
    setView('campaign_wizard');
  };

  const handleNewDeal = () => {
    if (setDealIdToEdit) setDealIdToEdit(null);
    setView(isDotdMode ? 'dotd_wizard' : 'campaign_wizard');
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
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isDotdMode ? t('m_dotd_title') : t('m_my_campaigns')}
          </h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {isDotdMode ? t('m_dotd_feature') : t('m_create_manage_deals')}
          </p>
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
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_campaigns')}</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span className={campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit ? 'text-rose-500' : 'text-emerald-500'}>
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
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_deal_of_day')}</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span className={campaignUsage.dotd_limit > 0 && campaignUsage.dotd_used >= campaignUsage.dotd_limit ? 'text-rose-500' : 'text-emerald-500'}>
                    {campaignUsage.dotd_used}
                  </span>
                  <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/{campaignUsage.dotd_limit}</span>
                </p>
              </div>
            </div>
          </div>

          {campaignUsage.has_subscription && (
            (campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit) ||
            (campaignUsage.dotd_limit > 0 && campaignUsage.dotd_limit > 0 && campaignUsage.dotd_used >= campaignUsage.dotd_limit)
          ) && (() => {
            // Limits reset on the 1st of next month at 12 AM IST. Compute the
            // friendly label using the device's local time — Indian merchants
            // are already on IST, so this lines up with the server-side window.
            const next = new Date();
            next.setMonth(next.getMonth() + 1);
            next.setDate(1);
            const nextResetLabel = next.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
            const waitMsg = t('m_or_wait_until_reset').replace('{date}', nextResetLabel);
            return (
              <div className="mt-3 space-y-2">
                {campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit && (
                  <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200'}`}>
                    <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                    <p className={`text-xs ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                      {t('m_campaign_limit_reached')} ({campaignUsage.campaigns_used}/{campaignUsage.campaigns_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan, {waitMsg}.
                    </p>
                  </div>
                )}
                {campaignUsage.dotd_limit > 0 && campaignUsage.dotd_used >= campaignUsage.dotd_limit && (
                  <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                      {t('m_dotd_limit_reached')} ({campaignUsage.dotd_used}/{campaignUsage.dotd_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan, {waitMsg}.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* New Deal Button — full width. Disabled when the relevant limit is reached.
          Only treat the button as at-limit when we *know* there's a real
          subscription with a positive limit — otherwise the default 0/0 state
          (or a failed usage fetch) would silently grey the button. */}
      {(() => {
        const atLimit = !!campaignUsage && campaignUsage.has_subscription && (
          isDotdMode
            ? campaignUsage.dotd_limit > 0 && campaignUsage.dotd_limit > 0 && campaignUsage.dotd_used >= campaignUsage.dotd_limit
            : campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_limit > 0 && campaignUsage.campaigns_used >= campaignUsage.campaigns_limit
        );
        const enabledClasses = isDotdMode
          ? 'bg-amber-500 border-amber-400 active:translate-y-0.5 active:shadow-none shadow-lg shadow-amber-500/30'
          : 'bg-blue-600 border-blue-500 active:translate-y-0.5 active:shadow-none shadow-lg shadow-blue-600/30';
        const subTextClasses = isDotdMode ? 'text-amber-50' : 'text-blue-100';
        return (
          <button
            id="ctour-new-deal"
            onClick={handleNewDeal}
            disabled={atLimit}
            className={`w-full relative overflow-hidden rounded-2xl p-4 border-2 transition-all flex items-center gap-4 ${
              atLimit
                ? 'bg-slate-300 border-slate-300 cursor-not-allowed opacity-60 shadow-none'
                : enabledClasses
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${atLimit ? 'bg-slate-400/40' : 'bg-white/20'}`}>
              {isDotdMode ? <Zap className="w-6 h-6 text-white" /> : <Sparkles className="w-6 h-6 text-white" />}
            </div>
            <div className="text-left flex-1">
              <h3 className="text-base font-bold text-white">
                {isDotdMode ? 'Create Deal of Day' : t('m_new_deal')}
              </h3>
              <p className={`text-xs ${atLimit ? 'text-slate-100' : subTextClasses}`}>
                {isDotdMode ? t('m_dotd_create_sub') : t('m_launch_campaign')}
              </p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${atLimit ? 'bg-slate-400/40' : 'bg-white/20'}`}>
              <ArrowLeft className="w-4 h-4 text-white rotate-180" />
            </div>
          </button>
        );
      })()}

      {/* Campaigns List */}
      <div ref={campaignListRef} className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_auto_refresh')}</span>
          </div>
        </div>

        {/* Tabs */}
        <div id="ctour-tabs" ref={tabsRef} className={`p-1 rounded-lg border flex gap-1 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {[
            { key: 'active' as CampaignTab, label: t('m_live') },
            { key: 'expired' as CampaignTab, label: t('m_expired') },
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
        {loading && filteredDeals.length === 0 ? (
          <DealsLoader theme={theme} />
        ) : filteredDeals.length === 0 ? (
          <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <Megaphone className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_no_campaigns_category')}</p>
            <button
              onClick={handleNewDeal}
              className="text-xs font-medium text-blue-500 mt-2"
            >
              {t('m_create_new_campaign')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDeals.map(deal => {
              const roiData = calculateROI(deal.campaign_id);
              const clicks = perCampaignClickCounts[deal.campaign_id] || 0;
              const claims = perCampaignClaimClicks[deal.campaign_id] || 0;
              const redemptions = perCampaignRedemptionCounts[deal.campaign_id] || 0;

              return (
                <div key={deal.campaign_id}>
                  <div
                    onClick={() => { setSelectedDeal(deal); setDetailCarouselIndex(0); }}
                    className={`flex gap-3 p-3 rounded-xl border cursor-pointer active:scale-[0.99] transition-all ${
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
                              {t('m_dotd_label')}
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
                          ) : t('m_no_dates')}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`} title="Views">
                          <MousePointer2 className="w-3 h-3" /> {clicks}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`} title="Claim clicks">
                          <Megaphone className="w-3 h-3" /> {claims}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`} title="Redeemed">
                          <TicketCheck className="w-3 h-3" /> {redemptions}
                        </div>
                      </div>

                      {/* Edit Countdown Timer */}
                      {deal.created_at && getTimeRemaining(deal.created_at) > 0 && (
                        <div className="mt-1.5">
                          <EditCountdown createdAt={deal.created_at} isDark={isDark} />
                        </div>
                      )}

                      {/* Actions — wrap to the next row instead of overflowing the
                          card edge when Edit + Renew + ROI don't all fit on one line. */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Edit button only while the edit window is open. Once it
                            closes we render nothing (no placeholder box) so Renew +
                            ROI keep their space instead of overflowing the card. */}
                        {getTimeRemaining(deal.created_at) > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditClick(deal); }}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all ${
                              isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Edit2 className="w-3 h-3" /> {t('m_edit')}
                          </button>
                        )}
                        {(deal.status || '').toLowerCase() === 'expired' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRenewClick(deal); }}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all ${
                              isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            }`}
                          >
                            <RefreshCw className="w-3 h-3" /> {t('m_renew')}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowRoiCalculator(prev => ({...prev, [deal.campaign_id]: !prev[deal.campaign_id]})); }}
                          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all ${
                            isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          <Calculator className="w-3 h-3" /> {showRoiCalculator[deal.campaign_id] ? t('m_hide_roi') : t('m_roi')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ROI Calculator */}
                  {showRoiCalculator[deal.campaign_id] && (
                    <div className={`mt-2 p-4 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="w-4 h-4 text-blue-500" />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_roi_calculator')}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_expected_claims')}</label>
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
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_avg_spend')}</label>
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
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_margin_pct')}</label>
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
                            <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_projected_revenue')}</p>
                            <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Rs.{Math.round(roiData.projectedRevenue).toLocaleString('en-IN')}</p>
                          </div>
                          <div className={`p-3 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                            <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('m_projected_profit')}</p>
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
        const mainImg = (deal as any).image_url || deal.thumbnail;
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

            {/* Image / Video — square aspect like consumer */}
            {totalMedia > 0 && (
              <div className={`relative aspect-square overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full h-full" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                  {allMedia.map((item, i) => {
                    const overlay = priceOverlays[String(i)];
                    const hasOverlay = overlay && (overlay.discountPct || overlay.offerPrice);
                    const mrp = overlay?.offerPrice ? Math.round(parseFloat(overlay.offerPrice) * 1.3) : null;
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
                            {overlay.discountPct && (
                              <div className="inline-block bg-red-500 text-white text-xs font-black px-2 py-1 rounded mb-1.5">{overlay.discountPct}% OFF</div>
                            )}
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
                {/* DOTD badge — corner picked dynamically based on the cover image */}
                {deal.is_deal_of_the_day && (
                  <div className={`absolute flex items-center gap-1 bg-amber-500 text-white px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                    {
                      tl: 'top-14 left-3',
                      tr: 'top-14 right-3',
                      bl: 'bottom-12 left-3',
                      br: 'bottom-12 right-3',
                    }[dotdBadgeCorner]
                  }`}>
                    <Zap className="w-3 h-3" /> {t('m_dotd_label')}
                  </div>
                )}
                {/* Dot indicators on image */}
                {totalMedia > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {allMedia.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all ${i === detailCarouselIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content — matches consumer CampaignDetails exactly */}
            <div className="px-4 py-6">
              {/* Store name */}
              <p className={`text-xs font-normal mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {deal.shopName}
              </p>

              {/* Heading */}
              <h1 className={`text-xl font-semibold mb-3 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details)}
              </h1>

              {/* Category tag */}
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
                    <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Delivered by the merchant or their partner; DealPro is not liable.
                    </p>
                  </div>
                </div>
              )}

              {/* Rating — placeholder stars (merchant doesn't have live rating here) */}
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map(star => (
                    <svg key={star} className={`w-4 h-4 ${star <= Math.floor((deal as any).averageRating || 0) ? 'text-yellow-500' : isDark ? 'text-slate-600' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className={`text-sm font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {(deal as any).averageRating > 0
                    ? `${((deal as any).averageRating).toFixed(1)} (${(deal as any).ratingCount || 0} reviews)`
                    : 'No reviews yet'}
                </span>
              </div>

              {/* Offer value */}
              <div className="mb-6">
                <p className="text-2xl font-semibold text-yellow-600 mb-1">
                  {getLocalizedText(deal.localized_offer, deal.offerValue)}
                </p>
                {deal.end_date && (
                  <p className={`text-sm font-normal ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
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

              {/* Redeem button — greyed out placeholder */}
              <div className="w-full h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-medium mb-6 opacity-40 cursor-not-allowed">
                Get Before It's Gone!
              </div>

              {/* Redeem instructions info */}
              <div className={`flex items-start gap-3 p-3 rounded-lg mb-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                <span className={`text-sm font-normal leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Show the claim QR code at the store to redeem this deal. The merchant will scan it to verify.
                </span>
              </div>

              {/* Details — expandable like consumer */}
              {plainDesc && (
                <div className="mb-4">
                  <button
                    onClick={() => setDetailCarouselIndex(prev => prev === -1 ? 0 : -1)}
                    className={`w-full h-14 flex items-center justify-between px-4 border-b transition-colors ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-slate-400" />
                      <span className={`text-sm font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>Details</span>
                    </div>
                  </button>
                  <div className={`px-4 py-4 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                    <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{plainDesc}</p>
                  </div>
                </div>
              )}

              {/* Store Info — expandable like consumer */}
              <div className="mb-4">
                <div className={`w-full h-14 flex items-center gap-3 px-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <Store className="w-5 h-5 text-slate-400" />
                  <span className={`text-sm font-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>Store Info</span>
                </div>
                <div className={`px-4 py-4 space-y-3 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  {deal.shopName && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Store Name</p>
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{deal.shopName}</p>
                    </div>
                  )}
                  {deal.address && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Address</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{deal.address}</p>
                    </div>
                  )}
                  {deal.landmark && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Landmark</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{deal.landmark}</p>
                    </div>
                  )}
                  {(deal as any).storePhone && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Phone</p>
                      <a href={`tel:${(deal as any).storePhone}`} className="text-sm text-blue-500 font-medium">{(deal as any).storePhone}</a>
                      {(deal as any).storePhoneAlt && (
                        <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {' / '}
                          <a href={`tel:${(deal as any).storePhoneAlt}`} className="text-blue-500 font-medium">{(deal as any).storePhoneAlt}</a>
                        </span>
                      )}
                    </div>
                  )}
                  {(deal as any).storeHrs && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Store Hours</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{(deal as any).storeHrs}</p>
                    </div>
                  )}
                  {deal.start_date && deal.end_date && (
                    <div>
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Campaign Period</p>
                      <p className={`text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatDateUTC(deal.start_date)} — {formatDateUTC(deal.end_date)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2 mb-4">
                {getStatusDisplay(deal.status || 'active')}
              </div>

              {/* Merchant-only: Campaign Performance */}
              <div className={`rounded-xl border p-4 mb-4 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Campaign Performance
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{perCampaignClickCounts[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_clicks')}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{perCampaignClaimClicks[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Claims</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{perCampaignRedemptionCounts[deal.campaign_id] || 0}</p>
                    <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_redeemed')}</p>
                  </div>
                </div>
              </div>

              {/* Edit button if within window */}
              {deal.created_at && getTimeRemaining(deal.created_at) > 0 && (
                <button
                  onClick={() => { setSelectedDeal(null); handleEditClick(deal); }}
                  className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-3"
                >
                  <Edit2 className="w-4 h-4" /> {t('m_edit')}
                </button>
              )}

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
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
                  <div className={`text-[11px] leading-snug mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {tpl.description}
                  </div>
                </button>
              ))}
            </div>

            <div className={`px-5 pb-6 pt-1 text-[11px] leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Tip: you'll get a preview to proof-read before the print dialog opens.
            </div>
          </div>
        </div>
      )}

      {/* Poster proof-read preview — shows the actual rendered poster in an
          iframe so the merchant can verify wording/layout BEFORE the print
          dialog fires. Confirm opens the print window; Back returns to picker. */}
      {posterPreview && (
        <div
          className="fixed inset-0 z-[420] bg-black/80 backdrop-blur-sm flex flex-col"
          onClick={() => setPosterPreview(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`flex flex-col flex-1 max-w-2xl w-full mx-auto ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="min-w-0">
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Proof-read your poster
                </h3>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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

            {/* Iframe preview — same HTML the print window will use, with auto-print disabled.
                Critical layout: the OUTER wrapper takes the SCALED pixel dimensions (380×538)
                so document flow honors the visible size — otherwise the iframe's intrinsic 1123px
                height pushes the footer (with the Print button) below the viewport.
                The iframe inside renders at full A4 and is scaled via transform: scale(). */}
            <div className="flex-1 overflow-auto p-3 flex items-start justify-center bg-slate-300/40">
              <div
                style={{
                  width: 380,
                  height: 538, /* 380 × (297/210) */
                  flexShrink: 0,
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
                }}
              >
                <iframe
                  key={posterPreview.template /* re-render on template change */}
                  title="Poster preview"
                  srcDoc={buildPosterHtml(posterPreview.deal, posterPreview.template, { autoPrint: false })}
                  style={{
                    width: '210mm',
                    height: '297mm',
                    border: 0,
                    background: 'white',
                    display: 'block',
                    transform: 'scale(0.479)', /* 380 / 793 (210mm at 96dpi) */
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

      {/* Renew Deal Modal */}
      {renewDeal && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            {renewSuccess ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('m_deal_renewed')}
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('m_deal_live')}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <RefreshCw className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {t('m_renew_deal')}
                    </h3>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {renewDeal.deal_heading || renewDeal.details}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <div>
                    <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('m_start_date')}
                    </label>
                    <input
                      type="date"
                      value={renewStartDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setRenewStartDate(e.target.value)}
                      className={`w-full h-12 px-4 rounded-xl text-sm font-medium outline-none transition-all border ${
                        isDark
                          ? 'bg-slate-800 text-white border-slate-700 focus:border-emerald-500'
                          : 'bg-slate-50 text-slate-900 border-slate-200 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('m_end_date')}
                    </label>
                    <input
                      type="date"
                      value={renewEndDate}
                      min={renewStartDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setRenewEndDate(e.target.value)}
                      className={`w-full h-12 px-4 rounded-xl text-sm font-medium outline-none transition-all border ${
                        isDark
                          ? 'bg-slate-800 text-white border-slate-700 focus:border-emerald-500'
                          : 'bg-slate-50 text-slate-900 border-slate-200 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setRenewDeal(null)}
                    disabled={renewing}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t('m_cancel')}
                  </button>
                  <button
                    onClick={handleRenewConfirm}
                    disabled={renewing || !renewStartDate || !renewEndDate}
                    className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {t('m_renew')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
