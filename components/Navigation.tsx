

import React from 'react';
import { Home, Zap, Heart, User, ChevronLeft, Sun, Moon, LayoutDashboard, BarChart3, List, Ticket, Languages, ChevronDown, Search, CheckSquare, TrendingUp, Image, Bell, LayoutGrid } from 'lucide-react';
import { AppView, Locale, User as UserType } from '../types';
import { useTranslation } from '../contexts/LanguageContext';

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

const LANGUAGES: { id: Locale; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'kn', label: 'Kannada', short: 'KN' },
  { id: 'hi', label: 'Hindi', short: 'HI' },
  { id: 'ta', label: 'Tamil', short: 'TA' },
  { id: 'te', label: 'Telugu', short: 'TE' },
  { id: 'ml', label: 'Malayalam', short: 'ML' },
  { id: 'bn', label: 'Bengali', short: 'BN' },
  { id: 'mr', label: 'Marathi', short: 'MR' },
  { id: 'gu', label: 'Gujarati', short: 'GU' }
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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="/assets/merchantlogo.svg"
                alt="DealPro"
                className="w-full h-full object-contain"
              />
            </div>
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
            className={`appearance-none h-12 pl-9 pr-8 glass rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none border-white/10 cursor-pointer transition-all active:scale-95 hover:bg-white/10 ${isDark ? 'text-white' : 'text-slate-900'}`}
          >
            {LANGUAGES.map(lang => (
              <option key={lang.id} value={lang.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                {lang.short}
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md pointer-events-none">
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
                <span className={`text-[7px] leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            );
          })}
       </nav>
    </div>
  );
};

export const MerchantBottomNav: React.FC<{ currentView: AppView; setView: (view: AppView) => void; theme: 'light' | 'dark' }> = ({ currentView, setView, theme }) => {
  const isDark = theme === 'dark';
  const tabs = [
    { id: 'merchant_dashboard', label: 'Console', icon: LayoutDashboard, tourId: 'tour-nav-console' },
    { id: 'merchant_deals', label: 'Campaigns', icon: List, tourId: 'tour-nav-campaigns' },
    { id: 'merchant_catalogue', label: 'Catalogue', icon: LayoutGrid, tourId: 'tour-nav-catalogue' },
    { id: 'merchant_deal_of_day', label: 'Deal of Day', icon: Zap, tourId: 'tour-nav-dotd' },
    { id: 'merchant_analytics', label: 'Intel', icon: BarChart3, tourId: 'tour-nav-intel' },
    { id: 'profile', label: 'Hub', icon: User, tourId: 'tour-nav-hub' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md pointer-events-none">
       <nav className={`pointer-events-auto rounded-2xl px-1.5 py-1.5 flex items-center border ${
         isDark
           ? 'bg-slate-900 border-slate-800 shadow-lg shadow-black/30'
           : 'bg-white border-slate-200 shadow-lg shadow-slate-200/60'
       }`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                id={tab.tourId}
                onClick={() => setView(tab.id as AppView)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl py-2 flex-1 ${
                  isActive
                    ? isDark
                      ? 'text-slate-900 bg-amber-400'
                      : 'text-slate-900 bg-amber-400'
                    : isDark
                      ? 'text-slate-400'
                      : 'text-slate-900'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className={`text-[8px] leading-tight ${isActive ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            );
          })}
       </nav>
    </div>
  );
};

export const DealAdminBottomNav: React.FC<{ currentView: AppView; setView: (view: AppView) => void; theme: 'light' | 'dark' }> = ({ currentView, setView, theme }) => {
  const isDark = theme === 'dark';
  const tabs = [
    { id: 'dealadmin_review_deals', label: 'Review', icon: CheckSquare },
    { id: 'dealadmin_dashboard', label: 'Console', icon: LayoutDashboard },
    { id: 'dealadmin_banners', label: 'Banners', icon: Image },
    { id: 'dealadmin_analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'profile', label: 'Admin', icon: User },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md pointer-events-none">
       <nav className={`pointer-events-auto rounded-2xl px-1.5 py-1.5 flex items-center border ${
         isDark
           ? 'bg-slate-900 border-slate-800 shadow-lg shadow-black/30'
           : 'bg-white border-slate-200 shadow-lg shadow-slate-200/60'
       }`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as AppView)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all rounded-xl py-2 flex-1 ${
                  isActive
                    ? isDark
                      ? 'text-white bg-slate-800'
                      : 'text-slate-900 bg-slate-100'
                    : isDark
                      ? 'text-slate-500'
                      : 'text-slate-400'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" />
                <span className={`text-[8px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
              </button>
            );
          })}
       </nav>
    </div>
  );
};