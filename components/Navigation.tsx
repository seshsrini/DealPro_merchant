

import React from 'react';
import { Home, Zap, Heart, User, ChevronLeft, Sun, Moon, LayoutDashboard, BarChart3, List, Ticket, Languages, ChevronDown, Search, Bell, LayoutGrid, Lock } from 'lucide-react';
import { AppView, Locale, User as UserType } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { usePermissions } from '../contexts/PermissionsContext';
import { DealProLogo } from './DealProLogo';

interface NavProps {
  currentView: AppView;
  setView: (view: AppView) => void;
  onBack?: () => void;
  showBack?: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isLoggedIn: boolean;
  userRole?: UserType['role']; // Pass user role to determine homeView
  unreadNotifications?: number;
  onBellClick?: () => void;
}

const LANGUAGES: { id: Locale; label: string; short: string; native: string }[] = [
  { id: 'en', label: 'English', short: 'EN', native: 'English' },
  { id: 'kn', label: 'Kannada', short: 'KN', native: 'ಕನ್ನಡ' },
  { id: 'hi', label: 'Hindi', short: 'HI', native: 'हिन्दी' },
  { id: 'ta', label: 'Tamil', short: 'TA', native: 'தமிழ்' },
  { id: 'te', label: 'Telugu', short: 'TE', native: 'తెలుగు' },
  { id: 'ml', label: 'Malayalam', short: 'ML', native: 'മലയാളം' },
  { id: 'bn', label: 'Bengali', short: 'BN', native: 'বাংলা' },
  { id: 'mr', label: 'Marathi', short: 'MR', native: 'मराठी' },
  { id: 'gu', label: 'Gujarati', short: 'GU', native: 'ગુજરાતી' }
];

export const Header: React.FC<NavProps> = ({ currentView, setView, onBack, showBack, theme, toggleTheme, isLoggedIn, userRole, unreadNotifications = 0, onBellClick }) => {
  const isDark = theme === 'dark';
  const { locale, setLocale } = useTranslation();

  return (
    <header className="sticky top-0 z-50 px-6 h-24 flex items-center justify-between bg-transparent">
      <div className="flex items-center gap-4">
        {showBack ? (
          <button onClick={onBack} className={`w-12 h-12 rounded-[1.25rem] glass flex items-center justify-center transition-all active:scale-90 shadow-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2.5">
            <DealProLogo className="w-9 h-9 rounded-lg overflow-hidden shrink-0 object-contain" />

            <div className="flex flex-col leading-none">
              <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DealPro</span>
              <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Merchant <span className="text-green-500">Hub</span></span>
            </div>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {/* Bell icon — consumer only */}
        {userRole === 'consumer' && onBellClick && (
          <button
            onClick={onBellClick}
            className="relative w-12 h-12 glass rounded-2xl flex items-center justify-center transition-all active:scale-90 border-white/10"
          >
            <Bell className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-green-500 text-black text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>
        )}

        {/* Compact Language Selector */}
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Languages className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className={`appearance-none h-12 pl-9 pr-8 glass rounded-2xl text-[11px] font-bold tracking-tight outline-none border-white/10 cursor-pointer transition-all active:scale-95 hover:bg-white/10 ${isDark ? 'text-white' : 'text-slate-900'}`}
          >
            {LANGUAGES.map(lang => (
              <option key={lang.id} value={lang.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                {lang.native}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </div>
        </div>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="w-12 h-12 glass rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-2xl border-white/10"
        >
          {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-blue-600" />}
        </button>
      </div>
    </header>
  );
};

export const BottomNav: React.FC<{ currentView: AppView; setView: (view: AppView) => void; theme: 'light' | 'dark'; user: UserType; isLocationComplete?: boolean }> = ({ currentView, setView, theme, user, isLocationComplete = false }) => {
  const isDark = theme === 'dark';
  const tabs = [
    { id: 'preferences', label: 'Explore', icon: Home }, // Moved to first position
    { id: 'deals_of_day', label: "Today's Deal", icon: Zap, disabled: !isLocationComplete }, // Moved to second, add disabled state
    // Only show "Search Store" for consumers
    ...(user.role === 'consumer' ? [{ id: 'store_search', label: 'Stores', icon: Search }] : []),
    { id: 'my_redemptions', label: 'Redeemed', icon: Ticket },
    { id: 'favorites', label: 'Saved', icon: Heart },
    { id: 'profile', label: 'Hub', icon: User },
  ];

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+2.5rem)] left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md pointer-events-none">
       <nav className={`pointer-events-auto rounded-2xl px-1.5 py-1.5 flex items-center border ${
         isDark
           ? 'bg-slate-900 border-slate-800 shadow-lg shadow-black/30'
           : 'bg-white border-slate-200 shadow-lg shadow-slate-200/60'
       }`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;
            const isDisabled = (tab as any).disabled === true;

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setView(tab.id as AppView)}
                disabled={isDisabled}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl py-2 flex-1 ${
                  isDisabled
                    ? 'opacity-30 cursor-not-allowed' + (isDark ? ' text-slate-500' : ' text-slate-400')
                    : isActive
                    ? 'text-white bg-yellow-500'
                    : isDark
                      ? 'text-slate-400'
                      : 'text-slate-600'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className="text-[7px] leading-tight font-black">{tab.label}</span>
              </button>
            );
          })}
       </nav>
    </div>
  );
};

// Which bottom-nav tab "owns" each sub-screen, so the tab stays highlighted while
// you're anywhere under it (e.g. Hub stays lit on My Subscription / Edit Profile /
// Team, Campaigns stays lit inside the deal wizard, etc.). Views not listed here
// (or global overlays like notifications) simply highlight no tab.
const MERCHANT_VIEW_TO_TAB: Record<string, AppView> = {
  merchant_dashboard: 'merchant_dashboard',

  merchant_deals: 'merchant_deals',
  campaign_wizard: 'merchant_deals',
  dealadmin_edit_deal: 'merchant_deals',

  merchant_catalogue: 'merchant_catalogue',
  product_wizard: 'merchant_catalogue',

  merchant_deal_of_day: 'merchant_deal_of_day',
  dotd_wizard: 'merchant_deal_of_day',

  merchant_analytics: 'merchant_analytics',
  merchant_ai_insights: 'merchant_analytics',

  profile: 'profile',
  edit_profile: 'profile',
  merchant_subscriptions: 'profile',
  payment_plans: 'profile',
  bank_verification: 'profile',
  merchant_stores: 'profile',
  refer_consumer: 'profile',
  referral_tracker: 'profile',
  merchant_team: 'profile',
  help_feedback: 'profile',
};

export const MerchantBottomNav: React.FC<{ currentView: AppView; setView: (view: AppView) => void; theme: 'light' | 'dark'; catalogueLocked?: boolean }> = ({ currentView, setView, theme, catalogueLocked = false }) => {
  const isDark = theme === 'dark';
  const { can } = usePermissions();
  const { t } = useTranslation();

  // Map tab IDs to required permissions. `label` is a translation key (see t() below).
  const allTabs = [
    { id: 'merchant_dashboard', label: 'mnav_console', icon: LayoutDashboard, tourId: 'tour-nav-console', permission: null }, // always visible
    { id: 'merchant_deals', label: 'mnav_campaigns', icon: List, tourId: 'tour-nav-campaigns', permission: 'campaign.create' },
    { id: 'merchant_catalogue', label: 'mnav_catalogue', icon: LayoutGrid, tourId: 'tour-nav-catalogue', permission: 'catalogue.manage' },
    { id: 'merchant_deal_of_day', label: 'mnav_dotd', icon: Zap, tourId: 'tour-nav-dotd', permission: 'dotd.create' },
    { id: 'merchant_analytics', label: 'mnav_intel', icon: BarChart3, tourId: 'tour-nav-intel', permission: 'analytics.view' },
    { id: 'profile', label: 'mnav_hub', icon: User, tourId: 'tour-nav-hub', permission: null }, // always visible
  ];

  const tabs = allTabs.filter(tab => !tab.permission || can(tab.permission));

  // Highlight the tab that OWNS the current screen, so it stays lit across that
  // section's sub-screens (e.g. Hub stays lit on My Subscription), not just the
  // exact tab view.
  const activeTabId = MERCHANT_VIEW_TO_TAB[currentView as string] ?? currentView;

  return (
    // Flush, full-width bar pinned to the bottom (constrained to the app's
    // max-w-md width), above the system gesture bar via the safe-area inset.
    // Mirrors the consumer app's bottom nav — no floating/rounded card.
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
      <nav
        className={`flex items-stretch border-t ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTabId === tab.id;
          const activeColor = isDark ? 'text-amber-400' : 'text-amber-600';
          // Catalogue is not included in the ₹199 plan — show the tab but grayed
          // out and non-clickable (a small lock replaces the active highlight).
          const isLocked = catalogueLocked && tab.id === 'merchant_catalogue';

          return (
            <button
              key={tab.id}
              id={tab.tourId}
              onClick={() => { if (!isLocked) setView(tab.id as AppView); }}
              disabled={isLocked}
              aria-disabled={isLocked}
              className={`relative flex flex-col items-center justify-center gap-1 pt-2.5 pb-1.5 flex-1 min-w-0 transition-colors ${
                isLocked
                  ? `opacity-40 cursor-not-allowed ${isDark ? 'text-slate-500' : 'text-slate-400'}`
                  : isActive ? activeColor : isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {isLocked && (
                <span className={`absolute top-1 right-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Lock className="w-3 h-3" />
                </span>
              )}
              {isActive && !isLocked && (
                <span className={`absolute top-0 h-[3px] w-8 rounded-full ${isDark ? 'bg-amber-400' : 'bg-amber-500'}`} />
              )}
              {/* Persistent highlight behind the ACTIVE tab — a soft amber glow so
                  the current screen's icon stays visibly brighter until you
                  navigate to another tab. */}
              {isActive && (
                <span aria-hidden className={`absolute inset-x-1.5 top-1.5 bottom-1 rounded-xl ${isDark ? 'bg-amber-400/15' : 'bg-amber-500/15'}`} />
              )}
              <Icon className="relative w-[21px] h-[21px]" strokeWidth={isActive ? 2.4 : 1.9} />
              <span className={`relative text-[9px] leading-none truncate max-w-full ${isActive ? 'font-bold' : `font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}`}>{t(tab.label)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

