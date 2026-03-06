import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { AppView, DBLocality, DBCity, DBState, StoreLocation } from './types';
import { userService } from './services/userService'; // For user registration
import { MreferralService } from './services/MreferralService'; // For referral tracking
import { addCampaignService } from './services/addCampaignService'; // For store categories
import { locationsearchService, PincodeLookupResponse } from './services/locationsearchService'; // New import for location lookups and geocoding, Fix: Imported PincodeLookupResponse
import { encryptionService, auditLogger } from './services/encryptionService'; // For encrypting sensitive data (GST, PAN)
import { INDIAN_STATES_CITIES } from './constants';
import { Geolocation } from '@capacitor/geolocation';
import { useTranslation } from './contexts/LanguageContext';
import { 
  Loader2, 
  Check, 
  Trash2, 
  Plus, 
  ChevronDown,
  Lock,
  MapPin,
  CheckCircle2,
  Phone,
  MessageSquare,
  X,
  Smartphone,
  User as UserIcon,
  Info,
  ShieldAlert,
  Clock,
  Navigation,
  Hash, 
  Store, 
  Mail, 
  Activity,
  Send
} from 'lucide-react';
import { merchantService } from './services/merchantService'; // New import for merchant registration

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+44", country: "UK", "flag": "🇬🇧" },
  { code: "+971", country: "UAE", "flag": "🇦🇪" }
];

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'mr', name: 'मराठी' },
  { code: 'gu', name: 'ગુજરાતી' }
];

// GSTIN Format: 27AAAPA1234A1Z5
// - Digits 1-2: State Code (01-37)
// - Digits 3-12: PAN (5 letters + 4 digits + 1 letter)
// - Digit 13: Entity number (0-9 or A-Z)
// - Digit 14: Z (default character)
// - Digit 15: Checksum (0-9 or A-Z)
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[A-Z0-9]{1}$/;
const isGstValid = (gst: string): boolean => GST_REGEX.test(gst);

// PAN Card Format: AFZPK7190K (for merchants)
// - Characters 1-3: Random alphabetical series (AAA to ZZZ)
// - Character 4: Holder type - C (Company), F (Firm), P (Person), or B (Body of Individuals)
// - Character 5: First letter of surname/name
// - Characters 6-9: Sequential number (0001 to 9999)
// - Character 10: Alphabetic check digit
const PAN_REGEX = /^[A-Z]{3}[CFPB][A-Z][0-9]{4}[A-Z]$/;
const isPanValid = (pan: string): boolean => PAN_REGEX.test(pan);

// Udyam (MSME) Format: UDYAM-MH-01-0000001
const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/i;
const isUdyamValid = (v: string): boolean => UDYAM_REGEX.test(v.toUpperCase());

// FSSAI (Food License) Format: 14 digits
const FSSAI_REGEX = /^[0-9]{14}$/;
const isFssaiValid = (v: string): boolean => FSSAI_REGEX.test(v);

// Trade License Format: 2-letter state code + alphanumeric (e.g., KA/2024/123456)
const TRADE_LICENSE_REGEX = /^[A-Z]{2}[A-Z0-9\/\-]{3,20}$/i;
const isTradeLicenseValid = (v: string): boolean => TRADE_LICENSE_REGEX.test(v.toUpperCase());

// Indian state name → 2-letter abbreviation (for Trade License pre-fill)
const STATE_ABBREVIATIONS: Record<string, string> = {
  'Andhra Pradesh': 'AP', 'Arunachal Pradesh': 'AR', 'Assam': 'AS',
  'Bihar': 'BR', 'Chhattisgarh': 'CG', 'Delhi': 'DL', 'Goa': 'GA',
  'Gujarat': 'GJ', 'Haryana': 'HR', 'Himachal Pradesh': 'HP',
  'Jharkhand': 'JH', 'Karnataka': 'KA', 'Kerala': 'KL',
  'Madhya Pradesh': 'MP', 'Maharashtra': 'MH', 'Manipur': 'MN',
  'Meghalaya': 'ML', 'Mizoram': 'MZ', 'Nagaland': 'NL', 'Odisha': 'OR',
  'Punjab': 'PB', 'Rajasthan': 'RJ', 'Sikkim': 'SK', 'Tamil Nadu': 'TN',
  'Telangana': 'TS', 'Tripura': 'TR', 'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK', 'West Bengal': 'WB',
};

const formatPhoneNumber = (value: string, countryCode: string) => {
  if (!value) return value;
  const digits = value.replace(/[^\d]/g, '');
  if (countryCode === '+91') {
    // For +91, return raw 10 digits without any formatting
    return digits.slice(0, 10);
  }
  // Keep original formatting for other countries unless specified
  if (digits.length < 1) return "";
  if (digits.length < 4) {
    return `(${digits}`;
  }
  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

const SHIFT1_OPTIONS = [
  '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'
];

const SHIFT2_OPTIONS = [
  '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM', '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM'
];


interface MemberJoinProps {
  setView: (view: AppView) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setShowOtpModal: (show: boolean) => void; // New prop for OTP modal
  setOtpPhoneNumber: (phone: string) => void; // New prop for OTP modal
  otpPhoneNumber: string; // Add this prop
  isPhoneVerifiedForRegistration: boolean; // New prop to track if phone is verified
  setRegistrationSuccessMessage: (msg: string | null) => void; // New prop
  theme: 'light' | 'dark'; // Add theme prop
  termsAccepted: boolean; // Terms acceptance state from parent
  setTermsAccepted: (accepted: boolean) => void; // Terms acceptance setter
  privacyAccepted: boolean; // Privacy acceptance state from parent
  setPrivacyAccepted: (accepted: boolean) => void; // Privacy acceptance setter
  signupRole: 'user' | 'merchant'; // Role selection state from parent
  setSignupRole: (role: 'user' | 'merchant') => void; // Role selection setter
  showRoleSelector: boolean; // Show role selector state from parent
  setShowRoleSelector: (show: boolean) => void; // Show role selector setter
}

export const MemberJoin: React.FC<MemberJoinProps> = ({
  setView,
  loading,
  setLoading,
  setShowOtpModal,
  setOtpPhoneNumber,
  otpPhoneNumber, // Destructure the prop
  isPhoneVerifiedForRegistration,
  setRegistrationSuccessMessage, // Destructure the new prop
  theme, // Destructure theme prop
  termsAccepted, // Destructure terms acceptance state
  setTermsAccepted, // Destructure terms acceptance setter
  privacyAccepted, // Destructure privacy acceptance state
  setPrivacyAccepted, // Destructure privacy acceptance setter
  signupRole: regRole, // Destructure and rename to regRole for internal use
  setSignupRole: setRegRole, // Destructure and rename to setRegRole
  showRoleSelector, // Destructure show role selector state
  setShowRoleSelector // Destructure show role selector setter
}) => {
  const { t, locale } = useTranslation();
  const isDark = theme === 'dark';

  // Business type selection
  const [businessType, setBusinessType] = useState<'' | 'gstin' | 'udyam' | 'fssai' | 'trade_license'>('');

  const [gstinValue, setGstinValue] = useState('');
  const [panValue, setPanValue] = useState('');
  const [gstinValidated, setGstinValidated] = useState<boolean | null>(null); // null = not validated, true = valid, false = invalid
  const [panValidated, setPanValidated] = useState<boolean | null>(null); // null = not validated, true = valid, false = invalid

  // Udyam (MSME) verification
  const [udyamValue, setUdyamValue] = useState('');
  const [udyamValidated, setUdyamValidated] = useState<boolean | null>(null);
  const [udyamTaken, setUdyamTaken] = useState<boolean | null>(null);
  const [isCheckingUdyam, setIsCheckingUdyam] = useState(false);

  // FSSAI (Food License) verification
  const [fssaiValue, setFssaiValue] = useState('');
  const [fssaiValidated, setFssaiValidated] = useState<boolean | null>(null);
  const [fssaiTaken, setFssaiTaken] = useState<boolean | null>(null);
  const [isCheckingFssai, setIsCheckingFssai] = useState(false);

  // Trade License (Shop & Establishment) verification
  const [tradeLicenseValue, setTradeLicenseValue] = useState('');
  const [tradeLicenseValidated, setTradeLicenseValidated] = useState<boolean | null>(null);
  const [tradeLicenseTaken, setTradeLicenseTaken] = useState<boolean | null>(null);
  const [isCheckingTradeLicense, setIsCheckingTradeLicense] = useState(false);

  const [isPhoneVerified, setIsPhoneVerified] = useState(false); // Local verification status
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [storeName, setStoreName] = useState(''); // Overall store name for merchant profile
  const [category, setCategory] = useState('');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [isCatsLoading, setIsCatsLoading] = useState(false);
  const [languagePreference, setLanguagePreference] = useState('en'); // Default to English

  // Consumer locality state
  const [consumerLocality, setConsumerLocality] = useState('');
  const [consumerPincode, setConsumerPincode] = useState('');
  const [consumerCity, setConsumerCity] = useState('');
  const [consumerState, setConsumerState] = useState('');
  const [consumerLocalitySuggestions, setConsumerLocalitySuggestions] = useState<DBLocality[]>([]);
  const [showConsumerLocalityDropdown, setShowConsumerLocalityDropdown] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Real-time validation states
  const [phoneTaken, setPhoneTaken] = useState<boolean | null>(null);
  const [gstinTaken, setGstinTaken] = useState<boolean | null>(null);
  const [panTaken, setPanTaken] = useState<boolean | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [isCheckingGstin, setIsCheckingGstin] = useState(false);
  const [isCheckingPan, setIsCheckingPan] = useState(false);


  const [merchantStores, setMerchantStores] = useState<StoreLocation[]>([
    { store_name: '', street: '', pincode: '', locality: '', state: '', city: '', landmark: '', coords: null, isGeocoding: false, shift1: '9:00 AM', shift2: '10:00 PM', is24hrs: false, isPincodeSearching: false }
  ]);

  const geocodeDebounceRef = useRef<Record<number, number | null>>({});
  const pincodeDebounceRef = useRef<Record<number, number | null>>({}); // New debounce ref for pincode
  const localityDebounceRef = useRef<Record<number, number | null>>({}); // New debounce ref for locality search

  // State for locality autocomplete
  const [localitySuggestions, setLocalitySuggestions] = useState<Record<number, DBLocality[]>>({});
  const [showLocalityDropdown, setShowLocalityDropdown] = useState<Record<number, boolean>>({});
  const [localityResolved, setLocalityResolved] = useState<Record<number, boolean>>({});

  // Ref for debounce timeouts
  const phoneDebounceRef = useRef<number | null>(null);
  const gstinDebounceRef = useRef<number | null>(null);
  const panDebounceRef = useRef<number | null>(null);
  const udyamDebounceRef = useRef<number | null>(null);
  const fssaiDebounceRef = useRef<number | null>(null);
  const tradeLicenseDebounceRef = useRef<number | null>(null);


  // Real-time phone number validation (for consumer role)
  const validatePhoneNumber = useCallback(async (value: string, countryCode: string) => {
    const fullPhoneNumber = countryCode + value;
    if (!/^\+?[1-9]\d{1,14}(?:[-\s]\d+)*$/.test(fullPhoneNumber) || value.length < 7) {
      setPhoneTaken(null);
      setIsCheckingPhone(false);
      return;
    }
    setIsCheckingPhone(true);
    try {
      const exists = await userService.validateUserIdentifier(fullPhoneNumber);
      setPhoneTaken(exists);
    } catch (e) {
      console.error("Phone number validation failed:", e);
      setPhoneTaken(null); // Set to null on error
    } finally {
      setIsCheckingPhone(false);
    }
  }, []);

  const handleRegPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, ''); // Get digits only
    setRegPhone(value);
    setPhoneTaken(null); // Reset on change
    setIsCheckingPhone(false);

    // Reset verification if phone number changes
    if (isPhoneVerified) setIsPhoneVerified(false);

    // For all users, check phone availability after debounce
    if (value.length >= 7) {
      if (phoneDebounceRef.current) {
        clearTimeout(phoneDebounceRef.current as number);
      }
      phoneDebounceRef.current = setTimeout(() => validatePhoneNumber(value, selectedCountry.code), 500) as number;
    } else {
      setPhoneTaken(null);
      setIsCheckingPhone(false);
    }

    // Note: OTP modal will be triggered automatically after validation completes (see useEffect)
  };

  // Real-time GSTIN validation
  const validateGstin = useCallback(async (value: string) => {
    if (!value || value.trim().length === 0) {
      setGstinTaken(null);
      setIsCheckingGstin(false);
      return;
    }
    if (!isGstValid(value)) {
      setGstinTaken(null);
      setIsCheckingGstin(false);
      return;
    }
    setIsCheckingGstin(true);
    try {
      // Encrypt the GSTIN before checking for duplicates (database stores encrypted values)
      const encryptedGstin = encryptionService.encryptGST(value).encrypted;
      const isTaken = await userService.validateMerchantField('gstin', encryptedGstin);
      setGstinTaken(isTaken);
    } catch (e) {
      console.error("GSTIN validation failed:", e);
      setGstinTaken(null); // Set to null on error
    } finally {
      setIsCheckingGstin(false);
    }
  }, []);

  const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setGstinValue(value);
    setGstinTaken(null); // Reset on change
    setIsCheckingGstin(false);
    setGstinValidated(null);

    if (gstinDebounceRef.current) {
      clearTimeout(gstinDebounceRef.current as number);
    }
    gstinDebounceRef.current = setTimeout(() => validateGstin(value), 500) as unknown as number;
  };

  // Real-time PAN validation
  const validatePan = useCallback(async (value: string) => {
    if (!value || value.trim().length === 0) {
      setPanTaken(null);
      setIsCheckingPan(false);
      return;
    }
    if (!isPanValid(value)) {
      setPanTaken(null);
      setIsCheckingPan(false);
      return;
    }
    setIsCheckingPan(true);
    try {
      // Encrypt the PAN before checking for duplicates (database stores encrypted values)
      const encryptedPan = encryptionService.encryptPAN(value).encrypted;
      const isTaken = await userService.validateMerchantField('pan', encryptedPan);
      setPanTaken(isTaken);
    } catch (e) {
      console.error("PAN validation failed:", e);
      setPanTaken(null); // Set to null on error
    } finally {
      setIsCheckingPan(false);
    }
  }, []);

  const handlePanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setPanValue(value);
    setPanTaken(null); // Reset on change
    setIsCheckingPan(false);
    setPanValidated(null);

    if (panDebounceRef.current) {
      clearTimeout(panDebounceRef.current as number);
    }
    panDebounceRef.current = setTimeout(() => validatePan(value), 500) as unknown as number;
  };

  // Dynamic Address-to-LatLong Resolver (existing logic)
  useEffect(() => {
    if (regRole !== 'merchant') return;

    merchantStores.forEach((store, index) => {
      // Clear existing debounce timeout for this store
      if (geocodeDebounceRef.current[index]) {
        clearTimeout(geocodeDebounceRef.current[index] as number);
      }

      // If coordinates are already set, or geocoding is in progress, skip.
      if (store.isGeocoding || (store.coords && store.coords.latitude !== 0 && store.coords.longitude !== 0)) {
        return;
      }
      
      // Only geocode if address fields are sufficiently filled AND pincode lookup is not active
      if (store.street.length > 5 && store.city && store.state && !store.isPincodeSearching) {
        geocodeDebounceRef.current[index] = setTimeout(async () => {
          
          setMerchantStores(prev => {
            const next = [...prev];
            next[index] = { ...next[index], isGeocoding: true };
            return next;
          });

          try {
            const fullAddress = `${store.street}, ${store.city}, ${store.state}, India`;
            console.log(`Auto-resolving grid node for index ${index}:`, fullAddress);
            
            const result = await locationsearchService.geocodeAddressWithAI(fullAddress);
            
            setMerchantStores(prev => {
              const next = [...prev];
              next[index] = { ...next[index], coords: result, isGeocoding: false };
              return next;
            });
          } catch (e) {
            console.error(`Error geocoding address for store ${index}:`, e);
            setMerchantStores(prev => {
              const next = [...prev];
              next[index] = { ...next[index], isGeocoding: false, coords: null };
              return next;
            });
          }
        }, 1200) as number; // Debounce time
      } else if (store.coords && store.street.length <= 5 && store.city.length === 0 && store.state.length === 0) {
          // If address fields are cleared, reset coords.
          setMerchantStores(prev => {
              const next = [...prev];
              next[index] = { ...next[index], coords: null };
              return next;
          });
      }
    });

    return () => {
      Object.values(geocodeDebounceRef.current).forEach(timeout => {
        if (timeout !== null) { 
          clearTimeout(timeout as number);
        }
      });
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current as number); 
    };
  }, [
    regRole, 
    // Trigger only when specific address components change, not the entire array object
    ...merchantStores.map(s => s.street), 
    ...merchantStores.map(s => s.city), 
    ...merchantStores.map(s => s.state), 
    ...merchantStores.map(s => s.pincode),
    validatePhoneNumber, selectedCountry.code
  ]); 


  // Pincode Lookup Logic using Nominatim (OpenStreetMap) via locationsearchService
  useEffect(() => {
    if (regRole !== 'merchant') return;

    merchantStores.forEach((store, index) => {
      // Clear existing debounce timeout for this store
      if (pincodeDebounceRef.current[index]) {
        clearTimeout(pincodeDebounceRef.current[index] as number);
      }

      // If city and state are already populated by a 6-digit pincode, skip.
      // Also skip if a pincode search is already in progress.
      if (store.isPincodeSearching || (store.pincode.length === 6 && store.city && store.state)) {
        return;
      }

      if (store.pincode.length === 6) {
        pincodeDebounceRef.current[index] = setTimeout(async () => {
          
          setMerchantStores(prev => {
            const next = [...prev];
            // Clear city/state/coords *before* lookup to show loading and prepare for new data
            next[index] = { ...next[index], isPincodeSearching: true, coords: null, city: '', state: '' };
            return next;
          });

          try {
            // Using the new client-side reverseGeocodePincode from locationsearchService
            const result = await locationsearchService.reverseGeocodePincode(store.pincode);
            if (result) {
              setMerchantStores(prev => {
                const next = [...prev];
                // Only populate city and state, NOT locality (user will type/select locality)
                next[index] = { ...next[index], city: result.city, state: result.state };
                return next;
              });
              console.log(`Pincode lookup successful for store ${index}:`, result);
            } else {
              setOtpError('Invalid pincode. Please check and try again.');
              setMerchantStores(prev => {
                const next = [...prev];
                next[index] = { ...next[index], city: '', state: '' }; // Clear on failure
                return next;
              });
            }
          } catch (e: any) {
            console.error(`Error looking up pincode for store ${index}:`, e);
            setOtpError('Could not verify pincode. Please check your connection and try again.');
            setMerchantStores(prev => {
              const next = [...prev];
              next[index] = { ...next[index], city: '', state: '' }; // Clear on error
              return next;
            });
          } finally {
            setMerchantStores(prev => {
              const next = [...prev];
              next[index] = { ...next[index], isPincodeSearching: false };
              return next;
            });
          }
        }, 800) as number; // Debounce time
      } else {
        // If pincode is not 6 digits, clear city/state fields (keep locality as user-entered)
        setMerchantStores(prev => {
          const next = [...prev];
          if ((next[index].city || next[index].state) && next[index].pincode.length !== 6) {
            next[index] = { ...next[index], city: '', state: '', coords: null };
          }
          if (next[index].isPincodeSearching) {
            next[index] = { ...next[index], isPincodeSearching: false };
          }
          return next;
        });
        // Clear any pending debounce for this store
        if (pincodeDebounceRef.current[index]) {
          clearTimeout(pincodeDebounceRef.current[index] as number);
        }
      }
    });

    return () => {
      Object.values(pincodeDebounceRef.current).forEach(timeout => {
        if (timeout !== null) {
          clearTimeout(timeout as number);
        }
      });
    };
  }, [
    regRole, 
    // Trigger only when specific pincode changes
    ...merchantStores.map(s => s.pincode)
  ]); 


  // Load categories from DB
  useEffect(() => {
    setIsCatsLoading(true);
    addCampaignService.getStoreCategories().then(cats => {
      setDbCategories(cats);
      setIsCatsLoading(false);
    }).catch(err => {
      console.error("Error fetching categories:", err);
      setIsCatsLoading(false);
    });
  }, [locale]);

  const handleStoreChange = (index: number, field: keyof StoreLocation, value: any) => {
    setMerchantStores(prev => {
      const newStores = [...prev];
      if (field === 'is24hrs') {
        newStores[index] = { ...newStores[index], is24hrs: value, shift1: value ? '00:00 AM' : '9:00 AM', shift2: value ? '10:00 PM' : '10:00 PM' };
      } else if (field === 'locality') {
        // When locality is manually changed, clear related fields for fresh data
        newStores[index] = {
          ...newStores[index],
          locality: value,
          pincode: '',
          city: '',
          state: '',
          coords: null
        };
      } else {
        newStores[index] = { ...newStores[index], [field]: value };
      }
      // If address related fields change (store_name, street, city, state, or pincode) clear coords
      if (['store_name', 'street', 'city', 'state', 'pincode'].includes(field as string) && !newStores[index].isGeocoding) {
        newStores[index].coords = null;
      }
      return newStores;
    });

    // If locality field changed, mark as unresolved and trigger autocomplete search
    if (field === 'locality' && typeof value === 'string') {
      setLocalityResolved((prev: Record<number, boolean>) => ({ ...prev, [index]: false }));
      handleLocalitySearch(index, value);
    }
  };

  // Search localities as user types
  const handleLocalitySearch = useCallback((index: number, query: string) => {
    // Clear previous timeout
    if (localityDebounceRef.current[index]) {
      clearTimeout(localityDebounceRef.current[index] as number);
    }

    // If query is empty, hide dropdown
    if (!query || query.length < 2) {
      setShowLocalityDropdown(prev => ({ ...prev, [index]: false }));
      setLocalitySuggestions(prev => ({ ...prev, [index]: [] }));
      return;
    }

    // Get the pincode for this store to filter results
    const store = merchantStores[index];
    const pincode = store?.pincode;

    // Debounce the search
    localityDebounceRef.current[index] = setTimeout(async () => {
      try {
        console.log(`[LocalitySearch] Searching for "${query}" with pincode ${pincode}`);
        const results = await locationsearchService.searchLocalities(query, locale);

        // Filter by pincode if available
        const filtered = pincode && pincode.length === 6
          ? results.filter(loc => loc.pincode === pincode)
          : results;

        console.log(`[LocalitySearch] Found ${filtered.length} localities matching "${query}" for pincode ${pincode}`);

        setLocalitySuggestions(prev => ({ ...prev, [index]: filtered }));
        setShowLocalityDropdown(prev => ({ ...prev, [index]: filtered.length > 0 }));
      } catch (error) {
        console.error('[LocalitySearch] Error searching localities:', error);
        setLocalitySuggestions(prev => ({ ...prev, [index]: [] }));
        setShowLocalityDropdown(prev => ({ ...prev, [index]: false }));
      }
    }, 300) as any; // 300ms debounce
  }, [merchantStores, locale]);

  // Handle selecting a locality from dropdown
  const handleSelectLocality = useCallback((index: number, locality: DBLocality) => {
    const localizedName = locality.display_name || locality.names[locale] || locality.names.en;

    setMerchantStores(prev => {
      const next = [...prev];
      // Set both locality and pincode - pincode will trigger city/state lookup automatically
      next[index] = { ...next[index], locality: localizedName, pincode: locality.pincode };
      return next;
    });

    // Mark locality as resolved via autocomplete
    setLocalityResolved((prev: Record<number, boolean>) => ({ ...prev, [index]: true }));
    // Hide dropdown
    setShowLocalityDropdown(prev => ({ ...prev, [index]: false }));
    console.log(`[LocalitySearch] Selected locality: ${localizedName} with pincode: ${locality.pincode}`);
  }, [locale]);

  // Consumer locality search handler
  const handleConsumerLocalitySearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setShowConsumerLocalityDropdown(false);
      setConsumerLocalitySuggestions([]);
      return;
    }

    try {
      console.log(`[ConsumerLocalitySearch] Searching for "${query}"`);
      const results = await locationsearchService.searchLocalities(query, locale);
      console.log(`[ConsumerLocalitySearch] Found ${results.length} localities`);

      setConsumerLocalitySuggestions(results);
      setShowConsumerLocalityDropdown(results.length > 0);
    } catch (error) {
      console.error('[ConsumerLocalitySearch] Error:', error);
      setConsumerLocalitySuggestions([]);
      setShowConsumerLocalityDropdown(false);
    }
  }, [locale]);

  // Consumer locality selection handler
  const handleConsumerLocalitySelect = useCallback((locality: DBLocality) => {
    const localizedName = locality.display_name || locality.names[locale] || locality.names.en;
    setConsumerLocality(localizedName);
    setConsumerPincode(locality.pincode);

    // Fetch city and state from pincode
    locationsearchService.reverseGeocodePincode(locality.pincode)
      .then(result => {
        if (result) {
          setConsumerCity(result.city);
          setConsumerState(result.state);
        }
      })
      .catch(err => console.error('[ConsumerLocalitySelect] Error fetching city/state:', err));

    setShowConsumerLocalityDropdown(false);
    console.log(`[ConsumerLocalitySelect] Selected: ${localizedName} (${locality.pincode})`);
  }, [locale]);

  const handleAddStore = () => {
    setMerchantStores(prev => [
      ...prev,
      { store_name: '', street: '', pincode: '', locality: '', state: '', city: '', landmark: '', coords: null, isGeocoding: false, shift1: '9:00 AM', shift2: '10:00 PM', is24hrs: false, isPincodeSearching: false }
    ]);
  };

  const handleRemoveStore = (indexToRemove: number) => {
    setMerchantStores(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleValidateGstin = () => {
    if (!gstinValue || gstinValue.length === 0) {
      setGstinValidated(null);
      return;
    }

    const isValid = isGstValid(gstinValue);
    setGstinValidated(isValid);

    if (!isValid) {
      setOtpError('Invalid GSTIN format. Please check and try again.');
      setTimeout(() => setOtpError(null), 3000);
    } else {
      // Clear any previous error
      setOtpError(null);
    }
  };

  const handleValidatePan = () => {
    if (!panValue || panValue.length === 0) {
      setPanValidated(null);
      return;
    }

    const isValid = isPanValid(panValue);
    setPanValidated(isValid);

    if (!isValid) {
      setOtpError('Invalid PAN format. Allowed types: Company (C), Firm (F), Person (P), or Body of Individuals (B).');
      setTimeout(() => setOtpError(null), 3000);
    } else {
      // Clear any previous error
      setOtpError(null);
    }
  };

  // Udyam validation
  const validateUdyam = useCallback(async (value: string) => {
    if (!value || !isUdyamValid(value)) { setUdyamTaken(null); setIsCheckingUdyam(false); return; }
    setIsCheckingUdyam(true);
    try {
      const isTaken = await userService.validateMerchantField('udyam_no', value.toUpperCase());
      setUdyamTaken(isTaken);
    } catch { setUdyamTaken(null); } finally { setIsCheckingUdyam(false); }
  }, []);

  const handleUdyamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setUdyamValue(value);
    setUdyamTaken(null);
    setUdyamValidated(null);
    setIsCheckingUdyam(false);
    if (udyamDebounceRef.current) clearTimeout(udyamDebounceRef.current as number);
    udyamDebounceRef.current = setTimeout(() => validateUdyam(value), 500) as unknown as number;
  };

  const handleValidateUdyam = () => {
    const isValid = isUdyamValid(udyamValue);
    setUdyamValidated(isValid);
    if (!isValid) { setOtpError('Invalid Udyam format. Expected: UDYAM-XX-00-0000000'); setTimeout(() => setOtpError(null), 3000); }
    else setOtpError(null);
  };

  // FSSAI validation
  const validateFssai = useCallback(async (value: string) => {
    if (!value || !isFssaiValid(value)) { setFssaiTaken(null); setIsCheckingFssai(false); return; }
    setIsCheckingFssai(true);
    try {
      const isTaken = await userService.validateMerchantField('fssai_no', value);
      setFssaiTaken(isTaken);
    } catch { setFssaiTaken(null); } finally { setIsCheckingFssai(false); }
  }, []);

  const handleFssaiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // digits only
    setFssaiValue(value);
    setFssaiTaken(null);
    setFssaiValidated(null);
    setIsCheckingFssai(false);
    if (fssaiDebounceRef.current) clearTimeout(fssaiDebounceRef.current as number);
    fssaiDebounceRef.current = setTimeout(() => validateFssai(value), 500) as unknown as number;
  };

  const handleValidateFssai = () => {
    const isValid = isFssaiValid(fssaiValue);
    setFssaiValidated(isValid);
    if (!isValid) { setOtpError('Invalid FSSAI format. Must be exactly 14 digits.'); setTimeout(() => setOtpError(null), 3000); }
    else setOtpError(null);
  };

  // Trade License validation
  const validateTradeLicense = useCallback(async (value: string) => {
    if (!value || !isTradeLicenseValid(value)) { setTradeLicenseTaken(null); setIsCheckingTradeLicense(false); return; }
    setIsCheckingTradeLicense(true);
    try {
      const isTaken = await userService.validateMerchantField('trade_license_no', value.toUpperCase());
      setTradeLicenseTaken(isTaken);
    } catch { setTradeLicenseTaken(null); } finally { setIsCheckingTradeLicense(false); }
  }, []);

  const handleTradeLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setTradeLicenseValue(value);
    setTradeLicenseTaken(null);
    setTradeLicenseValidated(null);
    setIsCheckingTradeLicense(false);
    if (tradeLicenseDebounceRef.current) clearTimeout(tradeLicenseDebounceRef.current as number);
    tradeLicenseDebounceRef.current = setTimeout(() => validateTradeLicense(value), 500) as unknown as number;
  };

  const handleValidateTradeLicense = () => {
    const isValid = isTradeLicenseValid(tradeLicenseValue);
    setTradeLicenseValidated(isValid);
    if (!isValid) { setOtpError('Invalid Trade License format. Must start with state code (e.g. KA/2024/123456).'); setTimeout(() => setOtpError(null), 3000); }
    else setOtpError(null);
  };

  const handleBusinessTypeChange = (newType: 'gstin' | 'udyam' | 'fssai' | 'trade_license') => {
    setBusinessType(newType);
    // Reset all business verification fields when type changes
    setGstinValue(''); setGstinValidated(null); setGstinTaken(null);
    setPanValue(''); setPanValidated(null); setPanTaken(null);
    setUdyamValue(''); setUdyamValidated(null); setUdyamTaken(null);
    setFssaiValue(''); setFssaiValidated(null); setFssaiTaken(null);
    setTradeLicenseValue(''); setTradeLicenseValidated(null); setTradeLicenseTaken(null);
    // Pre-fill Trade License with state abbreviation
    if (newType === 'trade_license') {
      const stateAbbrev = STATE_ABBREVIATIONS[merchantStores[0]?.state] || '';
      if (stateAbbrev) setTradeLicenseValue(stateAbbrev);
    }
  };

  const handleGetGpsForStore = async (index: number) => {
    setMerchantStores(prev => {
      const newStores = [...prev];
      newStores[index] = { ...newStores[index], isGeocoding: true };
      return newStores;
    });
    try {
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setMerchantStores(prev => {
        const newStores = [...prev];
        newStores[index] = { ...newStores[index], isGeocoding: false, coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
        return newStores;
      });
    } catch (e) {
      console.error("GPS Error: Failed to get location. Ensure permissions are granted.", e);
      setMerchantStores(prev => {
        const newStores = [...prev];
        newStores[index] = { ...newStores[index], isGeocoding: false, coords: null };
        return newStores;
      });
    }
  };

  const handleSendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    setOtpError(null);
    const fullPhoneNumber = selectedCountry.code + regPhone.replace(/[^0-9]/g, '');

    if (!regPhone || !/^\+?[1-9]\d{1,14}(?:[-\s]\d+)*$/.test(fullPhoneNumber)) {
      console.warn("Invalid phone number entered for OTP.");
      setOtpError("Invalid phone number format.");
      return;
    }

    setIsSendingOtp(true);
    // Directly set the phone number for the modal and show it
    setOtpPhoneNumber(fullPhoneNumber);
    setShowOtpModal(true);
    setIsSendingOtp(false); // Reset sending state once modal is triggered
  };

  useEffect(() => {
    if (isPhoneVerifiedForRegistration && regPhone && otpPhoneNumber && (selectedCountry.code + regPhone.replace(/[^0-9]/g, '') !== otpPhoneNumber)) {
      setIsPhoneVerified(false);
      setOtpPhoneNumber('');
    } else if (isPhoneVerifiedForRegistration && otpPhoneNumber && !isPhoneVerified) {
      setIsPhoneVerified(true);
    }
  }, [regPhone, selectedCountry.code, isPhoneVerifiedForRegistration, otpPhoneNumber, isPhoneVerified]);

  // Auto-trigger OTP modal when phone validation completes successfully (for both consumers and merchants)
  useEffect(() => {
    if (!isPhoneVerified && phoneTaken === false && regPhone.length > 0) {
      const requiredLength = selectedCountry.code === '+91' ? 10 : 7;
      if (regPhone.length === requiredLength) {
        const fullPhoneNumber = selectedCountry.code + regPhone;
        setOtpPhoneNumber(fullPhoneNumber);
        setShowOtpModal(true);
      }
    }
  }, [regRole, isPhoneVerified, phoneTaken, regPhone, selectedCountry.code]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (regRole === 'user' && (phoneTaken === true)) {
        throw new Error("Phone number already registered.");
      }
      // Validate phone check is complete
      if (isCheckingPhone || (regPhone.length > 0 && phoneTaken === null)) {
        throw new Error("Phone validation still in progress. Please wait.");
      }


      const finalRegPhone = regPhone ? selectedCountry.code + regPhone.replace(/[^0-9]/g, '') : null;

      if (regRole === 'user') {
        // For consumers: phone is required and must be verified
        if (!finalRegPhone) {
          throw new Error("Phone number required.");
        }
        if (!isPhoneVerified) {
          throw new Error("Phone number not verified.");
        }

        // Consumer signup: phone-first, no email/username/password
        const consumerRegData = {
          fullName: null,
          phone: finalRegPhone,
          role: 'consumer',
          languagePreference,
          home_location: consumerLocality || null,
        };
        console.log('[memberJoin] Attempting to register consumer with phone-first authentication');

        const { user: registeredUser, session } = await userService.registerUser(consumerRegData);

        if (registeredUser) {
          setRegistrationSuccessMessage("Registration Successful. Please log in.");
          setView('login');
        } else {
          throw new Error("Registration failed unexpectedly.");
        }

      } else { // regRole === 'merchant'
        // Client-side validation: Rely on `canSubmit` to disable button for these checks
        if (businessType === 'gstin') {
          if (!isGstValid(gstinValue)) throw new Error('Invalid GSTIN.');
          if (!isPanValid(panValue)) throw new Error('Invalid PAN.');
        } else if (businessType === 'udyam') {
          if (!isUdyamValid(udyamValue)) throw new Error('Invalid Udyam Registration No.');
        } else if (businessType === 'fssai') {
          if (!isFssaiValid(fssaiValue)) throw new Error('Invalid FSSAI License No.');
        } else if (businessType === 'trade_license') {
          if (!isTradeLicenseValid(tradeLicenseValue)) throw new Error('Invalid Trade License No.');
        }
        if (merchantStores.some(s => !s.store_name || !s.street || !s.city || !s.state)) {
          throw new Error('Incomplete store address.');
        }
        if (merchantStores.some(s => !s.is24hrs && (!s.shift1 || !s.shift2))) {
          throw new Error('Incomplete store hours.');
        }
        if (merchantStores.some(s => !s.coords?.latitude || !s.coords?.longitude)) {
          throw new Error('Unresolved GPS coordinates for store.');
        }
        if (!finalRegPhone) {
          throw new Error("Phone number required.");
        }
        if (finalRegPhone && !isPhoneVerified) {
          throw new Error("Phone number not verified.");
        }

        // 🔐 SECURITY: Encrypt sensitive business data (GSTIN/PAN only for GSTIN type)
        let encryptedGstin: string | null = null;
        let encryptedPan: string | null = null;

        if (businessType === 'gstin') {
          const gstEncryptionResult = encryptionService.encryptGST(gstinValue);
          const panEncryptionResult = encryptionService.encryptPAN(panValue);
          if (!gstEncryptionResult.isValid) throw new Error(gstEncryptionResult.error || 'GST encryption failed');
          if (!panEncryptionResult.isValid) throw new Error(panEncryptionResult.error || 'PAN encryption failed');
          encryptedGstin = gstEncryptionResult.encrypted;
          encryptedPan = panEncryptionResult.encrypted;
          auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_REGISTRATION', 'GST');
          auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_REGISTRATION', 'PAN');
        }

        const merchantRegData = {
          fullName,
          phone: finalRegPhone,
          role: 'merchant',
          storeName,
          category,
          businessType,
          gstin: encryptedGstin,
          pan: encryptedPan,
          udyamNo: businessType === 'udyam' ? udyamValue.toUpperCase() : null,
          fssaiNo: businessType === 'fssai' ? fssaiValue : null,
          tradeLicenseNo: businessType === 'trade_license' ? tradeLicenseValue.toUpperCase() : null,
          termsAccepted,
          privacyAccepted,
          languagePreference,
          stores: merchantStores.map(s => ({
            store_name: s.store_name,
            address: s.street,
            pincode: s.pincode,
            locality: s.locality,
            city: s.city,
            state: s.state,
            landmark: s.landmark,
            latitude: s.coords?.latitude || 0,
            longitude: s.coords?.longitude || 0,
            store_hrs: s.is24hrs ? 'Open 24 Hours' : `${s.shift1} - ${s.shift2}`,
          })),
        };
        console.log('[memberJoin] Attempting to register merchant:', {
          ...merchantRegData,
          gstin: businessType === 'gstin' ? encryptionService.maskGST(gstinValue) : null,
          pan: businessType === 'gstin' ? encryptionService.maskPAN(panValue) : null,
        });

        const { user: registeredUser, session } = await merchantService.registerMerchant(merchantRegData);

        if (registeredUser) {
          setRegistrationSuccessMessage("Registration successful. Please log in.");
          setView('login');
        } else {
          throw new Error("Registration failed unexpectedly.");
        }
      }

    } catch (err: any) {
      console.error("Registration Error:", err);
      // Display the error in the OTP error field as a general form error
      setOtpError("Registration failed. Please check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  const getPhonePlaceholder = () => {
    const commonPrefix = selectedCountry.code === '+91' ? '10 Digits - ' : '';
    return regRole === 'user'
      ? `Phone Number (${commonPrefix}Optional)`
      : `GST registered phone number (${commonPrefix}Required)`
  }

  const canSubmit = useMemo(() => {
    // Universal validations
    if (loading || isCheckingPhone || isCheckingGstin || isCheckingPan ||
        isCheckingUdyam || isCheckingFssai || isCheckingTradeLicense) {
      return false; // Always block if any check is in progress
    }

    // Phone validation - required for both roles now
    if (regPhone.length > 0 && phoneTaken === null) {
      return false; // Phone entered but validation not complete
    }

    // Basic fields must be filled
    if (regRole === 'user') {
      // Phone is required and must meet minimum length
      if (regPhone.length === 0 || regPhone.length < 7) {
        return false;
      }
      // Phone must be verified for consumers
      if (!isPhoneVerified) {
        return false;
      }
    }
    // Check if identifiers are actually available (not taken)
    if (phoneTaken === true || gstinTaken === true || panTaken === true ||
        udyamTaken === true || fssaiTaken === true || tradeLicenseTaken === true) {
      return false;
    }

    if (regRole === 'user') {
      // Locality validation: If user started typing locality, all fields must be resolved
      if (consumerLocality.trim().length > 0) {
        if (!consumerPincode || !consumerCity || !consumerState) {
          return false; // Locality not fully resolved
        }
      }
      return true;
    } else { // regRole === 'merchant'
      // Merchant-specific validations
      if (!fullName || !storeName || !category || !regPhone) {
        return false;
      }
      // Business type specific document validation
      if (!businessType) return false;
      const bizDocValid = (() => {
        if (businessType === 'gstin') return !!gstinValue && isGstValid(gstinValue) && !!panValue && isPanValid(panValue);
        if (businessType === 'udyam') return !!udyamValue && isUdyamValid(udyamValue);
        if (businessType === 'fssai') return !!fssaiValue && isFssaiValid(fssaiValue);
        if (businessType === 'trade_license') return !!tradeLicenseValue && isTradeLicenseValid(tradeLicenseValue);
        return false;
      })();
      if (!bizDocValid) return false;
      if (!termsAccepted || !privacyAccepted) {
        return false;
      }
      if (!isPhoneVerified) {
        return false;
      }
      if (merchantStores.length === 0) {
        return false;
      }
      const allStoresValid = merchantStores.every(s =>
        s.store_name.length > 0 &&
        s.street.length > 0 &&
        s.pincode.length === 6 &&
        !s.isPincodeSearching &&
        s.city.length > 0 &&
        s.state.length > 0 &&
        s.coords !== null &&
        (s.is24hrs || (s.shift1.length > 0 && s.shift2.length > 0))
      );
      return allStoresValid;
    }
  }, [
    loading, isCheckingPhone, isCheckingGstin, isCheckingPan,
    isCheckingUdyam, isCheckingFssai, isCheckingTradeLicense,
    phoneTaken, gstinTaken, panTaken,
    udyamTaken, fssaiTaken, tradeLicenseTaken,
    regRole, fullName, storeName, category, gstinValue, panValue, regPhone,
    businessType, udyamValue, fssaiValue, tradeLicenseValue,
    isGstValid, isPanValid, isPhoneVerified, merchantStores,
    consumerLocality, consumerPincode, consumerCity, consumerState,
    termsAccepted, privacyAccepted
  ]);

  const inputClass = `w-full h-12 px-4 rounded-lg text-sm font-medium border outline-none transition-all ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
  }`;

  const renderRoleSelector = () => (
    <div className={`px-6 pt-8 flex flex-col justify-center min-h-screen ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="w-full text-center mb-10">
        <h2 className={`text-2xl font-semibold leading-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('reg_title')}
        </h2>
        <p className={`text-sm font-medium mt-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {t('reg_choose_account') || 'Choose your account type to get started'}
        </p>
      </div>

      <div className="space-y-4">
        {/* Consumer/User Option */}
        <button
          type="button"
          onClick={() => {
            setRegRole('user');
            setShowRoleSelector(false);
          }}
          className={`w-full p-6 rounded-xl border transition-all active:scale-[0.98] group ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-400'}`}
        >
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <UserIcon className="w-7 h-7 text-yellow-500" />
            </div>
            <div className="flex-1 text-left">
              <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('reg_consumer')}
              </h3>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('reg_consumer_desc') || 'Join the network to discover local deals and save money'}
              </p>
            </div>
          </div>
        </button>

        {/* Merchant Option */}
        <button
          type="button"
          onClick={() => {
            setRegRole('merchant');
            setShowRoleSelector(false);
          }}
          className={`w-full p-6 rounded-xl border transition-all active:scale-[0.98] group ${isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-400'}`}
        >
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <Store className="w-7 h-7 text-yellow-500" />
            </div>
            <div className="flex-1 text-left">
              <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('reg_merchant')}
              </h3>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('reg_merchant_desc') || <>Empower your business with <span className={isDark ? 'text-white' : 'text-slate-900'}>Deal</span><span className="text-green-500">Pro</span> smart commerce</>}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Back to Login */}
      <div className="mt-10 text-center">
        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t('reg_have_account') || 'Already have an account?'}{' '}
          <button
            onClick={() => setView('login')}
            className={`ml-1 font-semibold ${isDark ? 'text-white' : 'text-green-600'}`}
          >
            {t('reg_back_login') || 'Back to Login'}
          </button>
        </p>
      </div>
    </div>
  );

  const renderRegisterForm = () => (
    <div className={`px-6 pt-8 flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="w-full text-left mb-6">
        <h2 className={`text-2xl font-semibold leading-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('reg_title')}
        </h2>
        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {regRole === 'user' ? 'Join the network to discover local deals.' : <>Empower your business with <span className={isDark ? 'text-white' : 'text-slate-900'}>Deal</span><span className="text-green-500">Pro</span> smart commerce.</>}
        </p>
      </div>

      {otpError && (
        <div className={`mb-5 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{otpError}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-6 flex-1">
        {/* Basic User Info (Applies to both roles) */}
        <div className="space-y-4">
          {/* Phone Number - First field for consumers, required with OTP */}
          <div className="relative flex">
             {/* Country Code Picker */}
             <div className={`relative ${showCountryPicker ? 'z-[1000]' : ''}`}>
                <button
                   type="button"
                   onClick={() => setShowCountryPicker(!showCountryPicker)}
                   className={`h-12 w-20 rounded-l-lg border border-r-0 flex items-center justify-center gap-1 active:scale-95 transition-all focus:outline-none ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                   <span className="text-lg">{selectedCountry.flag}</span>
                   <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
                {showCountryPicker && (
                   <div className={`absolute top-full left-0 mt-2 w-48 rounded-xl p-2 z-[999] shadow-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className="max-h-48 overflow-y-auto hide-scrollbar">
                         {COUNTRY_CODES.map(c => (
                            <button
                               key={c.code}
                               type="button"
                               onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); }}
                               className={`w-full text-left p-3 rounded-lg text-xs font-medium flex gap-3 items-center ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}
                            >
                               <span>{c.flag}</span> <span className={`flex-1 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{c.country}</span> <span className="text-slate-500">{c.code}</span>
                            </button>
                         ))}
                      </div>
                   </div>
                )}
             </div>
             {/* Input field with integrated icon */}
             <div className="relative flex-1">
                 <input
                   type="tel"
                   placeholder={regRole === 'user' ? `Phone Number (${selectedCountry.code === '+91' ? '10 Digits - ' : ''}Required)` : getPhonePlaceholder()}
                   className={`${inputClass} rounded-l-none`}
                   value={formatPhoneNumber(regPhone, selectedCountry.code)}
                   onChange={handleRegPhoneChange}
                   maxLength={selectedCountry.code === '+91' ? 10 : 15}
                   required
                 />
                 {/* Loading spinner while checking phone for consumers */}
                 {regRole === 'user' && isCheckingPhone && (
                   <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                 )}
                 {/* Error indicator if phone is already taken for consumers */}
                 {regRole === 'user' && phoneTaken === true && !isCheckingPhone && (
                   <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                 )}
                 {/* OTP Button for consumers when phone is available */}
                 {regRole === 'user' && regPhone.length >= (selectedCountry.code === '+91' ? 10 : 7) && !isPhoneVerified && phoneTaken === false && !isCheckingPhone && (
                   <button
                     type="button"
                     onClick={handleSendOtp}
                     disabled={isSendingOtp}
                     className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center active:scale-90 transition-all"
                   >
                     {isSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   </button>
                 )}
                 {/* Verified checkmark for consumers */}
                 {regRole === 'user' && isPhoneVerified && regPhone.length > 0 && (
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                     <CheckCircle2 className="w-5 h-5" />
                   </div>
                 )}
                 {/* Loading spinner while checking phone for merchants */}
                 {regRole === 'merchant' && isCheckingPhone && (
                   <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                 )}
                 {/* Error indicator if phone is already taken for merchants */}
                 {regRole === 'merchant' && phoneTaken === true && !isCheckingPhone && !isPhoneVerified && (
                   <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                 )}
                 {/* Merchant OTP button - only show if phone is available */}
                 {regRole === 'merchant' && regPhone.length > 5 && !isPhoneVerified && (phoneTaken === false || phoneTaken === null) && !isCheckingPhone && (
                   <button
                     type="button"
                     onClick={handleSendOtp}
                     disabled={isSendingOtp}
                     className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center active:scale-90 transition-all"
                   >
                     {isSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   </button>
                 )}
                 {/* Merchant verified checkmark */}
                 {regRole === 'merchant' && isPhoneVerified && regPhone.length > 0 && (
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                     <CheckCircle2 className="w-5 h-5" />
                   </div>
                 )}
             </div>
          </div>

          {/* Phone error message */}
          {phoneTaken === true && !isCheckingPhone && (
            <div className="text-rose-500 text-xs font-medium -mt-2 ml-1">
              Phone number already registered
            </div>
          )}

          {/* Full Name - Only for merchants */}
          {regRole === 'merchant' && (
            <input
              type="text"
              placeholder={t('reg_fullname')}
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          )}

          {/* Consumer Locality Field - Only for user role */}
          {regRole === 'user' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Enter your area (Ex. Indira Nagar)"
                className={`${inputClass} ${consumerLocality.trim().length > 0 && !consumerPincode ? 'border-red-500' : ''}`}
                value={consumerLocality}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setConsumerLocality(newValue);
                  // Clear pincode, city, and state when user manually types (not selecting from dropdown)
                  // This ensures partial entries don't show stale data
                  setConsumerPincode('');
                  setConsumerCity('');
                  setConsumerState('');
                  handleConsumerLocalitySearch(newValue);
                }}
                onFocus={() => {
                  if (consumerLocalitySuggestions.length > 0) {
                    setShowConsumerLocalityDropdown(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowConsumerLocalityDropdown(false), 200);
                }}
              />

              {/* Autocomplete dropdown */}
              {showConsumerLocalityDropdown && consumerLocalitySuggestions.length > 0 && (
                <div className={`absolute z-50 w-full mt-1 rounded-xl shadow-lg max-h-60 overflow-y-auto border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                  {consumerLocalitySuggestions.map((locality) => {
                    const displayName = locality.display_name || locality.names[locale] || locality.names.en;
                    return (
                      <div
                        key={locality.id}
                        className={`px-4 py-3 cursor-pointer border-b last:border-b-0 transition-colors ${isDark ? 'hover:bg-slate-700 border-slate-700' : 'hover:bg-slate-50 border-slate-100'}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleConsumerLocalitySelect(locality);
                        }}
                      >
                        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{displayName}</div>
                        <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pincode: {locality.pincode}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Display pincode, city, state below */}
              {consumerPincode && consumerCity && consumerState && (
                <div className="mt-2 ml-1 space-y-0.5">
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold text-blue-400">Pincode:</span> {consumerPincode}
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold text-blue-400">City:</span> {consumerCity}
                  </p>
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold text-blue-400">State:</span> {consumerState}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <select
              value={languagePreference}
              onChange={(e) => setLanguagePreference(e.target.value)}
              className={inputClass}
              required
            >
              <option value="" disabled>Select Language Preference</option>
              {LANGUAGE_OPTIONS.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {regRole === 'merchant' && (
          <div className="space-y-4">
            {/* Overall Store Name for Merchant Profile, not individual store blocks */}
            <input
              type="text"
              placeholder={t('reg_brand')}
              className={inputClass}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
            />
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
                required
                disabled={isCatsLoading}
              >
                <option value="">{isCatsLoading ? 'Syncing Sectors...' : t('reg_category')}</option>
                {dbCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {isCatsLoading && <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-blue-500" />}
            </div>

            {merchantStores.map((store, index) => (
              <div key={index} className={`p-4 rounded-xl border space-y-3 relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                {merchantStores.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStore(index)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('reg_locations')} {index + 1}
                </p>
                {/* Store Name for this specific address block */}
                <input
                  type="text"
                  placeholder={t('reg_store_name_label')}
                  className={inputClass}
                  value={store.store_name}
                  onChange={(e) => handleStoreChange(index, 'store_name', e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder={t('reg_street')}
                  className={inputClass}
                  value={store.street}
                  onChange={(e) => handleStoreChange(index, 'street', e.target.value)}
                  required
                />

                {/* Locality input with autocomplete */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Locality / Area (type to search)"
                    className={`${inputClass} ${store.locality.trim().length > 0 && !localityResolved[index] ? 'border-red-500' : ''}`}
                    value={store.locality}
                    onChange={(e) => handleStoreChange(index, 'locality', e.target.value)}
                    onFocus={() => {
                      // Show dropdown if there are suggestions
                      if (localitySuggestions[index]?.length > 0) {
                        setShowLocalityDropdown(prev => ({ ...prev, [index]: true }));
                      }
                    }}
                    onBlur={() => {
                      // Hide dropdown after a short delay to allow clicking on items
                      setTimeout(() => {
                        setShowLocalityDropdown(prev => ({ ...prev, [index]: false }));
                      }, 200);
                    }}
                    required
                  />

                  {/* Autocomplete dropdown */}
                  {showLocalityDropdown[index] && localitySuggestions[index]?.length > 0 && (
                    <div className={`absolute z-50 w-full mt-1 rounded-xl shadow-lg max-h-60 overflow-y-auto border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      {localitySuggestions[index].map((locality) => {
                        const displayName = locality.display_name || locality.names[locale] || locality.names.en;
                        return (
                          <div
                            key={locality.id}
                            className={`px-4 py-3 cursor-pointer border-b last:border-b-0 transition-colors ${isDark ? 'hover:bg-slate-700 border-slate-700' : 'hover:bg-slate-50 border-slate-100'}`}
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent onBlur from hiding dropdown before click
                              handleSelectLocality(index, locality);
                            }}
                          >
                            <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{displayName}</div>
                            <div className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pincode: {locality.pincode}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pincode input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Pincode"
                    className={inputClass}
                    value={store.pincode}
                    onChange={(e) => handleStoreChange(index, 'pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                  />
                  {store.isPincodeSearching && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                  )}
                </div>

                <input
                  type="text"
                  placeholder={t('reg_city')}
                  className={inputClass}
                  value={store.city}
                  onChange={(e) => handleStoreChange(index, 'city', e.target.value)}
                  required
                  readOnly={store.pincode.length === 6 && !!store.city && !store.isPincodeSearching}
                  disabled={store.pincode.length === 6 && !!store.city && !store.isPincodeSearching}
                />
                <input
                  type="text"
                  placeholder={t('reg_state')}
                  className={inputClass}
                  value={store.state}
                  onChange={(e) => handleStoreChange(index, 'state', e.target.value)}
                  required
                  readOnly={store.pincode.length === 6 && !!store.state && !store.isPincodeSearching}
                  disabled={store.pincode.length === 6 && !!store.state && !store.isPincodeSearching}
                />
                <input
                  type="text"
                  placeholder={t('reg_landmark')}
                  className={inputClass}
                  value={store.landmark}
                  onChange={(e) => handleStoreChange(index, 'landmark', e.target.value)}
                />

                <div className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-3">
                      {store.isGeocoding ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      ) : store.coords ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <MapPin className="w-5 h-5 text-slate-500" />
                      )}
                      <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {store.coords ? t('reg_sync_verified') : t('loc_awaiting')}
                      </span>
                    </div>
                    {store.coords && (
                      <p className={`text-xs font-mono mt-1 pl-8 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Lat: {store.coords.latitude.toFixed(4)}, Lng: {store.coords.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGetGpsForStore(index)}
                    disabled={store.isGeocoding}
                    className="text-blue-500 text-xs font-medium active:scale-95 disabled:opacity-50"
                  >
                    <Navigation className="w-4 h-4 inline-block mr-1.5" />{t('reg_use_my_loc')}
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={store.is24hrs} 
                      onChange={(e) => handleStoreChange(index, 'is24hrs', e.target.checked)} 
                      className="form-checkbox h-5 w-5 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-slate-300">{t('reg_24h')}</span>
                  </label>
                  {!store.is24hrs && (
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={store.shift1}
                        onChange={(e) => handleStoreChange(index, 'shift1', e.target.value)}
                        className={`${inputClass} text-xs`}
                      >
                        <option value="">{t('reg_opens')}</option>
                        {SHIFT1_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                      <select
                        value={store.shift2}
                        onChange={(e) => handleStoreChange(index, 'shift2', e.target.value)}
                        className={`${inputClass} text-xs`}
                      >
                        <option value="">{t('reg_closes')}</option>
                        {SHIFT2_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddStore}
              className={`w-full p-3 rounded-xl border text-blue-500 flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}
            >
              <Plus className="w-5 h-5" />
              <span className="text-sm font-medium">{t('reg_add_outlet')}</span>
            </button>

            {/* Business Type Dropdown */}
            <div className="relative">
              <select
                className={inputClass}
                value={businessType}
                onChange={(e) => handleBusinessTypeChange(e.target.value as 'gstin' | 'udyam' | 'fssai' | 'trade_license')}
              >
                <option value="" disabled>Select Identification</option>
                <option value="gstin">GSTIN Number</option>
                <option value="udyam">Udyam (MSME) Verification</option>
                <option value="fssai">FSSAI (Food License) Verification</option>
                <option value="trade_license">Shop &amp; Establishment (Trade License)</option>
              </select>
            </div>

            {/* GSTIN Input — only for GSTIN type */}
            {businessType === 'gstin' && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder={t('reg_gstin')}
                      className={`${inputClass} ${
                        gstinTaken === true ? 'border-red-500' :
                        gstinTaken === false && gstinValidated === true ? 'border-emerald-500' :
                        gstinValidated === false ? 'border-red-500' :
                        gstinValidated === true ? 'border-emerald-500' :
                        gstinValue.length > 0 && !isGstValid(gstinValue) ? 'border-red-500' : ''
                      }`}
                      value={gstinValue}
                      onChange={handleGstinChange}
                    />
                    {isCheckingGstin && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
                    {!isCheckingGstin && gstinTaken === true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingGstin && gstinValidated === false && gstinTaken !== true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingGstin && gstinValidated === true && gstinTaken === false && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
                  </div>
                  <button type="button" onClick={handleValidateGstin} disabled={!gstinValue || !isGstValid(gstinValue)}
                    className={`px-4 h-12 rounded-lg border text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                    Validate
                  </button>
                </div>
                {gstinTaken === true && <p className="text-rose-500 text-xs font-medium mt-1 ml-1">✗ GSTIN already registered</p>}
                {gstinValidated === true && gstinTaken === false && <p className="text-emerald-500 text-xs font-medium mt-1 ml-1">✓ Valid GSTIN format and available</p>}
              </div>
            )}

            {/* Udyam Input — only for Udyam type */}
            {businessType === 'udyam' && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Udyam Reg. No. (e.g. UDYAM-MH-01-0000001)"
                      className={`${inputClass} ${
                        udyamTaken === true ? 'border-red-500' :
                        udyamTaken === false && udyamValidated === true ? 'border-emerald-500' :
                        udyamValidated === false ? 'border-red-500' :
                        udyamValidated === true ? 'border-emerald-500' :
                        udyamValue.length > 0 && !isUdyamValid(udyamValue) ? 'border-red-500' : ''
                      }`}
                      value={udyamValue}
                      onChange={handleUdyamChange}
                    />
                    {isCheckingUdyam && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
                    {!isCheckingUdyam && udyamTaken === true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingUdyam && udyamValidated === false && udyamTaken !== true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingUdyam && udyamValidated === true && udyamTaken === false && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
                  </div>
                  <button type="button" onClick={handleValidateUdyam} disabled={!udyamValue || !isUdyamValid(udyamValue)}
                    className={`px-4 h-12 rounded-lg border text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                    Validate
                  </button>
                </div>
                {udyamTaken === true && <p className="text-rose-500 text-xs font-medium mt-1 ml-1">✗ Udyam No. already registered</p>}
                {udyamValidated === true && udyamTaken === false && <p className="text-emerald-500 text-xs font-medium mt-1 ml-1">✓ Valid Udyam format and available</p>}
              </div>
            )}

            {/* FSSAI Input — only for FSSAI type */}
            {businessType === 'fssai' && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="FSSAI License No. (14 digits)"
                      className={`${inputClass} ${
                        fssaiTaken === true ? 'border-red-500' :
                        fssaiTaken === false && fssaiValidated === true ? 'border-emerald-500' :
                        fssaiValidated === false ? 'border-red-500' :
                        fssaiValidated === true ? 'border-emerald-500' :
                        fssaiValue.length > 0 && !isFssaiValid(fssaiValue) ? 'border-red-500' : ''
                      }`}
                      value={fssaiValue}
                      onChange={handleFssaiChange}
                      maxLength={14}
                    />
                    {isCheckingFssai && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
                    {!isCheckingFssai && fssaiTaken === true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingFssai && fssaiValidated === false && fssaiTaken !== true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingFssai && fssaiValidated === true && fssaiTaken === false && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
                  </div>
                  <button type="button" onClick={handleValidateFssai} disabled={!fssaiValue || !isFssaiValid(fssaiValue)}
                    className={`px-4 h-12 rounded-lg border text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                    Validate
                  </button>
                </div>
                {fssaiTaken === true && <p className="text-rose-500 text-xs font-medium mt-1 ml-1">✗ FSSAI No. already registered</p>}
                {fssaiValidated === true && fssaiTaken === false && <p className="text-emerald-500 text-xs font-medium mt-1 ml-1">✓ Valid FSSAI format and available</p>}
              </div>
            )}

            {/* Trade License Input — only for trade_license type */}
            {businessType === 'trade_license' && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="License Number"
                      className={`${inputClass} ${
                        tradeLicenseTaken === true ? 'border-red-500' :
                        tradeLicenseTaken === false && tradeLicenseValidated === true ? 'border-emerald-500' :
                        tradeLicenseValidated === false ? 'border-red-500' :
                        tradeLicenseValidated === true ? 'border-emerald-500' :
                        tradeLicenseValue.length > 0 && !isTradeLicenseValid(tradeLicenseValue) ? 'border-red-500' : ''
                      }`}
                      value={tradeLicenseValue}
                      onChange={handleTradeLicenseChange}
                    />
                    {isCheckingTradeLicense && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
                    {!isCheckingTradeLicense && tradeLicenseTaken === true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingTradeLicense && tradeLicenseValidated === false && tradeLicenseTaken !== true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingTradeLicense && tradeLicenseValidated === true && tradeLicenseTaken === false && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
                  </div>
                  <button type="button" onClick={handleValidateTradeLicense} disabled={!tradeLicenseValue || !isTradeLicenseValid(tradeLicenseValue)}
                    className={`px-4 h-12 rounded-lg border text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                    Validate
                  </button>
                </div>
                {tradeLicenseTaken === true && <p className="text-rose-500 text-xs font-medium mt-1 ml-1">✗ Trade License No. already registered</p>}
                {tradeLicenseValidated === true && tradeLicenseTaken === false && <p className="text-emerald-500 text-xs font-medium mt-1 ml-1">✓ Valid Trade License format and available</p>}
              </div>
            )}

            {/* PAN Input — only for GSTIN type */}
            {businessType === 'gstin' && (
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder={t('reg_pan')}
                      className={`${inputClass} ${
                        panTaken === true ? 'border-red-500' :
                        panTaken === false && panValidated === true ? 'border-emerald-500' :
                        panValidated === false ? 'border-red-500' :
                        panValidated === true ? 'border-emerald-500' :
                        panValue.length > 0 && !isPanValid(panValue) ? 'border-red-500' : ''
                      }`}
                      value={panValue}
                      onChange={handlePanChange}
                    />
                    {isCheckingPan && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />}
                    {!isCheckingPan && panTaken === true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingPan && panValidated === false && panTaken !== true && <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
                    {!isCheckingPan && panValidated === true && panTaken === false && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
                  </div>
                  <button type="button" onClick={handleValidatePan} disabled={!panValue || !isPanValid(panValue)}
                    className={`px-4 h-12 rounded-lg border text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                    Validate
                  </button>
                </div>
                {panTaken === true && <p className="text-rose-500 text-xs font-medium mt-1 ml-1">✗ PAN already registered</p>}
                {panValidated === true && panTaken === false && <p className="text-emerald-500 text-xs font-medium mt-1 ml-1">✓ Valid PAN format and available</p>}
              </div>
            )}

            {/* Terms of Service and Privacy Policy Checkboxes */}
            <div className="space-y-3 mt-4">
              {/* Terms of Service Checkbox */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="termsCheckbox"
                  checked={termsAccepted}
                  disabled
                  readOnly
                  className={`mt-1 w-5 h-5 rounded cursor-not-allowed transition-all ${
                    termsAccepted
                      ? 'accent-emerald-500 opacity-100'
                      : 'accent-slate-600 opacity-40'
                  }`}
                />
                <label className={`text-sm select-none ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  I have read and accept the{' '}
                  <button
                    type="button"
                    onClick={() => setView('terms_of_service_signup')}
                    className={`underline transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    Terms of Service
                  </button>
                </label>
              </div>

              {/* Privacy Policy Checkbox */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="privacyCheckbox"
                  checked={privacyAccepted}
                  disabled
                  readOnly
                  className={`mt-1 w-5 h-5 rounded cursor-not-allowed transition-all ${
                    privacyAccepted
                      ? 'accent-emerald-500 opacity-100'
                      : 'accent-slate-600 opacity-40'
                  }`}
                />
                <label className={`text-sm select-none ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  I have read and accept the{' '}
                  <button
                    type="button"
                    onClick={() => setView('privacy_policy_signup')}
                    className={`underline transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                  >
                    Privacy Policy
                  </button>
                </label>
              </div>
            </div>

          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-12 rounded-xl bg-slate-900 text-white font-medium text-sm flex items-center justify-center active:scale-[0.98] transition-all mt-6 disabled:opacity-30"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : t('reg_submit')}
        </button>
      </form>

      <div className="mt-8 text-center space-y-4 pb-20">
        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t('reg_have_account') || 'Already have an account?'}{' '}
          <button onClick={() => setView('login')} className={`ml-1 font-semibold ${isDark ? 'text-white' : 'text-green-600'}`}>
            {t('reg_back_login') || 'Back to Login'}
          </button>
        </p>
      </div>
    </div>
  );

  return showRoleSelector ? renderRoleSelector() : renderRegisterForm();
};