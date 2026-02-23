
import React, { useState, useMemo, useEffect } from 'react';
import { AppView, Deal } from './types';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { NotificationBadge } from './components/NotificationBadge';
import {
  Store,
  Plus,
  QrCode,
  Zap,
  Megaphone,
  AlertCircle,
  Gift,
  ChevronRight
} from 'lucide-react';

type CampaignTab = 'review' | 'active' | 'expired' | 'needs review';

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

interface Festival {
  name: string;
  month: number;
  day: number;
  themeKey: string;
}

const UPCOMING_FESTIVALS: Festival[] = [
  { name: 'New Year', month: 1, day: 1, themeKey: 'defaultBlue' },
  { name: 'Makar Sankranti', month: 1, day: 14, themeKey: 'defaultBlue' },
  { name: 'Republic Day', month: 1, day: 26, themeKey: 'indianFlag' },
  { name: 'Holi', month: 3, day: 8, themeKey: 'holiColors' },
  { name: 'Ugadi / Gudi Padwa', month: 3, day: 22, themeKey: 'defaultBlue' },
  { name: 'Eid al-Fitr', month: 4, day: 21, themeKey: 'defaultBlue' },
  { name: 'Independence Day', month: 8, day: 15, themeKey: 'indianFlag' },
  { name: 'Ganesh Chaturthi', month: 9, day: 19, themeKey: 'defaultBlue' },
  { name: 'Gandhi Jayanti', month: 10, day: 2, themeKey: 'defaultBlue' },
  { name: 'Dussehra', month: 10, day: 24, themeKey: 'diwaliColors' },
  { name: 'Diwali', month: 11, day: 12, themeKey: 'diwaliColors' },
  { name: 'Christmas', month: 12, day: 25, themeKey: 'christmasColors' },
];

const getNearestFestival = (): Festival => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nearestFestival: Festival = UPCOMING_FESTIVALS[0];
  let minDaysUntil = Infinity;

  for (const festival of UPCOMING_FESTIVALS) {
    let festivalDateThisYear = new Date(today.getFullYear(), festival.month - 1, festival.day);
    festivalDateThisYear.setHours(0, 0, 0, 0);

    let daysUntil = (festivalDateThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntil < 0) {
      let festivalDateNextYear = new Date(today.getFullYear() + 1, festival.month - 1, festival.day);
      festivalDateNextYear.setHours(0, 0, 0, 0);
      daysUntil = (festivalDateNextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    }

    if (daysUntil >= 0 && daysUntil < minDaysUntil) {
      minDaysUntil = daysUntil;
      nearestFestival = festival;
    }
  }
  return nearestFestival;
};

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

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({
  view, setView, user, setUser, deals, loading, setLoading, theme, refreshDeals,
  setDealIdToEdit, onClearDealIdToEdit, isScanning, setIsScanning,
  setPreSelectedTab
}) => {
  const isDark = theme === 'dark';

  const [campaignUsage, setCampaignUsage] = useState({
    campaigns_used: 0,
    campaigns_limit: 0,
    dotd_used: 0,
    dotd_limit: 0,
    has_subscription: false,
  });

  const [nearestFestival, setNearestFestival] = useState<Festival>({ name: 'Special Event', month: 1, day: 1, themeKey: 'defaultBlue' });

  const allMerchantDeals = useMemo(() => {
    const statusWeight: Record<string, number> = { 'review': 0, 'active': 1, 'expired': 2 };
    return [...deals]
      .sort((a, b) => {
        const weightA = statusWeight[a.status || 'active'] ?? 1;
        const weightB = statusWeight[b.status || 'active'] ?? 1;
        if (weightA !== weightB) return weightA - weightB;
        return (b.campaign_id || '').localeCompare(a.campaign_id || '');
      });
  }, [deals]);

  useEffect(() => {
    const fetchCampaignUsage = async () => {
      try {
        const usage = await merchantSubscriptionService.getCampaignUsage();
        setCampaignUsage(usage);
      } catch (err) {
        console.error("[MerchantDashboard] Error fetching campaign usage:", err);
      }
    };

    if (user?.id) {
      fetchCampaignUsage();
    }
  }, [user?.id, deals]);

  useEffect(() => {
    setNearestFestival(getNearestFestival());
  }, []);

  const reviewCampaignsCount = useMemo(() => {
    return deals.filter(deal => {
      const dealMerchantId = deal.merchantId || (deal as any).merchant_id;
      return deal.status === 'needs review' && dealMerchantId === user.id;
    }).length;
  }, [deals, user.id]);

  return (
    <div className={`px-6 pt-6 pb-32 space-y-6 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Dashboard
          </h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Welcome back, {user.full_name || user.store_name || 'Merchant'}
          </p>
        </div>
        <NotificationBadge
          merchantId={user.id}
          onClick={() => setView('merchant_notifications')}
          theme={theme}
        />
      </div>

      {/* Needs Review Alert */}
      {reviewCampaignsCount > 0 && (
        <button
          onClick={() => {
            if (setPreSelectedTab) {
              setPreSelectedTab('needs review');
            }
            setView('merchant_deals');
          }}
          className={`w-full p-4 rounded-xl flex items-center gap-3 text-left active:scale-[0.98] transition-all border ${
            isDark
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            isDark ? 'bg-red-500/20' : 'bg-red-100'
          }`}>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className={`text-xs font-medium ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              Action Required
            </p>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-red-900'}`}>
              {reviewCampaignsCount} Campaign{reviewCampaignsCount > 1 ? 's' : ''} Need{reviewCampaignsCount === 1 ? 's' : ''} Review
            </p>
          </div>
          <ChevronRight className={`w-5 h-5 shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
        </button>
      )}

      {/* Store Info */}
      <div className={`p-4 rounded-xl border ${
        isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.store_name}</p>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Merchant Dashboard</p>
      </div>

      {/* Campaign Usage */}
      {campaignUsage.has_subscription && (
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-blue-500/10' : 'bg-blue-50'
              }`}>
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
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isDark ? 'bg-amber-500/10' : 'bg-amber-50'
              }`}>
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

          {/* Warning Messages */}
          {(campaignUsage.campaigns_used >= campaignUsage.campaigns_limit || campaignUsage.dotd_used >= campaignUsage.dotd_limit) && (
            <div className="mt-4 space-y-2">
              {campaignUsage.campaigns_used >= campaignUsage.campaigns_limit && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200'}`}>
                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <p className={`text-xs ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                    {campaignUsage.campaigns_used > campaignUsage.campaigns_limit
                      ? <>You have exceeded your monthly campaign limit ({campaignUsage.campaigns_used}/{campaignUsage.campaigns_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.</>
                      : <>You have reached your monthly campaign limit ({campaignUsage.campaigns_limit}/{campaignUsage.campaigns_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.</>
                    }
                  </p>
                </div>
              )}
              {campaignUsage.dotd_used >= campaignUsage.dotd_limit && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                    {campaignUsage.dotd_used > campaignUsage.dotd_limit
                      ? <>You have exceeded your monthly Deal of the Day limit ({campaignUsage.dotd_used}/{campaignUsage.dotd_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.</>
                      : <>You have reached your monthly Deal of the Day limit ({campaignUsage.dotd_limit}/{campaignUsage.dotd_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.</>
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setView('merchant_deals')}
          className={`p-4 rounded-xl flex flex-col gap-3 text-left active:scale-[0.98] transition-all border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isDark ? 'bg-blue-500/10' : 'bg-blue-50'
          }`}>
            <Plus className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>New Deal</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Launch Campaign</p>
          </div>
        </button>

        <button
          onClick={() => setIsScanning(true)}
          className={`p-4 rounded-xl flex flex-col gap-3 text-left active:scale-[0.98] transition-all border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}>
            <QrCode className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Scan & Verify</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Redeem Voucher</p>
          </div>
        </button>
      </div>

      {/* Festival Banner */}
      <button
        onClick={() => setView('merchant_deals')}
        className={`w-full p-4 rounded-xl flex items-center gap-3 text-left active:scale-[0.98] transition-all border relative overflow-hidden ${
          getBannerThemeClasses(nearestFestival.themeKey, isDark)
        } ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          isDark ? 'bg-blue-500/10' : 'bg-blue-50'
        }`}>
          <Gift className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Upcoming: {nearestFestival.name}
          </p>
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Create a special deal for {nearestFestival.name}!
          </p>
        </div>
        <ChevronRight className={`w-5 h-5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
      </button>

    </div>
  );
};
