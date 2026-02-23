


import { MerchantMyCampaigns } from './MerchantMyCampaigns.tsx';
import { MerchantDealOfDay } from './MerchantDealOfDay';
import React, { useState, useCallback } from 'react';
import { AppView, Deal, User } from './types';
import { MerchantProfile } from './merchantProfile';
import { EditProfile } from './EditProfile';
import { MerchantDashboard } from './MerchantDashboard';
import { addCampaignService } from './services/addCampaignService';
import { MerchantSubscriptions } from './MerchantSubscriptions'; // New import
import { PaymentPlans } from './PaymentPlans'; // Import PaymentPlans
import { BankVerification } from './BankVerification'; // NEW: Import BankVerification
import { MerchantAnalytics } from './MerchantAnalytics'; // Import MerchantAnalytics
import { MerchantCatalogue } from './MerchantCatalogue';
import { SmartNotifications } from './SmartNotifications'; // Import SmartNotifications
import { MerchantAIInsights } from './MerchantAIInsights'; // Import AI Insights Dashboard
import { AIAssistantChat } from './AIAssistantChat'; // Import AI Assistant Chat

type CampaignTab = 'review' | 'active' | 'expired' | 'needs review';

interface MerchantStackProps {
  view: AppView;
  setView: (view: AppView) => void;
  user: User;
  setUser: (user: User) => void;
  deals: Deal[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  theme: 'light' | 'dark';
  refreshDeals: () => Promise<void>;
  dealIdToEdit?: string | null;
  setDealIdToEdit: (id: string | null) => void;
  onClearDealIdToEdit: () => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
  preSelectedTab?: CampaignTab | null;
  setPreSelectedTab?: (tab: CampaignTab | null) => void;
}

export const MerchantStack: React.FC<MerchantStackProps> = ({
  view, setView, user, setUser, deals, loading, setLoading, theme, refreshDeals,
  dealIdToEdit, setDealIdToEdit, onClearDealIdToEdit,
  isScanning, setIsScanning,
  preSelectedTab, setPreSelectedTab
}) => {

  if (user.role !== 'merchant') {
    return null;
  }

  // Subscription Gate: Require active subscription for all merchant pages
  // Allow access to subscriptions page, profile pages, and edit profile
  const allowedWithoutSubscription = ['merchant_subscriptions', 'profile', 'edit_profile'];

  if (!user.hasActiveSubscription && !allowedWithoutSubscription.includes(view)) {
    console.log('[MerchantStack] No active subscription, showing subscriptions page');
    // Show subscriptions page if trying to access restricted pages
    return (
      <>
        <MerchantSubscriptions user={user} setView={setView} setUser={setUser} />
        <AIAssistantChat user={user} theme={theme} setView={setView} />
      </>
    );
  }

  // Render current view
  let currentView;

  if (view === 'profile') currentView = <MerchantProfile user={user} setUser={setUser} setView={setView} theme={theme} />;
  else if (view === 'edit_profile') currentView = <EditProfile user={user} setUser={setUser} setView={setView} theme={theme} />;
  else if (view === 'merchant_subscriptions') currentView = <MerchantSubscriptions user={user} setView={setView} setUser={setUser} />;
  else if (view === 'payment_plans') currentView = <PaymentPlans user={user} setView={setView} />;

  else if (view === 'bank_verification') currentView = <BankVerification user={user} setUser={setUser} setView={setView} />;
  else if (view === 'merchant_deals') {
    // Clear the preSelectedTab after using it
    const tabToSelect = preSelectedTab;
    if (setPreSelectedTab && preSelectedTab) {
      setPreSelectedTab(null);
    }

    currentView = (
      <MerchantMyCampaigns
        user={user}
        deals={deals}
        loading={loading}
        setLoading={setLoading}
        refreshDeals={refreshDeals}
        setView={setView}
        preSelectedEditDealId={dealIdToEdit}
        onClearPreSelected={onClearDealIdToEdit}
        preSelectedTab={tabToSelect}
        theme={theme}
      />
    );
  }
  else if (view === 'merchant_deal_of_day') currentView = (
    <MerchantDealOfDay
      user={user}
      setView={setView}
      theme={theme}
    />
  );
  else if (view === 'merchant_dashboard') currentView = (
    <MerchantDashboard
      view={view}
      setView={setView}
      user={user}
      setUser={setUser}
      deals={deals}
      loading={loading}
      setLoading={setLoading}
      theme={theme}
      refreshDeals={refreshDeals}
      setDealIdToEdit={setDealIdToEdit}
      onClearDealIdToEdit={onClearDealIdToEdit}
      isScanning={isScanning}
      setIsScanning={setIsScanning}
      setPreSelectedTab={setPreSelectedTab}
    />
  );
  else if (view === 'merchant_analytics') currentView = <MerchantAnalytics user={user} theme={theme} setView={setView} />;
  else if (view === 'merchant_catalogue') currentView = <MerchantCatalogue user={user} theme={theme} setView={setView} />;
  else if (view === 'merchant_notifications') currentView = (
    <SmartNotifications
      user={user}
      theme={theme}
      onNavigate={(route) => {
        // Route mapping for navigation
        if (route === '/merchant/campaigns') setView('merchant_deals');
        else if (route === '/merchant/catalogue') setView('merchant_catalogue');
        else if (route === '/merchant/analytics') setView('merchant_analytics');
      }}
    />
  );
  else if (view === 'merchant_ai_insights') currentView = (
    <MerchantAIInsights
      user={user}
      theme={theme}
      setView={setView}
    />
  );
  else {
    currentView = null;
  }

  // Render current view with global AI Assistant
  return (
    <>
      {currentView}
      <AIAssistantChat user={user} theme={theme} setView={setView} />
    </>
  );
};