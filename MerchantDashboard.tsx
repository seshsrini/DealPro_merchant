import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AppView, Deal } from './types';
import { mDashboardService } from './services/mDashboardService';
import {
  Store,
  Plus,
  QrCode,
  Zap,
  Globe,
  Megaphone,
  AlertCircle,
  Clock,
  Calculator,
  Edit2,
  MousePointer2,
  TicketCheck,
  BarChart, // For analytics report
  HeartHandshake, // For referrals
  Award, // For general metrics
  CheckCircle2,
  ShieldCheck,
  Building2, // New icon for Total Campaigns
  Percent, // New icon for Conversion Rate
  Gift, // New icon for the festival banner
  ChevronRight
} from 'lucide-react';
// QRscan is now imported and rendered in App.tsx

type CampaignTab = 'review' | 'active' | 'expired';

interface MerchantDashboardProps {
  view: AppView; // Although it will primarily be 'merchant_dashboard', it's good to keep
  setView: (view: AppView) => void;
  user: any;
  setUser: (user: any) => void;
  deals: Deal[]; // Now directly receives merchant-specific deals from MerchantStack
  loading: boolean;
  setLoading: (loading: boolean) => void;
  theme: 'light' | 'dark';
  refreshDeals: () => Promise<void>;
  setDealIdToEdit: (id: string | null) => void;
  onClearDealIdToEdit: () => void;
  isScanning: boolean; // Passed from App.tsx
  // Fix: Corrected function signature for setIsScanning
  setIsScanning: (val: boolean) => void; 
}

// Helper function to get the nearest upcoming festival
interface Festival {
  name: string;
  month: number; // 1-12
  day: number;   // 1-31
  themeKey: string; // Added themeKey for dynamic backgrounds
}

const UPCOMING_FESTIVALS: Festival[] = [
  { name: 'New Year', month: 1, day: 1, themeKey: 'defaultBlue' },
  { name: 'Makar Sankranti', month: 1, day: 14, themeKey: 'defaultBlue' },
  { name: 'Republic Day', month: 1, day: 26, themeKey: 'indianFlag' }, 
  { name: 'Holi', month: 3, day: 8, themeKey: 'holiColors' }, // Approximate
  { name: 'Ugadi / Gudi Padwa', month: 3, day: 22, themeKey: 'defaultBlue' }, // Approximate
  { name: 'Eid al-Fitr', month: 4, day: 21, themeKey: 'defaultBlue' }, // Approximate
  { name: 'Independence Day', month: 8, day: 15, themeKey: 'indianFlag' },
  { name: 'Ganesh Chaturthi', month: 9, day: 19, themeKey: 'defaultBlue' }, // Approximate
  { name: 'Gandhi Jayanti', month: 10, day: 2, themeKey: 'defaultBlue' },
  { name: 'Dussehra', month: 10, day: 24, themeKey: 'diwaliColors' }, // Approximate, using Diwali theme
  { name: 'Diwali', month: 11, day: 12, themeKey: 'diwaliColors' }, // Approximate
  { name: 'Christmas', month: 12, day: 25, themeKey: 'christmasColors' },
];

const getNearestFestival = (): Festival => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  let nearestFestival: Festival = UPCOMING_FESTIVALS[0]; 
  let minDaysUntil = Infinity;

  // Find the nearest upcoming festival
  for (const festival of UPCOMING_FESTIVALS) {
    let festivalDateThisYear = new Date(today.getFullYear(), festival.month - 1, festival.day);
    festivalDateThisYear.setHours(0, 0, 0, 0);

    let daysUntil = (festivalDateThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntil < 0) { // If already passed this year, consider it for next year
      let festivalDateNextYear = new Date(today.getFullYear() + 1, festival.month - 1, festival.day);
      festivalDateNextYear.setHours(0, 0, 0, 0);
      daysUntil = (festivalDateNextYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    }
    
    if (daysUntil >= 0 && daysUntil < minDaysUntil) { // Only positive days or today
      minDaysUntil = daysUntil;
      nearestFestival = festival;
    }
  }
  return nearestFestival;
};

// Helper to get dynamic banner classes based on themeKey and current theme
const getBannerThemeClasses = (themeKey: string, isDark: boolean) => {
  switch (themeKey) {
    case 'indianFlag':
      // The custom CSS class 'indian-flag-banner' handles both dark and light modes internally
      return 'indian-flag-banner';
    case 'diwaliColors':
      return isDark ? 'diwali-banner-dark' : 'diwali-banner-light';
    case 'holiColors':
      return isDark ? 'holi-banner-dark' : 'holi-banner-light';
    case 'christmasColors':
      return isDark ? 'christmas-banner-dark' : 'christmas-banner-light';
    default: // Default blue theme
      return isDark ? 'default-banner-dark' : 'default-banner-light';
  }
};


export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({
  view, setView, user, setUser, deals, loading, setLoading, theme, refreshDeals,
  setDealIdToEdit, onClearDealIdToEdit, isScanning, setIsScanning // Received from App.tsx
}) => {
  const isDark = theme === 'dark';

  // Individual states for each analytics metric
  const [totalLifetimeDeals, setTotalLifetimeDeals] = useState(0);
  const [totalLifetimeClicks, setTotalLifetimeClicks] = useState(0);
  const [totalLifetimeRedemptions, setTotalLifetimeRedemptions] = useState(0);
  const [totalInvitesSent, setTotalInvitesSent] = useState(0);
  const [totalInvitesAccepted, setTotalInvitesAccepted] = useState(0);

  // Individual loading states
  const [loadingTotalDeals, setLoadingTotalDeals] = useState(false);
  const [loadingTotalClicks, setLoadingTotalClicks] = useState(false);
  const [loadingTotalRedemptions, setLoadingTotalRedemptions] = useState(false);
  const [loadingInvitesSent, setLoadingInvitesSent] = useState(false);
  const [loadingInvitesAccepted, setLoadingInvitesAccepted] = useState(false);

  // Derived state for lifetime conversion rate
  const lifetimeConversionRate = useMemo(() => {
    return totalLifetimeClicks > 0
      ? ((totalLifetimeRedemptions / totalLifetimeClicks) * 100).toFixed(1) + '%'
      : '0%';
  }, [totalLifetimeRedemptions, totalLifetimeClicks]);

  // Overall loading for the analytics section
  const isAnyAnalyticsLoading = loadingTotalDeals || loadingTotalClicks || loadingTotalRedemptions || loadingInvitesSent || loadingInvitesAccepted;

  // State for nearest upcoming festival
  const [nearestFestival, setNearestFestival] = useState<Festival>({ name: 'Special Event', month: 1, day: 1, themeKey: 'defaultBlue' });

  // `deals` prop now directly contains merchant-specific deals
  const allMerchantDeals = useMemo(() => {
    const statusWeight: Record<string, number> = { 'review': 0, 'active': 1, 'expired': 2 };
    return [...deals] // Use the already filtered 'deals' prop
      .sort((a, b) => {
        const weightA = statusWeight[a.status || 'active'] ?? 1;
        const weightB = statusWeight[b.status || 'active'] ?? 1;
        if (weightA !== weightB) return weightA - weightB;
        return (b.campaign_id || '').localeCompare(a.campaign_id || ''); // Fix: Use campaign_id
      });
  }, [deals]);

  // Fetch individual Lifetime Analytics metrics
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user?.id) {
        console.log("[MerchantDashboard] User ID not available for analytics, skipping fetch.");
        return;
      }

      const merchantId = user.id;

      const fetches = [
        (async () => {
          setLoadingTotalDeals(true);
          try {
            console.log("[MerchantDashboard] Fetching totalLifetimeDeals for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalLifetimeDeals(merchantId);
            setTotalLifetimeDeals(count || 0); // Ensure count is a number
            console.log("[MerchantDashboard] totalLifetimeDeals fetched:", count);
          } catch (error) {
            console.error("[MerchantDashboard] Error fetching totalLifetimeDeals:", error);
            setTotalLifetimeDeals(0); // Set to 0 on error
          } finally {
            setLoadingTotalDeals(false);
          }
        })(),
        (async () => {
          setLoadingTotalClicks(true);
          try {
            console.log("[MerchantDashboard] Fetching totalLifetimeClicks for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalLifetimeClicks(merchantId);
            setTotalLifetimeClicks(count || 0); // Ensure count is a number
            console.log("[MerchantDashboard] totalLifetimeClicks fetched:", count);
          } catch (error) {
            console.error("[MerchantDashboard] Error fetching totalLifetimeClicks:", error);
            setTotalLifetimeClicks(0); // Set to 0 on error
          } finally {
            setLoadingTotalClicks(false);
          }
        })(),
        (async () => {
          setLoadingTotalRedemptions(true);
          try {
            console.log("[MerchantDashboard] Fetching totalLifetimeRedemptions for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalLifetimeRedemptions(merchantId);
            setTotalLifetimeRedemptions(count || 0); // Ensure count is a number
            console.log("[MerchantDashboard] totalLifetimeRedemptions fetched:", count);
          } catch (error) {
            console.error("[MerchantDashboard] Error fetching totalLifetimeRedemptions:", error);
            setTotalLifetimeRedemptions(0); // Set to 0 on error
          } finally {
            setLoadingTotalRedemptions(false);
          }
        })(),
        (async () => {
          setLoadingInvitesSent(true);
          try {
            console.log("[MerchantDashboard] Fetching totalInvitesSent for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalInvitesSent(merchantId);
            setTotalInvitesSent(count || 0); // Ensure count is a number
            console.log("[MerchantDashboard] totalInvitesSent fetched:", count);
          } catch (error) {
            console.error("[MerchantDashboard] Error fetching totalInvitesSent:", error);
            setTotalInvitesSent(0); // Set to 0 on error
          } finally {
            setLoadingInvitesSent(false);
          }
        })(),
        (async () => {
          setLoadingInvitesAccepted(true);
          try {
            console.log("[MerchantDashboard] Fetching totalInvitesAccepted for user ID:", merchantId);
            const { count } = await mDashboardService.getTotalInvitesAccepted(merchantId);
            setTotalInvitesAccepted(count || 0); // Ensure count is a number
            console.log("[MerchantDashboard] totalInvitesAccepted fetched:", count);
          } catch (error) {
            console.error("[MerchantDashboard] Error fetching totalInvitesAccepted:", error);
            setTotalInvitesAccepted(0); // Set to 0 on error
          } finally {
            setLoadingInvitesAccepted(false);
          }
        })(),
      ];

      // Use Promise.allSettled to allow all fetches to complete independently
      await Promise.allSettled(fetches);
      console.log("[MerchantDashboard] All lifetime analytics fetches attempted.");
    };

    fetchAnalytics();
  }, [user?.id]); // Depend on user.id to trigger on user login/profile load

  // Effect to find the nearest festival
  useEffect(() => {
    setNearestFestival(getNearestFestival());
  }, []);

  const headingClass = isDark ? "text-white" : "text-slate-950";
  const subTextClass = isDark ? "text-slate-400" : "text-slate-600";
  const labelClass = isDark ? "text-slate-500" : "text-slate-700";

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal space-y-8">
      {/* QRscan is now rendered at the App level */}

      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter leading-none ${headingClass}`}>{user.store_name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">Merchant Dashboard Home</p>
          </div>
        </div>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border ${isDark ? 'glass border-white/10' : 'bg-white border-slate-100'}`}>
          <Store className="w-6 h-6 text-blue-600" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setView('merchant_deals')} className={`p-6 rounded-[2.5rem] flex flex-col gap-5 text-left group active:scale-[0.98] transition-all border ${isDark ? 'glass border-blue-500/20 bg-blue-500/5' : 'bg-white border-slate-200 shadow-md'}`}>
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 text-white" strokeWidth={3} />
          </div>
          <div>
            <p className={`text-base font-black leading-none mb-1 ${headingClass}`}>New Wave</p>
            <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">Launch Campaign</p>
          </div>
        </button>
        <button onClick={() => setIsScanning(true)} className={`p-6 rounded-[2.5rem] flex flex-col gap-5 text-left group active:scale-[0.98] transition-all border ${isDark ? 'glass border-white/5' : 'bg-white border-slate-200 shadow-md'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${isDark ? 'bg-slate-800' : 'bg-slate-900'}`}>
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className={`text-base font-black leading-none mb-1 ${headingClass}`}>Scan & Verify</p>
            <p className={`text-[8px] font-black uppercase tracking-widest ${subTextClass}`}>Redeem Voucher</p>
          </div>
        </button>
      </div>

      {/* Dynamic Festival Banner - Refined with themed background */}
      <button 
        onClick={() => setView('merchant_deals')}
        className={`w-full p-6 rounded-[2.5rem] flex items-center gap-4 text-left group transition-all duration-300 relative overflow-hidden glass shadow-3xl
          active:scale-[0.99] hover:scale-[1.01] 
          ${getBannerThemeClasses(nearestFestival.themeKey, isDark)}`}
      >
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/[0.03] to-transparent z-0"></div>
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-blue-500 opacity-5 blur-xl animate-slow-pulse z-0"></div>

          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 relative z-10 
            group-hover:scale-105 group-active:scale-95 shadow-[inset_0_0_15px_rgba(59,130,246,0.2)]
            ${isDark ? 'bg-blue-500/20' : 'bg-blue-200'}`}>
              <Gift className="w-7 h-7 text-blue-500 animate-pulse-slow" />
          </div>
          <div className="relative z-10">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-blue-700'}`}>
                  New opportunities for <span className="text-blue-500 text-sm">{nearestFestival.name}!</span>
              </p>
              <p className={`text-lg font-black leading-tight ${isDark ? 'text-white' : 'text-blue-900'}`}>
                  Want to create an amazing deal? <span className="text-blue-500 text-lg">{nearestFestival.name}</span> is coming up!
              </p>
          </div>
          <ChevronRight className={`w-6 h-6 ml-auto shrink-0 relative z-10 ${isDark ? 'text-blue-400' : 'text-blue-700'} group-hover:translate-x-1 transition-transform duration-300`} />
      </button>

      {/* Lifetime Analytics Report */}
      <div className="mt-16 space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className={`text-[11px] font-black uppercase tracking-[0.4em] ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>Lifetime Analytics Report</h3>
          <div className={`px-2 py-1 glass rounded-lg ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
            <span className="text-[10px] font-black text-blue-500">Overall</span>
          </div>
        </div>

        {isAnyAnalyticsLoading ? (
          <div className={`p-12 rounded-[2.5rem] border ${isDark ? 'border-white/5 bg-slate-900/20' : 'border-slate-200 bg-white shadow-md'} text-center animate-reveal`}>
            <BarChart className={`w-8 h-8 mx-auto mb-4 ${isDark ? 'text-slate-800' : 'text-slate-400'}`} />
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-700'}`}>Fetching Lifetime Data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Campaigns */}
            <div className={`group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border overflow-hidden relative ${
              isDark ? 'border-blue-500/20 bg-gradient-to-br from-blue-900/10 to-blue-500/5 shadow-2xl shadow-blue-500/10' : 'border-blue-200 bg-blue-50 shadow-md'
            }`}>
              <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${isDark ? 'bg-blue-500' : 'bg-blue-700'}`}></div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-200'}`}>
                <Building2 className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total Campaigns</p>
                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-blue-900'}`}>{totalLifetimeDeals.toLocaleString()}</p>
              </div>
            </div>

            {/* Total Redemptions */}
            <div className={`group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border overflow-hidden relative ${
              isDark ? 'border-emerald-500/20 bg-gradient-to-br from-emerald-900/10 to-emerald-500/5 shadow-2xl shadow-emerald-500/10' : 'border-emerald-200 bg-emerald-50 shadow-md'
            }`}>
              <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${isDark ? 'bg-emerald-500' : 'bg-emerald-700'}`}></div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-200'}`}>
                <TicketCheck className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total Redemptions</p>
                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-emerald-900'}`}>{totalLifetimeRedemptions.toLocaleString()}</p>
              </div>
            </div>

            {/* Total Clicks */}
            <div className={`group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border overflow-hidden relative ${
              isDark ? 'border-amber-500/20 bg-gradient-to-br from-amber-900/10 to-amber-500/5 shadow-2xl shadow-amber-500/10' : 'border-amber-200 bg-amber-50 shadow-md'
            }`}>
              <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${isDark ? 'bg-amber-500' : 'bg-amber-700'}`}></div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-200'}`}>
                <MousePointer2 className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Total Clicks</p>
                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-amber-900'}`}>{totalLifetimeClicks.toLocaleString()}</p>
              </div>
            </div>

            {/* Lifetime Conversion Rate */}
            <div className={`group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border overflow-hidden relative ${
              isDark ? 'border-orange-500/20 bg-gradient-to-br from-orange-900/10 to-orange-500/5 shadow-2xl shadow-orange-500/10' : 'border-orange-200 bg-orange-50 shadow-md'
            }`}>
              <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${isDark ? 'bg-orange-500' : 'bg-orange-700'}`}></div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-emerald-200'}`}>
                <Percent className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Conversion Rate</p>
                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-orange-900'}`}>{lifetimeConversionRate}</p>
              </div>
            </div>

            {/* Referral Invites Sent */}
            <div className={`group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border overflow-hidden relative ${
              isDark ? 'border-indigo-500/20 bg-gradient-to-br from-indigo-900/10 to-indigo-500/5 shadow-2xl shadow-indigo-500/10' : 'border-indigo-200 bg-indigo-50 shadow-md'
            }`}>
              <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${isDark ? 'bg-indigo-500' : 'bg-indigo-700'}`}></div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-200'}`}>
                <HeartHandshake className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Referral Invites Sent</p>
                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-indigo-900'}`}>{totalInvitesSent.toLocaleString()}</p>
              </div>
            </div>

            {/* Referral Invites Accepted */}
            <div className={`group glass p-5 rounded-[2.5rem] flex flex-col items-start gap-4 border overflow-hidden relative ${
              isDark ? 'border-purple-500/20 bg-gradient-to-br from-purple-900/10 to-purple-500/5 shadow-2xl shadow-purple-500/10' : 'border-purple-200 bg-purple-50 shadow-md'
            }`}>
              <div className={`absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${isDark ? 'bg-purple-500' : 'bg-purple-700'}`}></div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-200'}`}>
                <CheckCircle2 className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Referral Invites Accepted</p>
                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-purple-900'}`}>{totalInvitesAccepted.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};