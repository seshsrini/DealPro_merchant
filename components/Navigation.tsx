

import React from 'react';
import { Home, Zap, Heart, User, ChevronLeft, Sun, Moon, LayoutDashboard, BarChart3, List, Ticket, Languages, ChevronDown, Search, CheckSquare, TrendingUp, Image } from 'lucide-react'; // Added CheckSquare, TrendingUp, Image
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

export const Header: React.FC<NavProps> = ({ currentView, setView, onBack, showBack, theme, toggleTheme, isLoggedIn, userRole }) => {
  const isDark = theme === 'dark';
  const { locale, setLocale } = useTranslation();

  // Determine the home view based on user role
  const homeView: AppView = userRole === 'merchant' ? 'merchant_dashboard' : 
                            userRole === 'dealadmin' ? 'dealadmin_review_deals' : 'home';

  return (
    <header className="sticky top-0 z-50 px-6 h-24 flex items-center justify-between bg-transparent">
      <div className="flex items-center gap-4">
        {showBack ? (
          <button onClick={onBack} className={`w-12 h-12 rounded-[1.25rem] glass flex items-center justify-center transition-all active:scale-90 shadow-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
              <img
                src="/assets/logo.svg"
                alt="Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.src = "https://api.iconify.design/lucide:shopping-bag.svg?color=%23eab308";
                }}
              />
            </div>
            <span className={`font-black text-xl tracking-tighter uppercase leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>Deal<span className="text-yellow-500">Pro</span></span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
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
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-[95%] pointer-events-none">
       <nav className="pointer-events-auto h-22 glass rounded-[3rem] px-4 flex justify-between items-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;
            const isDisabled = (tab as any).disabled === true;

            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setView(tab.id as AppView)}
                disabled={isDisabled}
                className={`flex flex-col items-center justify-center gap-1 transition-all duration-400 min-w-[64px] rounded-2xl h-16 ${
                  isDisabled
                    ? 'text-slate-600 opacity-40 cursor-not-allowed'
                    : isActive
                    ? 'text-white btn-premium h-16 shadow-2xl shadow-yellow-600/50 scale-110'
                    : (isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-900')
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-white/20' : ''}`} />
                <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-90'}`}>{tab.label}</span>
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
    { id: 'merchant_dashboard', label: 'Console', icon: LayoutDashboard },
    { id: 'merchant_deals', label: 'My Campaigns', icon: List },
    { id: 'merchant_deal_of_day', label: 'Deal of Day', icon: Zap },
    { id: 'merchant_analytics', label: 'Intel', icon: BarChart3 },
    { id: 'profile', label: 'Hub', icon: User },
  ];

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-[90%] pointer-events-none">
       <nav className="pointer-events-auto h-22 glass rounded-[3rem] px-5 flex justify-between items-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as AppView)}
                className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-400 min-w-[72px] rounded-3xl h-16 ${
                  isActive
                    ? 'text-white btn-premium h-16 shadow-2xl shadow-yellow-600/50'
                    : (isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-900')
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'fill-white/20' : ''}`} />
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isActive ? 'opacity-100' : 'opacity-90'}`}>{tab.label}</span>
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
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-[90%] pointer-events-none">
       <nav className="pointer-events-auto h-22 glass rounded-[3rem] px-5 flex justify-between items-center shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-white/10">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentView === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as AppView)}
                className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-400 min-w-[72px] rounded-3xl h-16 ${
                  isActive
                    ? 'text-white btn-premium h-16 shadow-2xl shadow-yellow-600/50'
                    : (isDark ? 'text-slate-200 hover:text-white' : 'text-slate-700 hover:text-slate-900')
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'fill-white/20' : ''}`} />
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isActive ? 'opacity-100' : 'opacity-90'}`}>{tab.label}</span>
              </button>
            );
          })}
       </nav>
    </div>
  );
};