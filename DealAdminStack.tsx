
import React, { useState } from 'react';
import { AppView, Deal, User } from './types';
import { DealAdminReviewDeals } from './DealAdminReviewDeals'; // NEW: Import DealAdminReviewDeals
// Fix: Explicitly added .tsx extension to ensure consistent casing resolution.
// Removed: import { MerchantMyCampaigns } from './MerchantMyCampaigns.tsx'; // Reusing for admin editing
import { DealAdminEditCampaign } from './DealAdminEditCampaign'; // NEW: Import new admin-specific edit component
import { EditProfile } from './EditProfile'; // NEW: Import EditProfile
import { DealAdminAnalytics } from './DealAdminAnalytics'; // NEW: Import Analytics
import { DealAdminBanners } from './DealAdminBanners'; // NEW: Import Banners

interface DealAdminStackProps {
  view: AppView;
  setView: (view: AppView) => void;
  user: User;
  setUser: (user: User) => void;
  adminDeals: Deal[];
  refreshAdminDeals: () => Promise<void>;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  theme: 'light' | 'dark';
  dealIdToEdit: string | null;
  setDealIdToEdit: (id: string | null) => void;
  onClearDealIdToEdit: () => void;
}

export const DealAdminStack: React.FC<DealAdminStackProps> = ({ 
  view, setView, user, setUser, adminDeals, refreshAdminDeals, loading, setLoading, theme,
  dealIdToEdit, setDealIdToEdit, onClearDealIdToEdit
}) => {

  if (user.role !== 'dealadmin') {
    return null; // Should ideally not happen if routing in App.tsx is correct
  }

  // Admin can review deals
  if (view === 'dealadmin_review_deals' || view === 'dealadmin_dashboard') { // Dashboard might be the same as review for now
    return (
      <DealAdminReviewDeals
        user={user}
        deals={adminDeals}
        loading={loading}
        setLoading={setLoading}
        refreshDeals={refreshAdminDeals}
        setView={setView}
        setDealIdToEdit={setDealIdToEdit}
        theme={theme}
      />
    );
  }

  // Admin can edit deals (now using the dedicated DealAdminEditCampaign)
  if (view === 'dealadmin_edit_deal' && dealIdToEdit) {
    return (
      <DealAdminEditCampaign
        user={user}
        campaignIdToEdit={dealIdToEdit}
        onCloseEdit={onClearDealIdToEdit}
        refreshAdminDeals={refreshAdminDeals}
        setLoading={setLoading}
        loading={loading}
        theme={theme}
      />
    );
  }

  // Admin Profile view (reuses existing EditProfile)
  if (view === 'profile') {
    return <EditProfile user={user} setUser={setUser} setView={setView} theme={theme} />;
  }

  // Admin Analytics view
  if (view === 'dealadmin_analytics') {
    return <DealAdminAnalytics user={user} theme={theme} />;
  }

  // Admin Banners view
  if (view === 'dealadmin_banners') {
    return <DealAdminBanners user={user} theme={theme} />;
  }

  return null;
};