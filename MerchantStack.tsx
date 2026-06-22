


import { MerchantMyCampaigns } from './MerchantMyCampaigns.tsx';

import React, { useState, useCallback, useEffect } from 'react';
import { AppView, Deal, User } from './types';
import { MerchantProfile } from './MerchantProfile';
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
import { MerchantStores } from './MerchantStores';
import { HelpFeedback } from './HelpFeedback';
import { StoreQRPrint } from './components/StoreQRPrint';
import { ReferralTracker } from './components/ReferralTracker';
import { MerchantTeam } from './MerchantTeam';
import { merchantService } from './services/merchantService';
import { AIAssistantChat } from './AIAssistantChat'; // Import AI Assistant Chat
import { FeatureTour } from './components/FeatureTour'; // Import Feature Tour
import { CampaignTour } from './components/CampaignTour'; // Import Campaign Tour
import { CampaignWizard } from './CampaignWizard';
import { DotdWizard } from './DotdWizard';
import { MerchantDealOfDay } from './MerchantDealOfDay';
import { ProductWizard } from './ProductWizard';
import { CatalogueItem } from './MerchantCatalogue';

type CampaignTab = 'active' | 'expired';

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
  // Product wizard edit state (local to MerchantStack)
  const [editProduct, setEditProduct] = useState<CatalogueItem | null>(null);

  // Store gate: blocks app if merchant has no stores
  // Staff members use the owner's merchant ID to check stores
  const effectiveMerchantId = (user as any).staff_merchant_id || user.id;
  const isStaff = !!(user as any).staff_role && (user as any).staff_role !== 'owner';
  const [storeGate, setStoreGate] = useState<'open' | 'blocked'>('open');

  // Profile gate (backstop): a merchant must NEVER reach the dashboard / deal
  // creation with mandatory onboarding fields missing. Routing in AuthStack is
  // supposed to send incomplete profiles into the wizard, but if anything ever
  // lands an incomplete profile here (stale session, a future routing bug),
  // bounce them back into the resume-aware onboarding wizard instead of letting
  // them operate on a half-built account. Staff inherit the owner's profile, so
  // they're exempt.
  const profileComplete = isStaff || !!(
    user.full_name &&
    user.store_name &&
    user.business_type &&
    user.terms_accepted &&
    user.privacy_accepted
  );
  useEffect(() => {
    if (user.role !== 'merchant' || isStaff) return;
    if (!profileComplete) {
      console.warn('[MerchantStack] Incomplete merchant profile — bouncing to onboarding', {
        full_name: !!user.full_name, store_name: !!user.store_name,
        business_type: !!user.business_type, terms: !!user.terms_accepted, privacy: !!user.privacy_accepted,
      });
      setView('merchant_onboarding');
    }
  }, [user.id, profileComplete]);
  useEffect(() => {
    if (!user.id) return;
    // Staff members skip store gate — they use the owner's stores
    if (isStaff) { setStoreGate('open'); return; }
    merchantService.getMerchantStores(effectiveMerchantId)
      .then(s => { if (s.filter(store => store.active_status !== 'disabled').length === 0) setStoreGate('blocked'); })
      .catch(() => {}); // fail open — don't block on network error
  }, [user.id]);

  if (user.role !== 'merchant') {
    return null;
  }

  // Incomplete profile → the effect above is routing to onboarding; render
  // nothing meanwhile so a half-built dashboard never flashes.
  if (!profileComplete) {
    return null;
  }

  // Render current view
  let currentView;

  if (view === 'profile') currentView = <MerchantProfile user={user} setUser={setUser} setView={setView} theme={theme} />;
  else if (view === 'edit_profile') currentView = <EditProfile user={user} setUser={setUser} setView={setView} theme={theme} />;
  else if (view === 'merchant_subscriptions') currentView = <MerchantSubscriptions user={user} setView={setView} setUser={setUser} theme={theme} />;
  else if (view === 'payment_plans') currentView = <PaymentPlans user={user} setView={setView} theme={theme} />;

  else if (view === 'bank_verification') currentView = <BankVerification user={user} setUser={setUser} setView={setView} theme={theme} />;
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
        setDealIdToEdit={setDealIdToEdit}
      />
    );
  }
  else if (view === 'campaign_wizard') {
    currentView = (
      <CampaignWizard
        user={user}
        deals={deals}
        editDealId={dealIdToEdit}
        setView={setView}
        refreshDeals={refreshDeals}
        theme={theme}
      />
    );
  }
  else if (view === 'merchant_deal_of_day') currentView = (
    <MerchantDealOfDay
      user={user}
      deals={deals}
      loading={loading}
      setLoading={setLoading}
      refreshDeals={refreshDeals}
      setView={setView}
      theme={theme}
      setDealIdToEdit={setDealIdToEdit}
    />
  );
  else if (view === 'dotd_wizard') currentView = (
    <DotdWizard
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
  else if (view === 'merchant_stores') currentView = (
    <MerchantStores
      user={user}
      setView={setView}
      theme={theme}
      onStoreCountChange={(count) => { if (count === 0) setStoreGate('blocked'); }}
    />
  );
  else if (view === 'refer_consumer') currentView = <StoreQRPrint user={user} setView={setView} theme={theme} />;
  else if (view === 'referral_tracker') currentView = <ReferralTracker user={user} setView={setView} theme={theme} />;
  else if (view === 'merchant_team') currentView = <MerchantTeam user={user} setView={setView} theme={theme} />;
  else if (view === 'help_feedback') currentView = <HelpFeedback user={user} setView={setView} theme={theme} />;
  else if (view === 'merchant_analytics') currentView = <MerchantAnalytics user={user} theme={theme} setView={setView} />;
  else if (view === 'merchant_catalogue') currentView = (
    <MerchantCatalogue user={user} theme={theme} setView={setView} setEditProduct={setEditProduct} />
  );
  else if (view === 'product_wizard') currentView = (
    <ProductWizard
      user={user}
      setView={setView}
      theme={theme}
      editProduct={editProduct}
    />
  );
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
    // Fallback: any unknown/consumer view (e.g., 'home', 'splash', 'detail') for a logged-in merchant
    // should default to the dashboard so the screen never goes blank.
    console.warn('[MerchantStack] Unknown view for merchant:', view, '— defaulting to dashboard');
    currentView = (
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
  }

  // Render current view with global AI Assistant and Feature Tour
  return (
    <>
      {currentView}
      {view === 'merchant_dashboard' && storeGate !== 'blocked' && (
        <FeatureTour userId={user.id} theme={theme} />
      )}
      {view === 'merchant_deals' && storeGate !== 'blocked' && (
        <CampaignTour userId={user.id} theme={theme} />
      )}
      {storeGate !== 'blocked' && <AIAssistantChat user={user} theme={theme} setView={setView} />}

      {/* Store gate: fullscreen block when merchant has no stores */}
      {storeGate === 'blocked' && (
        <div className={`fixed inset-0 z-[9999] ${theme === 'dark' ? 'bg-slate-950' : 'bg-white'}`}>
          <MerchantStores
            user={user}
            setView={setView}
            theme={theme}
            forceAddMode={true}
            onFirstStoreAdded={() => setStoreGate('open')}
            onStoreCountChange={(count) => { if (count > 0) setStoreGate('open'); }}
          />
        </div>
      )}
    </>
  );
};