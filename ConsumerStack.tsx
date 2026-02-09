
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Deal, AppView, User, CampaignInteraction } from './types';
import { userService } from './services/userService';
import { redeemNowservice } from './services/redeemNowservice';
import { dealDetailsService } from './services/dealdetailsService';
import { getCampaignsConsumer } from './services/getCampaignsConsumer';
import { redemptionHistoryService } from './services/redemptionHistoryService';
import { LocationSearch } from './LocationSearch';
import { DealsMainPage } from './DealsMainPage';
import { CampaignDetails } from './CampaignDetails.tsx';
import { MyRedemptions } from './myredemption';
import { EditProfile } from './EditProfile';
import { CampaignSurvey } from './CampaignSurvey';
import { Onboarding } from './Onboarding';
import { useCapacitorLocation } from './hooks/useCapacitorLocation';
import { FavoritesView } from './FavoritesView';
import { Loader2 } from 'lucide-react'; // Import Loader2
import { RedemptionSurvey } from './RedemptionSurvey';
import { locationsearchService } from './services/locationsearchService'; // Import for reverse geocoding
import { StoreSearchScreen } from './StoreSearchScreen'; // NEW: Import StoreSearchScreen
import { RatingPopup } from './RatingPopup'; // Import RatingPopup

const calculateDistance = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null) => {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface ConsumerStackProps {
  view: AppView;
  setView: (view: AppView) => void;
  user: User; 
  setUser: (user: User) => void; 
  deals: Deal[]; // This `deals` prop is largely unused by ConsumerStack now, as deal fetching is handled internally.
  favoriteIds: Map<string, string>;
  setFavoriteIds: React.Dispatch<React.SetStateAction<Map<string, string>>>;
  redeemedIds: Set<string>;
  setRedeemedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  loading: boolean; 
  theme: 'light' | 'dark';
  favoriteDeals: Deal[]; 
  updateConsumerFavorites: (userId: string) => Promise<void>; 
}

const generateCustomClaimId = (): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';

  // Use crypto.getRandomValues for better randomness if available
  const getRandomFromSet = (charset: string) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return charset.charAt(array[0] % charset.length);
    }
    return charset.charAt(Math.floor(Math.random() * charset.length));
  };

  // Format: 1 letter + 6 digits (e.g., A123456)
  // This matches the validation in QRscan.tsx (max length 7: 1 alphabet + 6 digits)
  let result = getRandomFromSet(letters); // First character: A-Z
  for (let i = 0; i < 6; i++) { // Next 6 characters: 0-9
    result += getRandomFromSet(digits);
  }

  return result;
};

export const ConsumerStack: React.FC<ConsumerStackProps> = ({ 
  view, setView, user, setUser, deals, favoriteIds, setFavoriteIds, redeemedIds, setRedeemedIds, loading, theme,
  favoriteDeals, updateConsumerFavorites 
}) => {
  const [consumerDeals, setConsumerDeals] = useState<Deal[]>([]);
  const [isDealsLoading, setIsDealsLoading] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null); // Initial value set to null directly
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [activeClaimIdFromInteraction, setActiveClaimIdFromInteraction] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState<number>(2.0); 
  const [locationLabel, setLocationLabel] = useState('Local Area');
  const [isAutoDetect, setIsAutoDetect] = useState(true);
  const [cityFilter, setCityFilter] = useState<string | null>(null); // This drives the backend API call
  // NEW: This state holds the city name specifically for the "Show all deals in [CITY]" button
  const [cityForFilterButton, setCityForFilterButton] = useState<string | null>(null);

  // NEW: State for store search
  const [selectedStoreIdForSearch, setSelectedStoreIdForSearch] = useState<string | null>(null);
  const [selectedStoreNameForSearch, setSelectedStoreNameForSearch] = useState<string | null>(null);


  const { coords: capacitorCoords, loading: locationLoading, refresh: refreshCapacitorLocation, error: locationError, resolvedCity: capacitorResolvedCity } = useCapacitorLocation(isAutoDetect);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [fullHistory, setFullHistory] = useState<CampaignInteraction[]>(new Array<CampaignInteraction>()); // Fix: Corrected initialization of fullHistory
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [hasCheckedRatings, setHasCheckedRatings] = useState(false);

  const syncHistory = useCallback(async () => {
    if (!user.id || user.role !== 'consumer') return;
    try {
      const history = await redemptionHistoryService.getRedemptionHistory(user.id);
      setFullHistory(history || []);
      const newRedeemed = new Set<string>();
      const newClaimed = new Set<string>();
      history.forEach(item => {
        if (item.is_redeemed === true) {
          // FIX: Corrected variable name from trulyRedeemedCampaignIds to newRedeemed
          newRedeemed.add(String(item.campaign_id));
        }
        if (item.claim_no) {
          newClaimed.add(String(item.campaign_id));
        }
      });
      setRedeemedIds(newRedeemed);
      setClaimedIds(newClaimed);
    } catch (e) { console.error("Sync history failed", e); }
  }, [user.id, setRedeemedIds]);

  useEffect(() => { syncHistory(); }, [syncHistory]);

  useEffect(() => {
    if (view === 'favorites' && user.id) {
      updateConsumerFavorites(user.id);
    }
  }, [view, user.id, updateConsumerFavorites]);

  // Show rating popup right after onboarding (on preferences view or home)
  useEffect(() => {
    console.log('[ConsumerStack] Rating popup check:', {
      view,
      userId: user.id,
      hasCheckedRatings,
      isDealsLoading,
      onboardingComplete: user.onboarding_complete
    });

    // Show popup right after onboarding completes (on preferences view or home/deals views)
    // This triggers when user completes onboarding and lands on location search
    if ((view === 'preferences' || view === 'home' || view === 'deals' || view === 'deals_of_day') &&
        user.id &&
        user.onboarding_complete &&
        !hasCheckedRatings) {

      console.log('[ConsumerStack] Triggering rating popup check');
      setHasCheckedRatings(true);

      // Very small delay to let the page transition complete
      const timer = setTimeout(() => {
        console.log('[ConsumerStack] Showing rating popup');
        setShowRatingPopup(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, user.id, user.onboarding_complete]); // Removed hasCheckedRatings from deps to prevent timeout clearing

  // Helper to update cityForFilterButton from coordinates
  const updateCityForFilterButtonFromCoords = useCallback(async (lat: number, lng: number) => {
    try {
      const geoResult = await locationsearchService.reverseGeocodeCoordinates(lat, lng);
      setCityForFilterButton(geoResult?.city || null);
    } catch (e) {
      console.warn("[ConsumerStack] Failed to reverse geocode for button display:", e);
      setCityForFilterButton(null); // Clear on error
    }
  }, []);


  const fetchConsumerDeals = useCallback(async () => {
    if (!user.id || user.role !== 'consumer') return;
    if (locationLoading) {
      console.log("[ConsumerStack] Location still loading, deferring deal fetch.");
      return; 
    }

    setIsDealsLoading(true);
    setConsumerDeals([]); // Clear previous deals immediately

    let currentLat = userCoords?.latitude;
    let currentLng = userCoords?.longitude;
    let effectiveCityFilter: string | null = cityFilter; // Start with existing cityFilter state for backend
    let newLocationLabel = locationLabel;
    let newCityForFilterButton: string | null = cityForFilterButton; // Start with existing button city

    const DEFAULT_FALLBACK_CITY = "Bangalore"; 
    
    let fetched: Deal[] = [];

    // NEW LOGIC: Prioritize store-specific search
    if (selectedStoreIdForSearch) {
      console.log(`[ConsumerStack] Fetching deals for specific store ID: ${selectedStoreIdForSearch}`);
      newLocationLabel = selectedStoreNameForSearch || 'Selected Store';
      newCityForFilterButton = null; // Store search doesn't involve city filter button
      try {
        fetched = await getCampaignsConsumer.getDealsByStoreId(selectedStoreIdForSearch);
      } catch (err) {
        console.error("[ConsumerStack] Error fetching store-specific deals:", err);
        // Potentially show an error message to the user
      }
    } else if (isAutoDetect) {
      // Clear store search states if a non-store-specific search is initiated
      setSelectedStoreIdForSearch(null); 
      setSelectedStoreNameForSearch(null);

      if (capacitorCoords) {
        currentLat = capacitorCoords.latitude;
        currentLng = capacitorCoords.longitude; 
        newLocationLabel = "GPS Location"; 
        effectiveCityFilter = null; // Clear city filter for radius search
        // Use resolvedCity from hook for button display
        newCityForFilterButton = capacitorResolvedCity || DEFAULT_FALLBACK_CITY;

        console.log("[ConsumerStack] Fetching deals with auto-detected GPS:", currentLat, currentLng);
        try {
          fetched = await getCampaignsConsumer.getDeals({
            latitude: currentLat,
            longitude: currentLng,
            radius: searchRadius,
          });
        } catch (err) {
          console.error("[ConsumerStack] Error fetching general deals by GPS:", err);
        }
      } else if (locationError) {
        console.warn(`[ConsumerStack] Auto-detect failed due to error: ${locationError}. Falling back to default city search: ${DEFAULT_FALLBACK_CITY}`);
        currentLat = null;
        currentLng = null;
        effectiveCityFilter = DEFAULT_FALLBACK_CITY; 
        newLocationLabel = `Default to ${DEFAULT_FALLBACK_CITY}`;
        newCityForFilterButton = DEFAULT_FALLBACK_CITY;
        try {
          fetched = await getCampaignsConsumer.getDeals({
            cityFilter: effectiveCityFilter,
          });
        } catch (err) {
          console.error("[ConsumerStack] Error fetching general deals by default city:", err);
        }
      } else {
         console.log("[ConsumerStack] Auto-detect active but no coords/error yet. Waiting for location.");
         setIsDealsLoading(false); // Keep loading if waiting for GPS
         return; 
      }
    } else { // Manual selection is active
      // Clear store search states if a non-store-specific search is initiated
      setSelectedStoreIdForSearch(null); 
      setSelectedStoreNameForSearch(null);

      if (userCoords) { // userCoords is set when manualCoords is set from LocationSearch
        currentLat = userCoords.latitude;
        currentLng = userCoords.longitude;
        newLocationLabel = locationLabel; // Keep the label set by LocationSearch
        effectiveCityFilter = cityFilter; // Keep city filter from LocationSearch

        // If a manual radius search (no explicit effectiveCityFilter), get city for button from coords
        if (!effectiveCityFilter && currentLat && currentLng) {
          // Only update if coords or existing button city changed
          if (!cityForFilterButton || (currentLat !== userCoords?.latitude || currentLng !== userCoords?.longitude)) {
            newCityForFilterButton = (await locationsearchService.reverseGeocodeCoordinates(currentLat, currentLng))?.city || 'Manual Location';
          }
        } else { // It's a city-filtered manual search (effectiveCityFilter is present)
          newCityForFilterButton = effectiveCityFilter;
        }
        console.log("[ConsumerStack] Fetching deals with manual coordinates/city filter:", newLocationLabel);
        try {
          fetched = await getCampaignsConsumer.getDeals({
            latitude: currentLat,
            longitude: currentLng,
            radius: (!effectiveCityFilter) ? searchRadius : undefined, // Only pass radius if no city filter
            cityFilter: effectiveCityFilter,
          });
        } catch (err) {
          console.error("[ConsumerStack] Error fetching general deals by manual location:", err);
        }
      } else {
        console.warn("[ConsumerStack] Manual selection active, but no coordinates resolved. Falling back to default city.");
        currentLat = null;
        currentLng = null;
        effectiveCityFilter = DEFAULT_FALLBACK_CITY; 
        newLocationLabel = `Default to ${DEFAULT_FALLBACK_CITY}`;
        newCityForFilterButton = DEFAULT_FALLBACK_CITY;
        try {
          fetched = await getCampaignsConsumer.getDeals({
            cityFilter: effectiveCityFilter,
          });
        } catch (err) {
          console.error("[ConsumerStack] Error fetching general deals by default city fallback (manual mode):", err);
        }
      }
    }
    
    setLocationLabel(newLocationLabel); 
    setCityFilter(effectiveCityFilter); // Update the cityFilter state which is used for backend calls
    setCityForFilterButton(newCityForFilterButton); // Set the display city for the button
    // Removed unconditional clearing of selectedStoreIdForSearch and selectedStoreNameForSearch
    // They are now explicitly cleared when a non-store-specific search path is taken above.
    setConsumerDeals(fetched);
    setIsDealsLoading(false);

  }, [
    user.id, locationLoading, locationError, isAutoDetect, capacitorCoords, capacitorResolvedCity, userCoords, 
    searchRadius, cityFilter, locationLabel, cityForFilterButton,
    selectedStoreIdForSearch, setSelectedStoreIdForSearch, selectedStoreNameForSearch, // Add new store search states to dependencies
    updateCityForFilterButtonFromCoords
  ]);

  useEffect(() => {
    if (isAutoDetect) {
      setUserCoords(capacitorCoords);
    } else {
      // Manual coords are set via the onSearch handler from LocationSearch
      // For now, let's keep userCoords in sync with whatever is active.
      // The onSearch callback handles setting userCoords based on manual selection.
    }
  }, [isAutoDetect, capacitorCoords]);


  useEffect(() => {
    // Only trigger fetch if location has finished loading or an error occurred.
    // And if it's the home view.
    if ((view === 'home' || view === 'deals' || view === 'deals_of_day') && !locationLoading) {
        fetchConsumerDeals();
    }
  }, [fetchConsumerDeals, view, locationLoading]); // Trigger on fetchConsumerDeals change or when location loading is complete

  const handleLocationSearch = useCallback(async (searchData: {
    isAutoDetect: boolean; 
    radius: number; 
    coords: { latitude: number; longitude: number } | null;
    label: string;
    cityFilter?: string; // Add cityFilter to searchData
  }) => {
    setIsAutoDetect(searchData.isAutoDetect);
    setSearchRadius(searchData.radius);
    setUserCoords(searchData.coords); // Update userCoords which will trigger deal fetch
    setLocationLabel(searchData.label);
    setCityFilter(searchData.cityFilter || null); // Update cityFilter for backend call
    setSelectedStoreIdForSearch(null); // Clear store search on location change
    setSelectedStoreNameForSearch(null);

    // Update cityForFilterButton explicitly
    if (searchData.cityFilter) {
      setCityForFilterButton(searchData.cityFilter);
    } else if (searchData.coords) {
      // If a coordinate-based search, do a reverse geocode for the display city
      await updateCityForFilterButtonFromCoords(searchData.coords.latitude, searchData.coords.longitude);
    } else {
      setCityForFilterButton(null); // Clear if no specific city or coords
    }
    
    setView('home'); // Go back to home view after setting location
    console.log("[ConsumerStack] Location search updated:", searchData);
  }, [setView, updateCityForFilterButtonFromCoords, setSelectedStoreIdForSearch, setSelectedStoreNameForSearch]);

  const handleShowCityDeals = useCallback((city: string) => {
    setIsAutoDetect(false); // Force manual mode for city filter
    setUserCoords(null); // Clear coords to ensure city-only search
    setSearchRadius(0); // Clear radius as we are filtering by city
    setCityFilter(city); // Set the specific city filter (for backend)
    setLocationLabel(city); // Update label to reflect city
    setCityForFilterButton(city); // Set the city for the button display
    setSelectedStoreIdForSearch(null); // Clear store search on city change
    setSelectedStoreNameForSearch(null);
    setView('home'); // Navigate to home to show deals
    console.log(`[ConsumerStack] Filtering deals for city: ${city}`);
  }, [setView, setSelectedStoreIdForSearch, setSelectedStoreNameForSearch]);


  const handleRedeemNow = useCallback(async (deal: Deal) => {
    if (!user.id) {
      alert("Please log in to redeem deals.");
      return;
    }
    // Fix: Use campaign_id instead of id
    if (claimedIds.has(String(deal.campaign_id))) {
      // If already claimed, don't re-initiate redemption logic.
      // The CampaignDetails component will show the "Already Claimed" popup if needed.
      console.log(`Deal ${deal.campaign_id} already claimed by user ${user.id}.`);
      setSelectedDeal(deal); // Still set selected deal to open details
      return;
    }

    setIsRedeeming(true);
    let generatedClaimId: string | null = null;

    // Retry logic for duplicate claim_no
    const MAX_RETRIES = 3;
    let attempt = 0;
    let success = false;

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      while (attempt < MAX_RETRIES && !success) {
        attempt++;
        generatedClaimId = generateCustomClaimId(); // Generate client-side claim ID

        try {
          // Fix: Use campaign_id instead of id
          const response = await redeemNowservice.createClaim(user.id, deal.merchantId, deal.campaign_id, generatedClaimId);
          generatedClaimId = response.claimNo; // Use backend-confirmed claimNo if available
          success = true; // Mark as successful if no error thrown
        } catch (claimErr: any) {
          // Check if error is due to duplicate claim_no
          const isDuplicateClaim = claimErr.message?.includes('CLAIM_NO_DUPLICATE') ||
                                   claimErr.message?.includes('claim number is already in use') ||
                                   claimErr.message?.includes('duplicate key');

          if (isDuplicateClaim && attempt < MAX_RETRIES) {
            console.warn(`Claim number collision detected (attempt ${attempt}/${MAX_RETRIES}). Retrying with new claim number...`);
            // Wait a tiny bit before retry to reduce race conditions
            await new Promise(resolve => setTimeout(resolve, 100));
            continue; // Retry with new claim number
          }

          // If not a duplicate error or max retries reached, rethrow
          throw claimErr;
        }
      }

      if (!success) {
        throw new Error('Failed to generate unique claim number after multiple attempts. Please try again.');
      }

      await userService.logActivity({
        user_id: user.id,
        event_type: 'redeem',
        merchant_id: deal.merchantId,
        campaign_id: deal.campaign_id, // Fix: Use campaign_id
        platform: 'mobile',
        // Fix: Use offerValue property directly, not offer_value
        metadata: { claim_no: generatedClaimId, deal_heading: deal.deal_heading, offer_value: deal.offerValue } // Fix: Use deal_heading and offerValue
      });

      // Update claimedIds and then setSelectedDeal to show the QR code
      // Fix: Use campaign_id instead of id
      setClaimedIds(prev => new Set(prev).add(String(deal.campaign_id)));
      setActiveClaimId(generatedClaimId); // Set active claim ID for display
      setSelectedDeal(deal); // Show QR with this deal
    } catch (err: any) {
      console.error("Redemption failed:", err);
      alert(err.message || "Redemption Protocol Offline.");
      setActiveClaimId(null); // Clear active claim ID on error
    } finally {
      setIsRedeeming(false);
    }
  }, [user.id, claimedIds]);

  const handleToggleFavorite = useCallback(async (deal: Deal) => {
    if (!user.id) {
      alert("Please log in to save deals to favorites.");
      return;
    }

    // Immediately update UI for responsiveness
    // Fix: Use campaign_id instead of id
    const isCurrentlyFav = favoriteIds.has(deal.campaign_id);
    setFavoriteIds(prev => {
      const newMap = new Map(prev);
      if (isCurrentlyFav) {
        newMap.delete(deal.campaign_id);
      } else {
        newMap.set(deal.campaign_id, deal.status || 'active'); // Use campaign status
      }
      return newMap;
    });

    try {
      // Fix: Use campaign_id instead of id
      await dealDetailsService.toggleFavorite(user.id, deal.campaign_id, deal.merchantId);
      updateConsumerFavorites(user.id); // Re-sync actual favorites from backend
      await userService.logActivity({
        user_id: user.id,
        event_type: isCurrentlyFav ? 'click' : 'click', // Log as click, metadata indicates favorite
        platform: 'mobile',
        metadata: { action: isCurrentlyFav ? 'unfavorite_deal' : 'favorite_deal', campaign_id: deal.campaign_id } // Fix: Use campaign_id
      });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      alert("Failed to update favorites. Please try again.");
      // Revert UI if API call fails
      setFavoriteIds(prev => {
        const newMap = new Map(prev);
        if (isCurrentlyFav) {
          newMap.set(deal.campaign_id, deal.status || 'active');
        } else {
          newMap.delete(deal.campaign_id);
        }
        return newMap;
      });
    }
  }, [user.id, favoriteIds, updateConsumerFavorites]);

  const handleCloseClaim = () => {
    setActiveClaimId(null);
    setSelectedDeal(null);
    // After closing claim, go to redemptions to show it
    setView('my_redemptions'); 
  };

  const handleShowDealDetails = useCallback(async (deal: Deal) => {
    try {
      // Fetch fresh deal details with proper fallbacks
      console.log(`[ConsumerStack] Fetching details for campaign: ${deal.campaign_id}`);
      const detailedDeal = await dealDetailsService.fetchDealDetails(deal.campaign_id);

      console.log(`[ConsumerStack] Fetched deal details:`, {
        address: detailedDeal.address,
        landmark: detailedDeal.landmark,
        storeHrs: detailedDeal.storeHrs
      });

      setSelectedDeal(detailedDeal);
      setView('detail'); // Navigate to detail view

      userService.logActivity({
        user_id: user.id,
        event_type: 'view',
        merchant_id: deal.merchantId,
        campaign_id: deal.campaign_id,
        platform: 'mobile',
        metadata: { view_type: 'deal_detail', deal_heading: deal.deal_heading }
      });
    } catch (error) {
      console.error('[ConsumerStack] Failed to fetch deal details:', error);
      // Fallback to using the existing deal object if fetch fails
      setSelectedDeal(deal);
      setView('detail');
    }
  }, [setView, user.id]);

  if (view === 'onboarding') return <Onboarding setView={setView} user={user} setUser={setUser} />;
  if (view === 'preferences') return <LocationSearch theme={theme} userCoords={userCoords} resolvedAddress={"Current Location"} isAutoDetect={isAutoDetect} setIsAutoDetect={setIsAutoDetect} onSearch={handleLocationSearch} onRefreshLocation={refreshCapacitorLocation} />;
  if (view === 'edit_profile') return <EditProfile user={user} setUser={setUser} setView={setView} />;
  if (view === 'my_redemptions') return <MyRedemptions user={user} setView={setView} theme={theme} />;
  if (view === 'campaign_survey') return <CampaignSurvey setView={setView} user={user} />;
  if (view === 'redemption_survey') return <RedemptionSurvey setView={setView} user={user} />;
  
  // NEW: Render StoreSearchScreen
  if (view === 'store_search') {
    return (
      <StoreSearchScreen
        theme={theme}
        setView={setView}
        setSelectedStoreIdForSearch={setSelectedStoreIdForSearch}
        setSelectedStoreNameForSearch={setSelectedStoreNameForSearch}
      />
    );
  }

  // New: If the view is 'detail' and a deal is selected, render CampaignDetails
  if (view === 'detail' && selectedDeal) {
    return (
      <CampaignDetails 
        deal={selectedDeal} 
        user={user} 
        theme={theme} 
        isFav={favoriteIds.has(selectedDeal.campaign_id)} // Fix: Use campaign_id
        isRedeeming={isRedeeming}
        activeClaimId={activeClaimId}
        onRedeem={handleRedeemNow}
        onToggleFavorite={handleToggleFavorite}
        onCloseClaim={handleCloseClaim}
        redeemedIds={redeemedIds}
        claimedIds={claimedIds}
      />
    );
  }

  // New: Render FavoritesView
  if (view === 'favorites') {
    return (
      <FavoritesView
        deals={favoriteDeals}
        loading={loading}
        onSelectDeal={handleShowDealDetails}
        onToggleFavorite={handleToggleFavorite}
        theme={theme}
      />
    );
  }

  return (
    <>
      <DealsMainPage
        view={view === 'onboarding' ? 'onboarding' : view}
        deals={consumerDeals} // Pass consumerDeals to DealsMainPage
        loading={isDealsLoading || locationLoading} // Combine loading states
        userCoords={userCoords}
        searchRadius={searchRadius}
        locationLabel={locationLabel}
        onSelectDeal={handleShowDealDetails}
        onAdjustLocation={() => setView('preferences')}
        user={user}
        setUser={setUser}
        setView={setView}
        onVerificationHubClick={() => setView('my_redemptions')}
        onShowCityDeals={handleShowCityDeals} // Pass the new handler
        isCityFilterActive={!!cityFilter} // Inform DealsMainPage if a city filter is active
        cityForFilterButton={cityForFilterButton} // NEW: Pass the determined city name for the button
        selectedStoreNameForSearch={selectedStoreNameForSearch} // NEW: Pass selected store name
        theme={theme}
      />

      {/* Rating Popup for redeemed but unrated claims */}
      {showRatingPopup && (
        <RatingPopup
          userId={user.id}
          onClose={() => setShowRatingPopup(false)}
          theme={theme}
        />
      )}
    </>
  );
};