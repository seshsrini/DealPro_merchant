
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Deal, AppView, User, CampaignInteraction } from './types';
import { userService } from './services/userService';
import { redeemNowservice } from './services/redeemNowservice';
import { dealDetailsService } from './services/dealdetailsService';
import { getCampaignsConsumer } from './services/getCampaignsConsumer';
import { redemptionHistoryService } from './services/redemptionHistoryService';
import { LocationSearch } from './LocationSearch';
import { DealsMainPage } from './DealsMainPage';
import { DealOfTheDayPage } from './DealOfTheDayPage'; // NEW: Import Deal of the Day component
import { CampaignDetails } from './CampaignDetails.tsx';
import { DealOfTheDayDetails } from './DealOfTheDayDetails.tsx';
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
import { HelpFeedback } from './HelpFeedback'; // Import HelpFeedback
import { NotificationsView } from './NotificationsView'; // Import NotificationsView

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
  pinnedDeals: any[]; // NEW: Pinned deals from parent
  updateConsumerPinnedDeals: (userId: string) => Promise<void>; // NEW: Function to update pinned deals
  onLocationComplete?: (isComplete: boolean) => void; // NEW: Callback to notify when location is set
  onUnreadCountChange?: (count: number) => void; // For resetting badge after viewing notifications
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
  favoriteDeals, updateConsumerFavorites, pinnedDeals, updateConsumerPinnedDeals, onLocationComplete, onUnreadCountChange
}) => {
  const [consumerDeals, setConsumerDeals] = useState<Deal[]>([]);
  const [dealOfDayDeals, setDealOfDayDeals] = useState<Deal[]>([]); // NEW: Separate state for Deal of the Day
  const [isDealsLoading, setIsDealsLoading] = useState(false);
  const [isDealOfDayLoading, setIsDealOfDayLoading] = useState(false); // NEW: Separate loading for Deal of the Day
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null); // Initial value set to null directly
  const [isDealOfTheDayDetail, setIsDealOfTheDayDetail] = useState(false); // Track if viewing Deal of the Day details
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
  const [hasLoadedCachedLocation, setHasLoadedCachedLocation] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [hasCheckedVideoStatus, setHasCheckedVideoStatus] = useState(false);

  // Load cached location preferences on mount
  useEffect(() => {
    if (hasLoadedCachedLocation) return;

    try {
      const cached = localStorage.getItem(`location_prefs_${user.id}`);
      if (cached) {
        const prefs = JSON.parse(cached);
        console.log('[ConsumerStack] Loading cached location preferences:', prefs);

        setIsAutoDetect(prefs.isAutoDetect);
        setSearchRadius(prefs.searchRadius);
        setUserCoords(prefs.userCoords);
        setLocationLabel(prefs.locationLabel);
        setCityFilter(prefs.cityFilter || null);
        setCityForFilterButton(prefs.cityForFilterButton || null);
      }
      setHasLoadedCachedLocation(true);
    } catch (e) {
      console.error('[ConsumerStack] Failed to load cached location:', e);
      setHasLoadedCachedLocation(true);
    }
  }, [user.id, hasLoadedCachedLocation]);

  // Auto-redirect to home if navigating to preferences but cached location already exists
  useEffect(() => {
    if (view === 'preferences' && hasLoadedCachedLocation && userCoords) {
      console.log('[ConsumerStack] Cached location found, redirecting to home instead of showing location search');
      setView('home');
    }
  }, [view, hasLoadedCachedLocation, userCoords, setView]);

  // REMOVED: Automatic redirect to home when location is detected
  // User should manually click "Scan Deals" button to proceed
  // This prevents the page from auto-submitting when GPS location is acquired

  // Save location preferences to cache whenever they change
  useEffect(() => {
    if (!hasLoadedCachedLocation || !userCoords) return;

    try {
      const prefs = {
        isAutoDetect,
        searchRadius,
        userCoords,
        locationLabel,
        cityFilter,
        cityForFilterButton,
        timestamp: Date.now()
      };
      localStorage.setItem(`location_prefs_${user.id}`, JSON.stringify(prefs));
      console.log('[ConsumerStack] Saved location preferences to cache');
    } catch (e) {
      console.error('[ConsumerStack] Failed to save location preferences:', e);
    }
  }, [hasLoadedCachedLocation, user.id, isAutoDetect, searchRadius, userCoords, locationLabel, cityFilter, cityForFilterButton]);

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
      updateConsumerPinnedDeals(user.id); // NEW: Also fetch pinned deals
    }
  }, [view, user.id, updateConsumerFavorites, updateConsumerPinnedDeals]);

  // Check if intro video should be shown (once per session, right after login)
  useEffect(() => {
    if (!hasCheckedVideoStatus && user.id && (view === 'onboarding' || view === 'home' || view === 'deals' || view === 'preferences')) {
      setHasCheckedVideoStatus(true);

      // Check sessionStorage to see if video was already shown in this session
      const videoShownKey = `intro_video_shown_${user.id}`;
      const videoWasShown = sessionStorage.getItem(videoShownKey);

      if (!videoWasShown) {
        console.log('[ConsumerStack] Showing intro video immediately after login');
        setShowVideoModal(true);
      }
    }
  }, [view, user.id, hasCheckedVideoStatus]);

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

    // DEBUG: Log fetched deals with is_deal_of_the_day field
    console.log(`[ConsumerStack] Fetched ${fetched.length} deals from backend`);
    fetched.forEach((deal, index) => {
      console.log(`[Deal ${index + 1}] ${deal.deal_heading}: is_deal_of_the_day=${deal.is_deal_of_the_day}, status=${deal.status}, start_date=${deal.start_date}`);
    });

    setConsumerDeals(fetched);
    setIsDealsLoading(false);

  }, [
    user.id, locationLoading, locationError, isAutoDetect, capacitorCoords, capacitorResolvedCity, userCoords,
    searchRadius, cityFilter, locationLabel, cityForFilterButton,
    selectedStoreIdForSearch, setSelectedStoreIdForSearch, selectedStoreNameForSearch, // Add new store search states to dependencies
    updateCityForFilterButtonFromCoords
  ]);

  // NEW: Separate function to fetch Deal of the Day campaigns using locality coordinates
  const fetchDealOfDayDeals = useCallback(async () => {
    if (!user.id || user.role !== 'consumer') return;
    if (locationLoading) {
      console.log("[ConsumerStack] Location still loading, deferring Deal of Day fetch.");
      return;
    }

    if (!userCoords) {
      console.log("[ConsumerStack] No coordinates available for Deal of Day fetch.");
      return;
    }

    setIsDealOfDayLoading(true);
    setDealOfDayDeals([]); // Clear previous deals

    console.log("[ConsumerStack] Fetching Deal of the Day campaigns with locality coords:", userCoords);

    try {
      const fetched = await getCampaignsConsumer.getDealsOfDay({
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        radius: searchRadius,
      });

      console.log(`[ConsumerStack] Fetched ${fetched.length} Deal of the Day campaigns`);
      fetched.forEach((deal, index) => {
        console.log(`[DOTD ${index + 1}] ${deal.deal_heading}: start_date=${deal.start_date}, status=${deal.status}`);
      });

      setDealOfDayDeals(fetched);
    } catch (error) {
      console.error("[ConsumerStack] Error fetching Deal of the Day:", error);
      setDealOfDayDeals([]);
    } finally {
      setIsDealOfDayLoading(false);
    }
  }, [user.id, user.role, locationLoading, userCoords, searchRadius]);

  // REMOVED: Auto-setting userCoords when capacitorCoords are available
  // This was causing auto-submission when GPS location was detected
  // Now, userCoords is ONLY set when user explicitly clicks "Scan Area" button
  // via the handleLocationSearch callback

  // Note: capacitorCoords are still available and passed to LocationSearch
  // for display purposes (showing coordinates and city), but they don't
  // trigger automatic submission until user confirms

  // Notify parent when location is complete (userCoords is set)
  useEffect(() => {
    if (onLocationComplete) {
      onLocationComplete(userCoords !== null);
    }
  }, [userCoords, onLocationComplete]);

  useEffect(() => {
    // Fetch appropriate deals based on current view
    if (!locationLoading) {
      if (view === 'deals_of_day') {
        // Fetch Deal of the Day campaigns using separate endpoint
        fetchDealOfDayDeals();
      } else if (view === 'home' || view === 'deals') {
        // Fetch regular campaigns (excluding Deal of the Day)
        fetchConsumerDeals();
      }
    }
  }, [fetchConsumerDeals, fetchDealOfDayDeals, view, locationLoading]); // Trigger when view or location changes

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

  const handleShowAllCityDealOfDay = useCallback(async (city: string) => {
    console.log(`[ConsumerStack] Fetching ALL Deal of the Day campaigns in city: ${city}`);
    setIsDealOfDayLoading(true);
    setLocationLabel(`All deals in ${city}`); // Update label

    try {
      const fetched = await getCampaignsConsumer.getDealsOfDay({
        cityFilter: city,
      });

      console.log(`[ConsumerStack] Fetched ${fetched.length} Deal of the Day campaigns in ${city}`);
      setDealOfDayDeals(fetched);
    } catch (error) {
      console.error("[ConsumerStack] Error fetching city-wide Deal of the Day:", error);
      setDealOfDayDeals([]);
    } finally {
      setIsDealOfDayLoading(false);
    }
  }, []);

  const handleNewLocationSearch = useCallback(() => {
    console.log('[ConsumerStack] Clearing location cache and starting new search');

    // Clear location preferences from localStorage
    try {
      localStorage.removeItem(`location_prefs_${user.id}`);
      console.log('[ConsumerStack] Location cache cleared successfully');
    } catch (e) {
      console.error('[ConsumerStack] Failed to clear location cache:', e);
    }

    // Reset all location-related state
    setIsAutoDetect(true);
    setSearchRadius(2.0);
    setUserCoords(null);
    setLocationLabel('Local Area');
    setCityFilter(null);
    setCityForFilterButton(null);
    setSelectedStoreIdForSearch(null);
    setSelectedStoreNameForSearch(null);
    setHasLoadedCachedLocation(false);

    // Navigate to location search page
    setView('preferences');
  }, [user.id, setView, setSelectedStoreIdForSearch, setSelectedStoreNameForSearch]);

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
          const response = await redeemNowservice.createClaim(user.id, deal.merchantId, deal.campaign_id, generatedClaimId, deal.is_deal_of_the_day || false);
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

  const handleCloseVideo = () => {
    setShowVideoModal(false);
    // Mark video as shown for this session
    sessionStorage.setItem(`intro_video_shown_${user.id}`, 'true');
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
      setIsDealOfTheDayDetail(false); // Regular deal
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
      setIsDealOfTheDayDetail(false); // Regular deal
      setView('detail');
    }
  }, [setView, user.id]);

  // Deep link from notification: fetch deal by campaign_id and navigate to detail
  const handleSelectDealById = useCallback(async (campaignId: string) => {
    try {
      const deal = await dealDetailsService.fetchDealDetails(campaignId);
      setSelectedDeal(deal);
      setIsDealOfTheDayDetail(false);
      setView('detail');
    } catch (error) {
      console.error('[ConsumerStack] Failed to fetch deal from notification:', error);
    }
  }, [setView]);

  const handleShowDealOfTheDayDetails = useCallback(async (deal: Deal) => {
    try {
      // Fetch fresh deal details with proper fallbacks
      console.log(`[ConsumerStack] Fetching Deal of the Day details for campaign: ${deal.campaign_id}`);
      const detailedDeal = await dealDetailsService.fetchDealDetails(deal.campaign_id);

      console.log(`[ConsumerStack] Fetched Deal of the Day details:`, {
        address: detailedDeal.address,
        landmark: detailedDeal.landmark,
        storeHrs: detailedDeal.storeHrs
      });

      setSelectedDeal(detailedDeal);
      setIsDealOfTheDayDetail(true); // Deal of the Day
      setView('detail'); // Navigate to detail view

      userService.logActivity({
        user_id: user.id,
        event_type: 'view',
        merchant_id: deal.merchantId,
        campaign_id: deal.campaign_id,
        platform: 'mobile',
        metadata: { view_type: 'deal_of_day_detail', deal_heading: deal.deal_heading }
      });
    } catch (error) {
      console.error('[ConsumerStack] Failed to fetch Deal of the Day details:', error);
      // Fallback to using the existing deal object if fetch fails
      setSelectedDeal(deal);
      setIsDealOfTheDayDetail(true); // Deal of the Day
      setView('detail');
    }
  }, [setView, user.id]);

  // Select appropriate deals based on view
  // - Deal of the Day view: Use dealOfDayDeals (fetched from dedicated endpoint)
  // - Regular views: Use consumerDeals (fetched from get-all endpoint, excludes Deal of the Day)
  // IMPORTANT: This useMemo must be before any conditional returns to follow React's Rules of Hooks
  const displayDeals = useMemo(() => {
    if (view === 'deals_of_day') {
      console.log(`[ConsumerStack] Using dealOfDayDeals: ${dealOfDayDeals.length} campaigns`);
      return dealOfDayDeals;
    } else {
      console.log(`[ConsumerStack] Using consumerDeals: ${consumerDeals.length} campaigns`);
      return consumerDeals;
    }
  }, [consumerDeals, dealOfDayDeals, view]);

  if (view === 'notifications') {
    return (
      <NotificationsView
        userId={user.id}
        theme={theme}
        setView={setView}
        onSelectDeal={handleSelectDealById}
        onUnreadCountChange={onUnreadCountChange || (() => {})}
      />
    );
  }

  if (view === 'onboarding') {
    return (
      <>
        <Onboarding setView={setView} user={user} setUser={setUser} />

        {/* Intro Video Modal */}
        {showVideoModal && (
          <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center">
            <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
              {/* Close Button */}
              <button
                onClick={handleCloseVideo}
                className="absolute top-6 right-6 z-[1000] w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Video Player */}
              <div className="flex-1 flex items-center justify-center p-4">
                <video
                  autoPlay
                  controls
                  className="w-full h-auto max-h-[80vh] rounded-2xl shadow-2xl"
                  onEnded={handleCloseVideo}
                >
                  <source src="/assets/Free_South_Indian_Cartoon_App_Video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Skip Button */}
              <div className="p-6">
                <button
                  onClick={handleCloseVideo}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
                >
                  Skip Video
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (view === 'preferences') {
    return (
      <>
        <LocationSearch
          theme={theme}
          userCoords={capacitorCoords}
          resolvedAddress={capacitorResolvedCity || "Detecting location..."}
          isAutoDetect={isAutoDetect}
          setIsAutoDetect={setIsAutoDetect}
          onSearch={handleLocationSearch}
          onRefreshLocation={refreshCapacitorLocation}
        />

        {/* Intro Video Modal */}
        {showVideoModal && (
          <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center">
            <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
              {/* Close Button */}
              <button
                onClick={handleCloseVideo}
                className="absolute top-6 right-6 z-[1000] w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Video Player */}
              <div className="flex-1 flex items-center justify-center p-4">
                <video
                  autoPlay
                  controls
                  className="w-full h-auto max-h-[80vh] rounded-2xl shadow-2xl"
                  onEnded={handleCloseVideo}
                >
                  <source src="/assets/Free_South_Indian_Cartoon_App_Video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Skip Button */}
              <div className="p-6">
                <button
                  onClick={handleCloseVideo}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
                >
                  Skip Video
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (view === 'edit_profile') return <EditProfile user={user} setUser={setUser} setView={setView} />;
  if (view === 'my_redemptions') return <MyRedemptions user={user} setView={setView} theme={theme} />;
  if (view === 'campaign_survey') return <CampaignSurvey setView={setView} user={user} />;
  if (view === 'redemption_survey') return <RedemptionSurvey setView={setView} user={user} />;
  if (view === 'help_feedback') return <HelpFeedback user={user} setView={setView} theme={theme} />;

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

  // New: If the view is 'detail' and a deal is selected, render appropriate details page
  if (view === 'detail' && selectedDeal) {
    // Use premium Deal of the Day details page for Deal of the Day campaigns
    if (isDealOfTheDayDetail) {
      return (
        <DealOfTheDayDetails
          deal={selectedDeal}
          user={user}
          onRedeem={handleRedeemNow}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={favoriteIds.has(selectedDeal.campaign_id)}
          isRedeemed={redeemedIds.has(selectedDeal.campaign_id)}
          isClaimed={claimedIds.has(String(selectedDeal.campaign_id))}
          isRedeeming={isRedeeming}
          activeClaimId={activeClaimId}
          onCloseClaim={handleCloseClaim}
          theme={theme}
        />
      );
    }

    // Use regular campaign details for standard deals
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
        user={user}
        pinnedDeals={pinnedDeals}
        updatePinnedDeals={() => updateConsumerPinnedDeals(user.id)}
      />
    );
  }

  // NEW: Render Deal of the Day page with dedicated component
  if (view === 'deals_of_day') {
    return (
      <>
        <DealOfTheDayPage
          deals={displayDeals} // Uses dealOfDayDeals from dedicated endpoint
          loading={isDealOfDayLoading || locationLoading} // Use Deal of Day specific loading state
          onSelectDeal={handleShowDealOfTheDayDetails} // Use premium Deal of the Day details page
          onAdjustLocation={() => setView('preferences')}
          onViewAllDeals={cityForFilterButton ? () => handleShowAllCityDealOfDay(cityForFilterButton) : undefined} // NEW: View all Deal of Day in city
          locationLabel={locationLabel}
          cityName={cityForFilterButton || undefined} // NEW: Pass city name for display
          theme={theme}
        />

        {/* Intro Video Modal */}
        {showVideoModal && (
          <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center">
            <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
              {/* Close Button */}
              <button
                onClick={handleCloseVideo}
                className="absolute top-6 right-6 z-[1000] w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Video Player */}
              <div className="flex-1 flex items-center justify-center p-4">
                <video
                  autoPlay
                  controls
                  className="w-full h-auto max-h-[80vh] rounded-2xl shadow-2xl"
                  onEnded={handleCloseVideo}
                >
                  <source src="/assets/Free_South_Indian_Cartoon_App_Video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Skip Button */}
              <div className="p-6">
                <button
                  onClick={handleCloseVideo}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
                >
                  Skip Video
                </button>
              </div>
            </div>
          </div>
        )}

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
  }

  // Render regular deals page (DealsMainPage)
  return (
    <>
      <DealsMainPage
        view={view === 'onboarding' ? 'onboarding' : view}
        deals={displayDeals} // Pass filtered deals based on view (excludes Deal of the Day)
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
        onNewLocationSearch={handleNewLocationSearch} // NEW: Pass handler for clearing location cache
      />

      {/* Intro Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[999] bg-black flex items-center justify-center">
          <div className="relative w-full h-full max-w-md mx-auto flex flex-col">
            {/* Close Button */}
            <button
              onClick={handleCloseVideo}
              className="absolute top-6 right-6 z-[1000] w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-90 transition-transform"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video Player */}
            <div className="flex-1 flex items-center justify-center p-4">
              <video
                autoPlay
                controls
                className="w-full h-auto max-h-[80vh] rounded-2xl shadow-2xl"
                onEnded={handleCloseVideo}
              >
                <source src="/assets/Free_South_Indian_Cartoon_App_Video.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Skip Button */}
            <div className="p-6">
              <button
                onClick={handleCloseVideo}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-black font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-transform"
              >
                Skip Video
              </button>
            </div>
          </div>
        </div>
      )}

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