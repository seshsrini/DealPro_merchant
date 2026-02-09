


import { MerchantMyCampaigns } from './MerchantMyCampaigns.tsx'; 
import React, { useState, useCallback } from 'react';
import { AppView, Deal, User } from './types';
import { MerchantProfile } from './merchantProfile';
import { EditProfile } from './EditProfile';
import { MerchantDashboard } from './MerchantDashboard';
import { addCampaignService } from './services/addCampaignService';
import { MerchantSubscriptions } from './MerchantSubscriptions'; // New import
import { PaymentPlans } from './PaymentPlans'; // Import PaymentPlans
import { BankVerification } from './BankVerification'; // NEW: Import BankVerification

type CampaignTab = 'review' | 'active' | 'expired';

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
  setDealIdToEdit: (id: string | null) => void;
  onClearDealIdToEdit: () => void;
  isScanning: boolean;
  setIsScanning: (val: boolean) => void;
}

export const MerchantStack: React.FC<MerchantStackProps> = ({ 
  view, setView, user, setUser, deals, loading, setLoading, theme, refreshDeals,
  dealIdToEdit, setDealIdToEdit, onClearDealIdToEdit,
  isScanning, setIsScanning
}) => {

  if (user.role !== 'merchant') {
    return null;
  }

  if (view === 'profile') return <MerchantProfile user={user} setUser={setUser} setView={setView} />;
  if (view === 'edit_profile') return <EditProfile user={user} setUser={setUser} setView={setView} />;
  
  // NEW: Render MerchantSubscriptions when view is 'merchant_subscriptions'
  if (view === 'merchant_subscriptions') return <MerchantSubscriptions user={user} setView={setView} />;

  // Render PaymentPlans when view is 'payment_plans'
  if (view === 'payment_plans') return <PaymentPlans user={user} setView={setView} />;

  // NEW: Render BankVerification when view is 'bank_verification'
  if (view === 'bank_verification') return <BankVerification user={user} setUser={setUser} setView={setView} />;

  if (view === 'merchant_deals') return (
    <MerchantMyCampaigns 
      user={user} 
      deals={deals}
      loading={loading} 
      setLoading={setLoading} 
      refreshDeals={refreshDeals} 
      setView={setView} 
      preSelectedEditDealId={dealIdToEdit}
      onClearPreSelected={onClearDealIdToEdit}
    />
  );
  if (view === 'merchant_dashboard') return (
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
    />
  );

  return null;
};