import React, { useState, useEffect, useCallback } from 'react';
import { AppView, User, Deal } from './types'; // Import User type
import { userService } from './services/userService';
import { biometricService } from './services/biometricService'; // Corrected import syntax
import { AuthStack } from './AuthStack';
import { MemberJoin } from './memberJoin';
import { ConsumerStack } from './ConsumerStack';
import { MerchantStack } from './MerchantStack';
import { DealAdminStack } from './DealAdminStack'; // NEW: Import DealAdminStack
import { RedemptionSurvey } from './RedemptionSurvey';
import { Onboarding } from './Onboarding';
import { LanguageProvider } from './contexts/LanguageContext';
import { LanguageSelection } from './components/LanguageSelection';
import { Header, BottomNav, MerchantBottomNav, DealAdminBottomNav } from './components/Navigation'; // Added imports
import { Loader2 } from 'lucide-react';
// OLD: import { MyredeemService } from './services/MyredeemService';
// NEW: Import the dedicated redemption history service
import { redemptionHistoryService } from './services/redemptionHistoryService';
import { QRscan } from './QRscan';
import { supabase, updateSupabaseSession } from './services/supabaseClient'; // Import supabase and the session updater
import { addCampaignService } from './services/addCampaignService';
import { getCampaignsConsumer } from './services/getCampaignsConsumer'; // NEW: Import getCampaignsConsumer
import { OtpVerificationModal } from './OtpVerificationModal'; // New Import
import { fetchFavoritesService } from './services/fetchFavorites'; // NEW: Import fetchFavoritesService

const AppContent: React.FC = () => {
  const [view, setView] = useState<AppView>('splash');
  const [lastListView, setLastListView] = useState<AppView>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [loading, setLoading] = useState(false);
  const [hasBiometricSession, setHasBiometricSession] = useState(false);
  const [dealIdToEdit, setDealIdToEdit] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // User state now correctly initialized with the User interface structure
  const [user, setUser] = useState<User>({
    id: '',
    username: '',
    isLoggedIn: false,
    role: 'consumer', // Default role
    full_name: '', // Added full_name to initial state
    access_token: null,
    refresh_token: null,
    onboarding_complete: false, // Initialize onboarding status
  });
  const [deals, setDeals] = useState<Deal[]>([]); // This will now only hold merchant deals or be an empty array for consumers
  const [adminDeals, setAdminDeals] = useState<Deal[]>([]); // NEW: State for DealAdmin deals
  const [favoriteIds, setFavoriteIds] = useState<Map<string, string>>(new Map());
  // Fix: Corrected the initialization of `redeemedIds` to use `useState` properly.
  const [redeemedIds, setRedeemedIds] = useState<Set<string>>(new Set());

  // NEW: State to hold full Deal objects for favorites
  const [favoriteDeals, setFavoriteDeals] = useState<Deal[]>([]);

  // OTP Modal State for Consumer Phone Verification during Registration
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPhoneNumber, setOtpPhoneNumber] = useState('');
  const [isPhoneVerifiedForRegistration, setIsPhoneVerifiedForRegistration] = useState(false);

  // New state for registration success message
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState<string | null>(null);


  const navigateTo = (newView: AppView) => {
    if (['home', 'deals', 'deals_of_day', 'favorites', 'merchant_dashboard', 'merchant_deals', 'profile', 'store_search', 'dealadmin_review_deals', 'dealadmin_dashboard'].includes(newView)) {
      setLastListView(newView);
    }
    setView(newView);
  };

  // NEW: Function to fetch and update consumer favorites
  const updateConsumerFavorites = useCallback(async (consumerId: string) => {
    if (!consumerId || user.role !== 'consumer') {
      console.log("[App.tsx updateConsumerFavorites] Not a consumer or user ID missing, skipping favorites fetch.");
      setFavoriteIds(new Map());
      setFavoriteDeals([]);
      return;
    }
    setLoading(true);
    try {
      console.log("[App.tsx updateConsumerFavorites] Fetching favorites for consumer ID:", consumerId);
      // Pass the access token from user state
      const favsData = await fetchFavoritesService.fetchFavorites(consumerId, user.access_token);

      const favMap = new Map<string, string>();
      favsData.forEach(item => {
        // Fix: Use item.campaign_id instead of item.id
        if (item.campaign_id) favMap.set(String(item.campaign_id), item.status || 'active');
      });
      setFavoriteIds(favMap);
      setFavoriteDeals(favsData); // Populate the full favorite deals state
      console.log("[App.tsx updateConsumerFavorites] Fetched favsData:", favsData);
    } catch (err) {
      console.error("[App.tsx - updateConsumerFavorites] Failed to fetch favorites:", err);
      setFavoriteIds(new Map());
      setFavoriteDeals([]);
    } finally {
      setLoading(false);
    }
  }, [user.role, user.access_token]); // Depend on user.role and access_token

  // refreshDeals is now primarily for Merchant Deals and consumer-specific redemptions
  const refreshDeals = useCallback(async () => {
    if (!user.isLoggedIn || !user.id || !user.access_token) {
      console.log("[App.tsx refreshDeals] Authentication state incomplete. Aborting fetch.");
      return;
    }
    
    console.log(`[App.tsx refreshDeals] Pulse triggered for User: ${user.id} (${user.role})`);

    try {
      let fetchedDeals: Deal[] = [];
      if (user.role === 'merchant') {
        console.log(`[App.tsx refreshDeals] Invoking 'getMerchantDeals' for ID: ${user.id}`);
        fetchedDeals = await addCampaignService.getMerchantDeals(user.id);
        console.log(`[App.tsx refreshDeals] Pipeline Success: Received ${fetchedDeals.length} campaigns.`);
      }
      
      setDeals(fetchedDeals); 
      
      // Conditionally fetch redemption history only for consumers
      if (user.role === 'consumer') {
        const historyData = await redemptionHistoryService.getRedemptionHistory(user.id);
        const trulyRedeemedCampaignIds = new Set<string>();
        historyData.forEach(item => {
          if (item.is_redeemed === true) {
            trulyRedeemedCampaignIds.add(String(item.campaign_id));
          }
        });
        setRedeemedIds(trulyRedeemedCampaignIds);
      }
    } catch (err) {
      console.error("[App.tsx refreshDeals] Data pipeline failure:", err);
    }
  }, [user.id, user.role, user.isLoggedIn, user.access_token]); // Removed 'loading' to prevent re-creation loops

  // NEW: refreshAdminDeals for dealadmin role
  const refreshAdminDeals = useCallback(async () => {
    if (!user.isLoggedIn || !user.id || user.role !== 'dealadmin' || !user.access_token) {
      console.log("[App.tsx refreshAdminDeals] DealAdmin authentication state incomplete. Aborting fetch.");
      setAdminDeals([]);
      return;
    }

    setLoading(true);
    try {
      console.log(`[App.tsx refreshAdminDeals] Fetching deals in review for admin user: ${user.id}`);
      const fetchedAdminDeals = await addCampaignService.getDealsByStatus('review');
      setAdminDeals(fetchedAdminDeals);
      console.log(`[App.tsx refreshAdminDeals] Fetched ${fetchedAdminDeals.length} deals for admin review.`);
    } catch (err) {
      console.error("[App.tsx refreshAdminDeals] Data pipeline failure:", err);
      setAdminDeals([]);
    } finally {
      setLoading(false);
    }
  }, [user.id, user.role, user.isLoggedIn, user.access_token]);

  useEffect(() => {
    if (user.id && user.isLoggedIn) { 
      if (user.role === 'merchant' || user.role === 'consumer') {
        refreshDeals();
      } else if (user.role === 'dealadmin') {
        refreshAdminDeals();
      }
    }
  }, [user.id, user.isLoggedIn, user.role, refreshDeals, refreshAdminDeals]); // Call refresh when user state settles

  // Update Supabase client session whenever user.access_token changes
  useEffect(() => {
    if (user.access_token && user.refresh_token && user.id) {
      updateSupabaseSession({ 
        access_token: user.access_token, 
        refresh_token: user.refresh_token, 
        user: { id: user.id, email: user.email, user_metadata: { role: user.role } } as any, // Simulate auth.user structure
        token_type: 'bearer', 
        expires_in: 3600, 
        expires_at: Date.now() + 3600 * 1000 
      });
    } else {
      updateSupabaseSession(null); // Clear session if no access_token
    }
  }, [user.access_token, user.refresh_token, user.id, user.email, user.role]); // Added email, role to dependencies

  useEffect(() => {
    if (view === 'splash') {
      const timer = setTimeout(() => {
        // Always navigate to login after splash, AuthStack will handle session restore.
        setView('login');
      }, 4000); // 4-second splash screen

      biometricService.isAvailable().then(available => {
        setHasBiometricSession(available);
      });

      return () => clearTimeout(timer);
    }
  }, [view]);

  // Biometric Auto-Login
  useEffect(() => {
    if (view === 'login' && hasBiometricSession && !user.isLoggedIn) {
      const attemptBiometricLogin = async () => {
        try {
          setLoading(true);
          const authenticatedUser = await biometricService.authenticate();

          if (authenticatedUser) {
            setUser(authenticatedUser);
            const userRole = authenticatedUser.role || 'consumer';
            const onboardingDone = authenticatedUser.onboarding_complete;

            if (userRole === 'merchant') {
              navigateTo('merchant_dashboard');
            } else if (userRole === 'dealadmin') {
              navigateTo('dealadmin_review_deals');
            } else {
              navigateTo(onboardingDone ? 'home' : 'onboarding');
            }
          }
        } catch (error) {
          console.error('Biometric authentication failed:', error);
        } finally {
          setLoading(false);
        }
      };

      attemptBiometricLogin();
    }
  }, [view, hasBiometricSession, user.isLoggedIn]);


  const isLoginScreen = !user.isLoggedIn && (view === 'login' || view === 'forgot_password' || view === 'register');

  const handleBackNavigation = () => {
    if (!user.isLoggedIn && (view === 'register' || view === 'forgot_password' || view === 'verify_phone')) {
      navigateTo('login');
    } else if (view === 'merchant_deals') {
      navigateTo('merchant_dashboard');
    } else if (view === 'dealadmin_edit_deal') { // NEW: Admin edit back to review list
      navigateTo('dealadmin_review_deals');
    }
    else {
      navigateTo(lastListView);
    }
  };


  return (
    <div className={`max-w-md mx-auto min-h-screen relative flex flex-col transition-colors duration-500 ${
      isLoginScreen 
        ? (theme === 'dark' ? 'bg-black text-white' : 'bg-slate-50 text-slate-900') // Specific for login screens
        : (theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900') // General app screens
    } ${theme === 'light' ? 'light-mode' : ''}`}> {/* Apply light-mode class to the root div */}
      {view === 'splash' ? (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
          <div className="relative mb-8 w-48 h-48">
            <div className="absolute inset-0 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
            <img src="/assets/logo.svg" alt="DealPro Logo" className="w-full h-full object-contain animate-float relative z-10" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white uppercase text-center">
            DEAL<span className="text-yellow-500">Pro</span>
          </h1>
          <p className="mt-4 text-[12px] indian-flag-text text-center font-black tracking-[0.3em]">ENGINEERED BY VEDIC JAALAM</p>
          <div className="absolute bottom-24 text-center w-full px-8">
             <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
                <div className="h-full bg-yellow-500 animate-[loading_4s_linear]"></div>
             </div>
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">SYSTEM INITIALIZING | 4.0s</p>
          </div>
        </div>
      ) : (
        <>
          {view === 'language_selection' && <LanguageSelection setView={navigateTo} />}
          {user.role === 'consumer' && view === 'onboarding' && <Onboarding setView={navigateTo} user={user} setUser={setUser} />} {/* Only show onboarding for consumers */}
          <Header
            currentView={view}
            setView={navigateTo}
            showBack={['detail', 'register', 'forgot_password', 'merchant_deals', 'edit_profile', 'help_feedback', 'my_redemptions', 'verify_phone', 'onboarding', 'merchant_subscriptions', 'payment_plans', 'bank_verification', 'store_search', 'dealadmin_edit_deal'].includes(view)}
            onBack={handleBackNavigation}
            theme={theme}
            toggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            isLoggedIn={user.isLoggedIn}
            userRole={user.role} // Pass user role to Header
          />
          <main className="flex-1 overflow-y-auto hide-scrollbar pb-32">
            {!user.isLoggedIn ? (
              view === 'register' ?
                <MemberJoin
                  setView={navigateTo}
                  loading={loading}
                  setLoading={setLoading}
                  setShowOtpModal={setShowOtpModal}
                  setOtpPhoneNumber={setOtpPhoneNumber}
                  otpPhoneNumber={otpPhoneNumber}
                  isPhoneVerifiedForRegistration={isPhoneVerifiedForRegistration}
                  setRegistrationSuccessMessage={setRegistrationSuccessMessage} // Pass setter here
                  theme={theme} // Pass theme to MemberJoin
                /> :
              // The OtpVerificationModal no longer relies on a specific `setView` directly
              <AuthStack
                view={view}
                setView={navigateTo}
                setUser={setUser}
                loading={loading}
                setLoading={setLoading}
                registrationMessage={registrationSuccessMessage} // Pass message
                setRegistrationMessage={setRegistrationSuccessMessage} // Pass setter
                theme={theme} // Pass theme to AuthStack
              />
            ) : user.role === 'merchant' ? ( // Check for 'merchant' role
              <MerchantStack
                view={view}
                setView={navigateTo}
                user={user}
                setUser={setUser}
                deals={deals}
                loading={loading}
                setLoading={setLoading}
                theme={theme}
                refreshDeals={refreshDeals}
                dealIdToEdit={dealIdToEdit}
                setDealIdToEdit={setDealIdToEdit}
                onClearDealIdToEdit={() => setDealIdToEdit(null)}
                isScanning={isScanning}
                setIsScanning={setIsScanning}
              />
            ) : user.role === 'dealadmin' ? ( // NEW: Check for 'dealadmin' role
              <DealAdminStack
                view={view}
                setView={navigateTo}
                user={user}
                setUser={setUser}
                adminDeals={adminDeals}
                refreshAdminDeals={refreshAdminDeals}
                loading={loading}
                setLoading={setLoading}
                theme={theme}
                dealIdToEdit={dealIdToEdit}
                setDealIdToEdit={setDealIdToEdit}
                onClearDealIdToEdit={() => {
                  setDealIdToEdit(null);
                  setView('dealadmin_review_deals'); // Navigate back to review list
                }}
              />
            ) : ( // Default to consumer stack for 'consumer' role
              <ConsumerStack
                view={view === 'onboarding' ? 'onboarding' : view}
                setView={navigateTo}
                user={user}
                setUser={setUser}
                deals={deals} // This `deals` prop is mostly unused by ConsumerStack now, kept for backward compatibility/potential future use but primary deal fetching is internal.
                favoriteIds={favoriteIds}
                setFavoriteIds={setFavoriteIds as any}
                redeemedIds={redeemedIds}
                setRedeemedIds={setRedeemedIds}
                loading={loading}
                theme={theme}
                favoriteDeals={favoriteDeals} // NEW: Pass full favorite deals to ConsumerStack
                updateConsumerFavorites={updateConsumerFavorites} // NEW: Pass the update function
              />
            )}
          </main>
          {user.isLoggedIn && !['redemption_survey', 'onboarding', 'verify_phone'].includes(view) && (
            user.role === 'merchant' ? <MerchantBottomNav currentView={view} setView={navigateTo} theme={theme} /> : 
            user.role === 'dealadmin' ? <DealAdminBottomNav currentView={view} setView={navigateTo} theme={theme} /> : // NEW: Admin Bottom Nav
            <BottomNav currentView={view} setView={navigateTo} theme={theme} user={user} />
          )}

          <QRscan
            isOpen={isScanning}
            onClose={() => setIsScanning(false)}
            user={user}
            theme={theme}
          />

          {/* OTP Modal is rendered globally */}
          <OtpVerificationModal
            isOpen={showOtpModal}
            onClose={() => {
              setShowOtpModal(false);
              // When the modal closes, reset the phone number and verification status
              setOtpPhoneNumber('');
              setIsPhoneVerifiedForRegistration(false);
              // If we were trying to register, and the OTP verification failed or was cancelled,
              // we should keep the user on the registration page to retry.
              // If verification succeeded, onVerificationSuccess will handle navigation.
            }}
            phoneNumber={otpPhoneNumber}
            onVerificationSuccess={() => {
              setIsPhoneVerifiedForRegistration(true);
              setShowOtpModal(false);
              // After successful verification, let memberJoin proceed with registration
              // No direct navigation here, MemberJoin will handle the next step.
            }}
            onVerificationError={() => {
              // On error, the modal will handle displaying the error.
              // We reset the verification status so MemberJoin doesn't proceed.
              setIsPhoneVerifiedForRegistration(false);
            }}
          />
        </>
      )}
      <style>{`@keyframes loading { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;