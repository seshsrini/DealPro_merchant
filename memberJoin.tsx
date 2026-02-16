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
  Eye,
  EyeOff,
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

const isValidPassword = (password: string): boolean => {
  // At least 8 characters, at most 15, one uppercase, one number, and no spaces.
  const regex = /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/;
  return regex.test(password);
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

  const [gstinValue, setGstinValue] = useState('');
  const [panValue, setPanValue] = useState('');
  const [gstinValidated, setGstinValidated] = useState<boolean | null>(null); // null = not validated, true = valid, false = invalid
  const [panValidated, setPanValidated] = useState<boolean | null>(null); // null = not validated, true = valid, false = invalid

  const [isPhoneVerified, setIsPhoneVerified] = useState(false); // Local verification status
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  const [showPassword, setShowPassword] = useState(false);

  // Real-time validation states
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);
  const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
  const [phoneTaken, setPhoneTaken] = useState<boolean | null>(null);
  const [gstinTaken, setGstinTaken] = useState<boolean | null>(null);
  const [panTaken, setPanTaken] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
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

  // Ref for debounce timeouts
  const usernameDebounceRef = useRef<number | null>(null);
  const emailDebounceRef = useRef<number | null>(null);
  const phoneDebounceRef = useRef<number | null>(null);
  const gstinDebounceRef = useRef<number | null>(null);
  const panDebounceRef = useRef<number | null>(null);


  // Real-time username validation
  const validateUsername = useCallback(async (value: string) => {
    if (value.length < 3) {
      setUsernameTaken(null);
      setIsCheckingUsername(false);
      return;
    }
    setIsCheckingUsername(true);
    try {
      const exists = await userService.validateUserIdentifier(value);
      setUsernameTaken(exists);
    } catch (e) {
      console.error("Username validation failed:", e);
      setUsernameTaken(null); // Set to null on error: cannot determine if taken
    } finally {
      setIsCheckingUsername(false);
    }
  }, []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setUsernameTaken(null); // Reset on change
    setIsCheckingUsername(false);

    if (usernameDebounceRef.current) {
      clearTimeout(usernameDebounceRef.current as number); 
    }
    usernameDebounceRef.current = setTimeout(() => validateUsername(value), 500) as number;
  };

  // Real-time email validation
  const validateEmail = useCallback(async (value: string) => {
    // Allow empty email for merchants
    if (!value || value.length === 0) {
      setEmailTaken(null);
      setIsCheckingEmail(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailTaken(null);
      setIsCheckingEmail(false);
      return;
    }
    setIsCheckingEmail(true);
    try {
      const exists = await userService.validateUserIdentifier(value);
      setEmailTaken(exists);
    } catch (e) {
      console.error("Email validation failed:", e);
      setEmailTaken(null); // Set to null on error
    } finally {
      setIsCheckingEmail(false);
    }
  }, []);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setEmailTaken(null); // Reset on change
    setIsCheckingEmail(false);

    if (emailDebounceRef.current) {
      clearTimeout(emailDebounceRef.current as number); 
    }
    emailDebounceRef.current = setTimeout(() => validateEmail(value), 500) as number;
  };

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

    // Reset verification if phone number changes (important for merchant flow)
    if (isPhoneVerified) setIsPhoneVerified(false);

    if (regRole === 'user' && value.length >= 7) {
      if (phoneDebounceRef.current) {
        clearTimeout(phoneDebounceRef.current as number);
      }
      phoneDebounceRef.current = setTimeout(() => validatePhoneNumber(value, selectedCountry.code), 500) as number;
    } else if (regRole === 'user') {
      setPhoneTaken(null);
      setIsCheckingPhone(false);
    }

    // Auto-trigger OTP for merchants when 10 digits are entered
    if (regRole === 'merchant' && selectedCountry.code === '+91' && value.length === 10 && !isPhoneVerified) {
      const fullPhoneNumber = selectedCountry.code + value;
      setOtpPhoneNumber(fullPhoneNumber);
      setShowOtpModal(true);
    }
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
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current as number); 
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current as number); 
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current as number); 
    };
  }, [
    regRole, 
    // Trigger only when specific address components change, not the entire array object
    ...merchantStores.map(s => s.street), 
    ...merchantStores.map(s => s.city), 
    ...merchantStores.map(s => s.state), 
    ...merchantStores.map(s => s.pincode),
    validateUsername, validateEmail, validatePhoneNumber, selectedCountry.code
  ]); 


  // NEW: Pincode Lookup Logic using Google Maps Geocoding API directly
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
              setOtpError(`Pincode ${store.pincode} not found or could not resolve city/state.`);
              setMerchantStores(prev => {
                const next = [...prev];
                next[index] = { ...next[index], city: '', state: '' }; // Clear on failure
                return next;
              });
            }
          } catch (e: any) {
            console.error(`Error looking up pincode for store ${index}:`, e);
            setOtpError(`Pincode lookup failed: ${e.message || "Network Error"}.`);
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

    // If locality field changed, trigger autocomplete search
    if (field === 'locality' && typeof value === 'string') {
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


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Client-side validation: Rely on `canSubmit` to disable button for these checks
      if (!isValidPassword(password)) {
        throw new Error("Password strength invalid.");
      }
      
      if (regRole === 'user' && (usernameTaken || emailTaken || phoneTaken)) {
        throw new Error("Identifier conflicts exist.");
      }
      // For merchants, email is optional, so only check if email is provided
      if (regRole === 'merchant' && email.length > 0 && (isCheckingUsername || isCheckingEmail || isCheckingPhone || usernameTaken === null || emailTaken === null)) {
        throw new Error("Validation still in progress or inconclusive. Please ensure all identifiers are checked and available.");
      }
      if (regRole === 'user' && (isCheckingUsername || isCheckingEmail || isCheckingPhone || usernameTaken === null || emailTaken === null || (regPhone.length > 0 && phoneTaken === null))) {
        throw new Error("Validation still in progress or inconclusive. Please ensure all identifiers are checked and available.");
      }
      if (regRole === 'merchant' && email.length === 0 && (isCheckingUsername || isCheckingPhone || usernameTaken === null)) {
        throw new Error("Validation still in progress or inconclusive. Please ensure all identifiers are checked and available.");
      }


      const finalRegPhone = regPhone ? selectedCountry.code + regPhone.replace(/[^0-9]/g, '') : null;

      if (regRole === 'user') {
        const consumerRegData = {
          fullName,
          username,
          email,
          password,
          phone: finalRegPhone,
          role: 'consumer',
          languagePreference,
          home_location: consumerLocality || null, // Add consumer home location
        };
        console.log('[memberJoin] Attempting to register consumer with:', consumerRegData);

        const { user: registeredUser, session } = await userService.registerUser(consumerRegData);

        if (registeredUser) {
          setRegistrationSuccessMessage("Registration Successful. Please log in.");
          setView('login');
        } else {
          throw new Error("Registration failed unexpectedly.");
        }

      } else { // regRole === 'merchant'
        // Client-side validation: Rely on `canSubmit` to disable button for these checks
        if (!isGstValid(gstinValue)) throw new Error('Invalid GSTIN.');
        if (!isPanValid(panValue)) throw new Error('Invalid PAN.');
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

        // 🔐 SECURITY: Encrypt sensitive business data (GST & PAN) before transmission
        const gstEncryptionResult = encryptionService.encryptGST(gstinValue);
        const panEncryptionResult = encryptionService.encryptPAN(panValue);

        if (!gstEncryptionResult.isValid) {
          throw new Error(gstEncryptionResult.error || 'GST encryption failed');
        }
        if (!panEncryptionResult.isValid) {
          throw new Error(panEncryptionResult.error || 'PAN encryption failed');
        }

        // Log sensitive data access for audit compliance
        auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_REGISTRATION', 'GST');
        auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_REGISTRATION', 'PAN');

        const merchantRegData = {
          fullName,
          username,
          email,
          password,
          phone: finalRegPhone,
          role: 'merchant',
          storeName, // Overall store name
          category,
          gstin: gstEncryptionResult.encrypted, // 🔐 Encrypted GST
          pan: panEncryptionResult.encrypted,   // 🔐 Encrypted PAN
          languagePreference,
          stores: merchantStores.map(s => ({
            store_name: s.store_name, // Pass individual store name
            address: s.street,
            pincode: s.pincode,
            locality: s.locality, // Add locality to the payload
            city: s.city,
            state: s.state,
            landmark: s.landmark,
            latitude: s.coords?.latitude || 0,
            longitude: s.coords?.longitude || 0,
            store_hrs: s.is24hrs ? 'Open 24 Hours' : `${s.shift1} - ${s.shift2}`,
          })),
        };
        console.log('[memberJoin] Attempting to register merchant (GST/PAN encrypted):', {
          ...merchantRegData,
          gstin: encryptionService.maskGST(gstinValue), // Show masked version in logs
          pan: encryptionService.maskPAN(panValue)       // Show masked version in logs
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
      setOtpError(err.message || "Registration failed. Please check your inputs.");
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
    if (loading || isCheckingUsername || isCheckingEmail || isCheckingPhone || isCheckingGstin || isCheckingPan) {
      return false; // Always block if any check is in progress
    }
    // CRITICAL FIX: Block if validation is inconclusive (null state)
    // For merchants, email is optional, so emailTaken can be null if email is empty
    if (usernameTaken === null || (regRole === 'user' && regPhone.length > 0 && phoneTaken === null)) {
      return false;
    }
    // For users, email is required and must be validated
    if (regRole === 'user' && emailTaken === null) {
      return false;
    }
    // For merchants, only validate email if it's provided
    if (regRole === 'merchant' && email.length > 0 && emailTaken === null) {
      return false;
    }

    // Basic fields must be filled and valid format
    // For merchants, email is optional
    if (regRole === 'user') {
      if (username.length < 3 || email.length === 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !isValidPassword(password)) {
        return false;
      }
    } else {
      // For merchant, email is optional, so only validate format if provided
      if (username.length < 3 || (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !isValidPassword(password)) {
        return false;
      }
    }
    // Check if identifiers are actually available (not taken)
    if (usernameTaken === true || emailTaken === true || phoneTaken === true || gstinTaken === true || panTaken === true) {
      return false;
    }


    if (regRole === 'user') {
      // For user, phone is optional. If provided, it should meet length requirement and not be taken.
      if (regPhone.length > 0 && regPhone.length < 7) return false;

      // Locality validation: If user started typing locality, all fields must be resolved
      // If consumerLocality is not empty, then pincode, city, and state must also be populated
      if (consumerLocality.trim().length > 0) {
        // User started typing locality, so all related fields must be populated from autocomplete
        if (!consumerPincode || !consumerCity || !consumerState) {
          return false; // Locality not fully resolved
        }
      }

      return true;
    } else { // regRole === 'merchant'
      // Merchant-specific validations
      if (!fullName || !storeName || !category || !gstinValue || !panValue || !regPhone) {
        return false;
      }
      if (!isGstValid(gstinValue)) { // Moved up for earlier feedback
        return false;
      }
      if (!isPanValid(panValue)) { // Moved up for earlier feedback
        return false;
      }
      // Require both Terms of Service and Privacy Policy acceptance
      if (!termsAccepted || !privacyAccepted) {
        return false;
      }
      if (!isPhoneVerified) { // Phone must be verified for merchants
        return false;
      }
      if (merchantStores.length === 0) {
        return false;
      }

      // All stores must be valid, including new pincode and lookup status
      const allStoresValid = merchantStores.every(s =>
        s.store_name.length > 0 && // New validation for store name
        s.street.length > 0 &&
        s.pincode.length === 6 && // Pincode must be 6 digits
        !s.isPincodeSearching && // No active pincode search
        s.city.length > 0 &&
        s.state.length > 0 &&
        s.coords !== null && // GPS coordinates must be resolved
        (s.is24hrs || (s.shift1.length > 0 && s.shift2.length > 0))
      );
      return allStoresValid;
    }
  }, [
    loading, isCheckingUsername, isCheckingEmail, isCheckingPhone, isCheckingGstin, isCheckingPan,
    usernameTaken, emailTaken, phoneTaken, gstinTaken, panTaken,
    username, email, password,
    regRole, fullName, storeName, category, gstinValue, panValue, regPhone,
    isGstValid, isPanValid, isValidPassword, isPhoneVerified, merchantStores,
    consumerLocality, consumerPincode, consumerCity, consumerState,
    termsAccepted, privacyAccepted
  ]);

  const renderRoleSelector = () => (
    <div className="px-8 pt-8 animate-reveal flex flex-col justify-center min-h-screen">
      <div className="w-full text-center mb-12">
        <h2 className={`text-5xl font-black tracking-tighter uppercase leading-none mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('reg_title').split(' ')[0]}<br/>
          <span className="text-yellow-500">{t('reg_title').split(' ').slice(1).join(' ')}</span>
        </h2>
        <p className={`font-medium leading-relaxed mt-6 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
          {t('reg_choose_account') || 'Choose your account type to get started'}
        </p>
      </div>

      <div className="space-y-6">
        {/* Consumer/User Option */}
        <button
          type="button"
          onClick={() => {
            setRegRole('user');
            setShowRoleSelector(false);
          }}
          className="w-full glass border-white/10 dark:border-white/10 border-slate-900/10 hover:border-yellow-500/50 p-8 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-yellow-600/20 flex items-center justify-center group-hover:bg-yellow-600/30 transition-colors">
              <UserIcon className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="flex-1 text-left">
              <h3 className={`text-2xl font-black uppercase tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('reg_consumer')}
              </h3>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
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
          className="w-full glass border-white/10 dark:border-white/10 border-slate-900/10 hover:border-yellow-500/50 p-8 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-yellow-600/20 flex items-center justify-center group-hover:bg-yellow-600/30 transition-colors">
              <Store className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="flex-1 text-left">
              <h3 className={`text-2xl font-black uppercase tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {t('reg_merchant')}
              </h3>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
                {t('reg_merchant_desc') || <>Empower your business with <span className="text-white">Deal</span><span className="text-yellow-500">Pro</span> smart commerce</>}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Back to Login */}
      <div className="mt-12 text-center">
        <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-slate-500' : 'text-slate-800'}`}>
          {t('reg_have_account') || 'Already have an account?'}{' '}
          <button
            onClick={() => setView('login')}
            className={`ml-1 border-b ${isDark ? 'text-white border-white/20' : 'text-yellow-600 border-yellow-600/30'} hover:text-yellow-500 hover:border-yellow-500/50 transition-colors`}
          >
            {t('reg_back_login') || 'Back to Login'}
          </button>
        </p>
      </div>
    </div>
  );

  const renderRegisterForm = () => (
    <div className="px-8 pt-8 animate-reveal flex flex-col">
      <div className="w-full text-left mb-8">
        <h2 className={`text-5xl font-black tracking-tighter uppercase leading-none mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('reg_title').split(' ')[0]}<br/>
          <span className="text-yellow-500">{t('reg_title').split(' ').slice(1).join(' ')}</span>
        </h2>
        <p className={`font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>
          {regRole === 'user' ? 'Join the network to discover local deals.' : <>Empower your business with <span className="text-white">Deal</span><span className="text-yellow-500">Pro</span> smart commerce.</>}
        </p>
      </div>

      {otpError && (
        <div className="mb-6 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>{otpError}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-6 flex-1">
        {/* Basic User Info (Applies to both roles) */}
        <div className="space-y-4">
          <input 
            type="text" 
            placeholder={t('reg_fullname')} 
            className="input-premium" 
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required 
          />
          <div className="relative group">
            <input
              type="text"
              placeholder={t('reg_username')}
              className="input-premium"
              value={username}
              onChange={handleUsernameChange}
              required
            />
            {isCheckingUsername && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
            )}
            {usernameTaken === false && !isCheckingUsername && username.length >= 3 && (
              <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
            )}
            {usernameTaken === true && !isCheckingUsername && (
              <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
            )}
          </div>
          <div className="relative group">
            <input
              type="email"
              placeholder={regRole === 'merchant' ? 'Email Address (Optional)' : t('reg_email')}
              className="input-premium"
              value={email}
              onChange={handleEmailChange}
              required={regRole === 'user'}
            />
            {isCheckingEmail && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
            )}
            {emailTaken === false && !isCheckingEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
              <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
            )}
            {emailTaken === true && !isCheckingEmail && (
              <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
            )}
          </div>
          <div className="relative flex group">
             {/* Country Code Picker */}
             <div className={`relative ${showCountryPicker ? 'z-[1000]' : ''}`}>
                <button 
                   type="button" 
                   onClick={() => setShowCountryPicker(!showCountryPicker)} 
                   className="h-14 w-20 glass rounded-l-2xl border-white/10 flex items-center justify-center gap-1 active:scale-95 transition-all focus:outline-none"
                >
                   <span className="text-lg">{selectedCountry.flag}</span>
                   <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
                {showCountryPicker && (
                   <div className="absolute top-full left-0 mt-2 w-48 glass rounded-2xl p-2 z-[999] shadow-2xl animate-reveal border-white/10">
                      <div className="max-h-48 overflow-y-auto hide-scrollbar">
                         {COUNTRY_CODES.map(c => (
                            <button 
                               key={c.code} 
                               type="button" 
                               onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); }} 
                               className="w-full text-left p-3 hover:bg-blue-500/10 rounded-xl text-xs font-bold flex gap-3 items-center"
                            >
                               <span>{c.flag}</span> <span className="flex-1 text-slate-200">{c.country}</span> <span className="text-slate-500">{c.code}</span>
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
                   placeholder={getPhonePlaceholder()}
                   className="input-premium flex-1 rounded-l-none"
                   value={formatPhoneNumber(regPhone, selectedCountry.code)}
                   onChange={handleRegPhoneChange}
                   maxLength={selectedCountry.code === '+91' ? 10 : 15}
                   required={regRole === 'merchant'}
                 />
                 {regRole === 'user' && isCheckingPhone && (
                   <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />
                 )}
                 {regRole === 'user' && phoneTaken === false && !isCheckingPhone && regPhone.length >= 7 && (
                   <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                 )}
                 {regRole === 'user' && phoneTaken === true && !isCheckingPhone && (
                   <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                 )}
                 {regRole === 'merchant' && regPhone.length > 5 && !isPhoneVerified && (
                   <button
                     type="button"
                     onClick={handleSendOtp}
                     disabled={isSendingOtp}
                     className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center active:scale-90 transition-all"
                   >
                     {isSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   </button>
                 )}
                 {regRole === 'merchant' && isPhoneVerified && regPhone.length > 0 && (
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                     <CheckCircle2 className="w-5 h-5" />
                   </div>
                 )}
             </div>
          </div>
          <div className="relative group">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={t('reg_password')}
              className="input-premium pr-14"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-500 transition-colors">
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Consumer Locality Field - Only for user role */}
          {regRole === 'user' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Locality / Area (type to search)"
                className="input-premium"
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
                <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                  {consumerLocalitySuggestions.map((locality) => {
                    const displayName = locality.display_name || locality.names[locale] || locality.names.en;
                    return (
                      <div
                        key={locality.id}
                        className="px-4 py-3 hover:bg-blue-600/20 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleConsumerLocalitySelect(locality);
                        }}
                      >
                        <div className="text-sm font-medium text-white">{displayName}</div>
                        <div className="text-xs text-slate-400 mt-0.5">Pincode: {locality.pincode}</div>
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

          <div className="relative group">
            <select
              value={languagePreference}
              onChange={(e) => setLanguagePreference(e.target.value)}
              className="input-premium"
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
          <div className="space-y-6 animate-reveal">
            {/* Overall Store Name for Merchant Profile, not individual store blocks */}
            <input 
              type="text" 
              placeholder={t('reg_brand')} 
              className="input-premium" 
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required 
            />
            <div className="relative group">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-premium"
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
              <div key={index} className="glass p-5 rounded-[2rem] border-white/5 space-y-4 relative bg-slate-900/40">
                {merchantStores.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => handleRemoveStore(index)} 
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">
                  {t('reg_locations')} {index + 1}
                </p>
                {/* NEW: Store Name for this specific address block */}
                <input 
                  type="text" 
                  placeholder={t('reg_store_name_label')} 
                  className="input-premium" 
                  value={store.store_name}
                  onChange={(e) => handleStoreChange(index, 'store_name', e.target.value)}
                  required 
                />
                <input 
                  type="text" 
                  placeholder={t('reg_street')} 
                  className="input-premium" 
                  value={store.street}
                  onChange={(e) => handleStoreChange(index, 'street', e.target.value)}
                  required 
                />

                {/* Locality input with autocomplete */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Locality / Area (type to search)"
                    className="input-premium"
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
                    <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                      {localitySuggestions[index].map((locality) => {
                        const displayName = locality.display_name || locality.names[locale] || locality.names.en;
                        return (
                          <div
                            key={locality.id}
                            className="px-4 py-3 hover:bg-blue-600/20 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                            onMouseDown={(e) => {
                              e.preventDefault(); // Prevent onBlur from hiding dropdown before click
                              handleSelectLocality(index, locality);
                            }}
                          >
                            <div className="text-sm font-medium text-white">{displayName}</div>
                            <div className="text-xs text-slate-400 mt-0.5">Pincode: {locality.pincode}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pincode input */}
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="Pincode"
                    className="input-premium"
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
                  className="input-premium"
                  value={store.city}
                  onChange={(e) => handleStoreChange(index, 'city', e.target.value)}
                  required
                  readOnly={store.pincode.length === 6 && !!store.city && !store.isPincodeSearching}
                  disabled={store.pincode.length === 6 && !!store.city && !store.isPincodeSearching}
                />
                <input 
                  type="text" 
                  placeholder={t('reg_state')} 
                  className="input-premium" 
                  value={store.state}
                  onChange={(e) => handleStoreChange(index, 'state', e.target.value)}
                  required 
                  readOnly={store.pincode.length === 6 && !!store.state && !store.isPincodeSearching}
                  disabled={store.pincode.length === 6 && !!store.state && !store.isPincodeSearching}
                />
                <input 
                  type="text" 
                  placeholder={t('reg_landmark')} 
                  className="input-premium" 
                  value={store.landmark}
                  onChange={(e) => handleStoreChange(index, 'landmark', e.target.value)}
                />

                <div className="flex items-center justify-between glass p-4 rounded-xl border-white/5">
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-3">
                      {store.isGeocoding ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                      ) : store.coords ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <MapPin className="w-5 h-5 text-slate-500" />
                      )}
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                        {store.coords ? t('reg_sync_verified') : t('loc_awaiting')}
                      </span>
                    </div>
                    {/* Display Lat/Long values */}
                    {store.coords && (
                      <p className="text-[9px] font-mono text-slate-400 mt-1 pl-8">
                        Lat: {store.coords.latitude.toFixed(4)}, Lng: {store.coords.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleGetGpsForStore(index)}
                    disabled={store.isGeocoding}
                    className="text-blue-500 text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50"
                  >
                    <Navigation className="w-4 h-4 inline-block mr-2" />{t('reg_use_my_loc')}
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
                    <div className="grid grid-cols-2 gap-4">
                      <select 
                        value={store.shift1} 
                        onChange={(e) => handleStoreChange(index, 'shift1', e.target.value)}
                        className="input-premium text-xs"
                      >
                        <option value="">{t('reg_opens')}</option>
                        {SHIFT1_OPTIONS.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                      <select 
                        value={store.shift2} 
                        onChange={(e) => handleStoreChange(index, 'shift2', e.target.value)}
                        className="input-premium text-xs"
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
              className="w-full glass p-4 rounded-xl border-blue-500/20 bg-blue-500/5 text-blue-500 flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-widest">{t('reg_add_outlet')}</span>
            </button>

            {/* GSTIN Input with Validate Button */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={t('reg_gstin')}
                    className={`input-premium ${
                      gstinTaken === true ? 'border-rose-500' :
                      gstinTaken === false && gstinValidated === true ? 'border-emerald-500' :
                      gstinValidated === false ? 'border-rose-500' :
                      gstinValidated === true ? 'border-emerald-500' :
                      gstinValue.length > 0 && !isGstValid(gstinValue) ? 'border-rose-500' : ''
                    }`}
                    value={gstinValue}
                    onChange={handleGstinChange}
                    required
                  />
                  {isCheckingGstin && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
                  )}
                  {!isCheckingGstin && gstinTaken === true && (
                    <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                  )}
                  {!isCheckingGstin && gstinValidated === false && gstinTaken !== true && (
                    <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                  )}
                  {!isCheckingGstin && gstinValidated === true && gstinTaken === false && (
                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleValidateGstin}
                  disabled={!gstinValue || gstinValue.length === 0 || !isGstValid(gstinValue)}
                  className="px-4 py-3 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-500 font-black text-xs uppercase tracking-wider hover:bg-amber-600/30 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Validate
                </button>
              </div>
              {gstinTaken === true && (
                <p className="text-rose-500 text-[10px] font-bold mt-1 ml-1">✗ GSTIN already registered</p>
              )}
              {gstinValidated === true && gstinTaken === false && (
                <p className="text-emerald-500 text-[10px] font-bold mt-1 ml-1">✓ Valid GSTIN format and available</p>
              )}
            </div>

            {/* PAN Input with Validate Button */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder={t('reg_pan')}
                    className={`input-premium ${
                      panTaken === true ? 'border-rose-500' :
                      panTaken === false && panValidated === true ? 'border-emerald-500' :
                      panValidated === false ? 'border-rose-500' :
                      panValidated === true ? 'border-emerald-500' :
                      panValue.length > 0 && !isPanValid(panValue) ? 'border-rose-500' : ''
                    }`}
                    value={panValue}
                    onChange={handlePanChange}
                    required
                  />
                  {isCheckingPan && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
                  )}
                  {!isCheckingPan && panTaken === true && (
                    <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                  )}
                  {!isCheckingPan && panValidated === false && panTaken !== true && (
                    <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
                  )}
                  {!isCheckingPan && panValidated === true && panTaken === false && (
                    <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleValidatePan}
                  disabled={!panValue || panValue.length === 0 || !isPanValid(panValue)}
                  className="px-4 py-3 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-500 font-black text-xs uppercase tracking-wider hover:bg-amber-600/30 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Validate
                </button>
              </div>
              {panTaken === true && (
                <p className="text-rose-500 text-[10px] font-bold mt-1 ml-1">✗ PAN already registered</p>
              )}
              {panValidated === true && panTaken === false && (
                <p className="text-emerald-500 text-[10px] font-bold mt-1 ml-1">✓ Valid PAN format and available</p>
              )}
            </div>
            {panValue.length > 0 && !isPanValid(panValue) && (
              <ShieldAlert className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />
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
                      ? 'accent-emerald-500 bg-emerald-500 border-emerald-500 opacity-100 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20'
                      : 'accent-slate-600 bg-slate-900/50 border-white/20 opacity-40'
                  }`}
                />
                <label className="text-sm text-white/80 select-none">
                  I have read and accept the{' '}
                  <button
                    type="button"
                    onClick={() => setView('terms_of_service_signup')}
                    className="text-amber-500 underline hover:text-amber-400 transition-colors"
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
                      ? 'accent-emerald-500 bg-emerald-500 border-emerald-500 opacity-100 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20'
                      : 'accent-slate-600 bg-slate-900/50 border-white/20 opacity-40'
                  }`}
                />
                <label className="text-sm text-white/80 select-none">
                  I have read and accept the{' '}
                  <button
                    type="button"
                    onClick={() => setView('privacy_policy_signup')}
                    className="text-amber-500 underline hover:text-amber-400 transition-colors"
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
          className="w-full btn-premium bg-amber-600 shadow-2xl shadow-amber-500/20 active:scale-[0.98] transition-all mt-6 disabled:opacity-30 disabled:shadow-none"
        >
          {loading ? <Loader2 className="animate-spin w-6 h-6" /> : t('reg_submit')}
        </button>
      </form>

      <div className="mt-8 text-center space-y-4 pb-20">
        <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-slate-500' : 'text-slate-800'}`}>
          {t('reg_have_account') || 'Already have an account?'}{' '}
          <button onClick={() => setView('login')} className={`ml-1 border-b ${isDark ? 'text-white border-white/20' : 'text-yellow-600 border-yellow-600/30'} hover:text-yellow-500 hover:border-yellow-500/50 transition-colors`}>
            {t('reg_back_login') || 'Back to Login'}
          </button>
        </p>
      </div>
    </div>
  );

  return showRoleSelector ? renderRoleSelector() : renderRegisterForm();
};