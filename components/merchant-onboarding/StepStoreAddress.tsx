import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Loader2, Navigation, Clock, CheckCircle2, Phone, Truck } from 'lucide-react';
import { StoreLocation } from '../../types';
import { locationsearchService } from '../../services/locationsearchService';
import { addCampaignService } from '../../services/addCampaignService';
import { Geolocation } from '@capacitor/geolocation';
import { floatIn } from './floatIn';

const FALLBACK_CATEGORIES = [
  'Grocery', 'Restaurant', 'Electronics', 'Fashion', 'Beauty',
  'Health', 'Books', 'Home', 'Automotive', 'Tires',
  'Sports', 'Jewellery', 'Toys', 'Furniture', 'General',
];

const SHIFT1_OPTIONS = [
  '5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM'
];
const SHIFT2_OPTIONS = [
  '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM', '12:00 AM', '1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM'
];

interface StepStoreAddressProps {
  store: StoreLocation;
  storeIndex: number;
  totalStores: number;
  brandName: string;
  onChange: (field: keyof StoreLocation, value: any) => void;
  onNext: () => void;
  onBack?: () => void;
  theme: 'light' | 'dark';
}

export const StepStoreAddress: React.FC<StepStoreAddressProps> = ({
  store, storeIndex, totalStores, brandName, onChange, onNext, onBack, theme
}) => {
  const isDark = theme === 'dark';
  const [localityResults, setLocalityResults] = useState<any[]>([]);
  const [showLocalityDropdown, setShowLocalityDropdown] = useState(false);
  const [visible, setVisible] = useState(false);
  const [storeCategories, setStoreCategories] = useState<string[]>(FALLBACK_CATEGORIES);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    addCampaignService.getStoreCategories()
      .then((cats) => { if (cats.length > 0) setStoreCategories(cats); })
      .catch(() => { /* keep fallback */ });
  }, []);

  // Auto-populate store name with brand name if empty
  useEffect(() => {
    if (!store.store_name && brandName) {
      onChange('store_name', brandName);
    }
  }, []);
  const [localitySearch, setLocalitySearch] = useState(store.locality || '');
  const localityDebounceRef = useRef<number | null>(null);
  const pincodeDebounceRef = useRef<number | null>(null);

  const inputClass = `w-full h-12 px-4 rounded-xl text-sm font-medium outline-none transition-all border ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
  }`;

  const labelClass = `text-xs font-semibold mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  // Pincode auto-resolve
  const handlePincodeChange = useCallback((val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    onChange('pincode', digits);
    onChange('city', '');
    onChange('state', '');
    onChange('coords', null);

    if (digits.length === 6) {
      if (pincodeDebounceRef.current) clearTimeout(pincodeDebounceRef.current);
      onChange('isPincodeSearching', true);
      pincodeDebounceRef.current = setTimeout(async () => {
        try {
          const result = await locationsearchService.lookupPincode(digits);
          if (result) {
            const cityName = result.city?.names?.en || '';
            const stateName = result.stateId ? getStateName(result.stateId) : '';
            const localityName = result.locality?.names?.en || '';

            onChange('city', cityName);
            onChange('state', stateName);
            onChange('locality', localityName);
            setLocalitySearch(localityName);

            // Auto-set coords from DB if available (no extra geocoding call needed)
            if (result.locality?.latitude && result.locality?.longitude) {
              const dbCoords = { latitude: result.locality.latitude, longitude: result.locality.longitude };
              onChange('coords', dbCoords);

              // If locality name is missing from DB, reverse-geocode the coords to get it
              if (!localityName) {
                locationsearchService.reverseGeocodeCoordinates(dbCoords.latitude, dbCoords.longitude).then((geo) => {
                  if (geo?.locality) {
                    onChange('locality', geo.locality);
                    setLocalitySearch(geo.locality);
                  }
                }).catch(() => {});
              }
            } else {
              // Silently geocode from pincode in background, then reverse-geocode for locality if needed
              locationsearchService.geocodePincode(digits).then((coords) => {
                if (coords) {
                  onChange('coords', coords);
                  // Use the resolved coords to get locality if still missing
                  if (!localityName) {
                    locationsearchService.reverseGeocodeCoordinates(coords.latitude, coords.longitude).then((geo) => {
                      if (geo?.locality) {
                        onChange('locality', geo.locality);
                        setLocalitySearch(geo.locality);
                      }
                    }).catch(() => {});
                  }
                }
              }).catch(() => {});
            }
          }
        } catch (err) {
          console.error('[StoreAddress] Pincode lookup failed:', err);
          // Fallback: geocode pincode for coords, then reverse-geocode for city/state/locality
          locationsearchService.geocodePincode(digits).then((coords) => {
            if (coords) {
              onChange('coords', coords);
              locationsearchService.reverseGeocodeCoordinates(coords.latitude, coords.longitude).then((geo) => {
                if (geo) {
                  onChange('city', geo.city);
                  onChange('state', geo.state);
                  if (geo.locality) {
                    onChange('locality', geo.locality);
                    setLocalitySearch(geo.locality);
                  }
                }
              }).catch(() => {});
            }
          }).catch(() => {});
        } finally {
          onChange('isPincodeSearching', false);
        }
      }, 800) as unknown as number;
    }
  }, [onChange]);

  // Locality autocomplete
  const handleLocalitySearch = useCallback((val: string) => {
    setLocalitySearch(val);
    onChange('locality', val);

    if (val.length >= 2 && store.city) {
      if (localityDebounceRef.current) clearTimeout(localityDebounceRef.current);
      localityDebounceRef.current = setTimeout(async () => {
        try {
          const results = await locationsearchService.searchLocalities(val, 'en');
          setLocalityResults(results || []);
          setShowLocalityDropdown((results || []).length > 0);
        } catch {
          setLocalityResults([]);
        }
      }, 300) as unknown as number;
    } else {
      setLocalityResults([]);
      setShowLocalityDropdown(false);
    }
  }, [store.city, onChange]);

  const selectLocality = (loc: any) => {
    const name = loc.names?.en || loc.display_name || loc;
    setLocalitySearch(name);
    onChange('locality', name);
    setShowLocalityDropdown(false);
  };

  // Resolve coordinates from store address fields, fallback to device GPS
  const handleGetLocation = async () => {
    onChange('isGeocoding', true);
    try {
      const hasAddress = store.city || store.pincode;
      if (hasAddress) {
        let coords = null;

        // Try full address first
        const addrParts = [store.store_name || brandName, store.street, store.locality, store.city, store.state, store.pincode].filter(Boolean).join(', ');
        if (addrParts) {
          coords = await locationsearchService.geocodeAddressWithAI(`${addrParts}, India`);
        }

        // Fallback: structured pincode geocoding
        if (!coords && store.pincode?.length === 6) {
          coords = await locationsearchService.geocodePincode(store.pincode);
        }

        // Fallback: just city + state
        if (!coords && store.city) {
          coords = await locationsearchService.geocodeAddressWithAI(`${store.city}, ${store.state}, India`);
        }

        if (coords) {
          onChange('coords', coords);
          onChange('isGeocoding', false);
          return;
        }
      }

      // Last resort: use device GPS
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      onChange('coords', { latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (e) {
      console.error('[StoreAddress] GPS/geocoding error:', e);
    } finally {
      onChange('isGeocoding', false);
    }
  };

  // Auto-refine GPS when street is added (upgrades pincode-level coords to street-level)
  useEffect(() => {
    if (store.street && store.city && store.state && store.pincode && !store.isGeocoding) {
      const fullAddress = `${store.store_name || brandName}, ${store.street}, ${store.locality}, ${store.city}, ${store.state}, ${store.pincode}, India`;
      onChange('isGeocoding', true);
      locationsearchService.geocodeAddressWithAI(fullAddress)
        .then((coords) => {
          if (coords) onChange('coords', coords);
        })
        .catch(() => {})
        .finally(() => onChange('isGeocoding', false));
    }
  }, [store.street]);

  // Strip non-digit chars for validation (allow +, -, spaces in display)
  const phoneDigits = (store.store_phone || '').replace(/\D/g, '');
  const phoneAltDigits = (store.store_phone_alt || '').replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length === 10;
  const isPhoneAltValid = !store.store_phone_alt?.trim() || phoneAltDigits.length === 10;

  const isValid = !!(
    store.store_name?.trim() &&
    store.store_category &&
    store.street?.trim() &&
    store.pincode?.length === 6 &&
    store.city &&
    store.state &&
    isPhoneValid &&
    isPhoneAltValid &&
    (store.is24hrs || (store.shift1 && store.shift2))
  );

  return (
    <div className="flex flex-col min-h-full px-6 pt-5">
      <div style={floatIn(0, visible)} className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <MapPin className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Store address
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Store {storeIndex + 1}{totalStores > 1 ? ` of ${totalStores}` : ''}
          </p>
        </div>
      </div>

      <div style={floatIn(150, visible)} className="space-y-4 pb-4">
        {/* Branch Name */}
        <div>
          <label className={labelClass}>Branch / Location Name</label>
          <input
            value={store.store_name}
            onChange={(e) => onChange('store_name', e.target.value)}
            placeholder={brandName || 'e.g. Main Branch'}
            className={inputClass}
          />
        </div>

        {/* Store Category */}
        <div>
          <label className={labelClass}>Store Category *</label>
          <select
            value={store.store_category}
            onChange={(e) => onChange('store_category', e.target.value)}
            className={`${inputClass} ${!store.store_category ? (isDark ? 'text-slate-500' : 'text-slate-400') : ''}`}
          >
            <option value="">Select category</option>
            {storeCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Street */}
        <div>
          <label className={labelClass}>Street Address *</label>
          <input
            value={store.street}
            onChange={(e) => onChange('street', e.target.value)}
            placeholder="Street address, building, floor"
            className={inputClass}
          />
        </div>

        {/* Pincode */}
        <div>
          <label className={labelClass}>Pincode *</label>
          <div className="relative">
            <input
              value={store.pincode}
              onChange={(e) => handlePincodeChange(e.target.value)}
              placeholder="6-digit pincode"
              inputMode="numeric"
              maxLength={6}
              className={inputClass}
            />
            {store.isPincodeSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
            )}
            {store.city && !store.isPincodeSearching && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            )}
          </div>
          {store.pincode && store.pincode.length > 0 && store.pincode.length < 6 && (
            <p className="text-xs text-amber-500 mt-1">Enter all 6 digits to continue</p>
          )}
        </div>

        {/* City & State (auto-filled) */}
        {store.city && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>City</label>
              <input value={store.city} readOnly className={`${inputClass} opacity-60`} />
            </div>
            <div>
              <label className={labelClass}>State</label>
              <input value={store.state} readOnly className={`${inputClass} opacity-60`} />
            </div>
          </div>
        )}

        {/* Locality */}
        <div className="relative">
          <label className={labelClass}>Locality / Area</label>
          <input
            value={localitySearch}
            onChange={(e) => {
              setLocalitySearch(e.target.value);
              onChange('locality', e.target.value);
            }}
            placeholder="Auto-filled from pincode or type manually"
            className={inputClass}
          />
          {showLocalityDropdown && (
            <div className={`absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border max-h-40 overflow-y-auto ${
              isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}>
              {localityResults.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => selectLocality(loc)}
                  className={`w-full text-left px-4 py-2.5 text-sm ${
                    isDark ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {loc.names?.en || loc.display_name || loc}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Landmark */}
        <div>
          <label className={labelClass}>Landmark (optional)</label>
          <input
            value={store.landmark}
            onChange={(e) => onChange('landmark', e.target.value)}
            placeholder="Near famous place, etc."
            className={inputClass}
          />
        </div>

        {/* Store Phone Numbers */}
        <div>
          <label className={`${labelClass} flex items-center gap-2`}>
            <Phone className="w-3.5 h-3.5" /> Store Phone Number
          </label>
          <input
            value={store.store_phone || ''}
            onChange={(e) => onChange('store_phone', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="e.g. 9876543210"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            className={inputClass}
          />
          {store.store_phone && !isPhoneValid && (
            <p className="text-[11px] text-red-500 mt-1">Phone number must be 10 digits</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Alternate Phone Number (optional)</label>
          <input
            value={store.store_phone_alt || ''}
            onChange={(e) => onChange('store_phone_alt', e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="e.g. 9876543210 (optional)"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            className={inputClass}
          />
          {store.store_phone_alt && !isPhoneAltValid && (
            <p className="text-[11px] text-red-500 mt-1">Phone number must be 10 digits</p>
          )}
        </div>

        {/* Delivery Option (optional) */}
        <div>
          <label className={`${labelClass} flex items-center gap-2`}>
            <Truck className="w-3.5 h-3.5" /> Delivery
            <span className={`text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(optional)</span>
          </label>
          <label className={`flex items-center gap-2 mb-3 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <input
              type="checkbox"
              checked={store.delivers || false}
              onChange={(e) => {
                onChange('delivers', e.target.checked);
                if (!e.target.checked) onChange('delivery_radius_km', null);
              }}
              className="w-4 h-4 rounded accent-slate-900"
            />
            <span className="text-sm">We deliver to customers</span>
          </label>
          {store.delivers && (
            <div>
              <label className={labelClass}>
                Delivery Range
                <span className={`ml-1.5 text-[10px] font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(optional)</span>
              </label>
              <select
                value={store.delivery_radius_km ?? ''}
                onChange={(e) => onChange('delivery_radius_km', e.target.value ? Number(e.target.value) : null)}
                className={inputClass}
              >
                <option value="">Select range (optional)</option>
                <option value="1">1 km</option>
                <option value="2">2 km</option>
                <option value="3">3 km</option>
                <option value="4">4 km</option>
                <option value="5">5 km</option>
                <option value="10">Anywhere within city limits</option>
              </select>
              <div className={`mt-3 flex items-start gap-2.5 p-2.5 rounded-lg border ${
                isDark ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/60 border-emerald-200'
              }`}>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                  isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'
                }`}>
                  <Truck className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    Customers will see "Delivery available" on your deals
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Delivered by you or your delivery partner; DealPro is not liable.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GPS */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGetLocation}
            disabled={store.isGeocoding}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {store.isGeocoding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            {store.city || store.pincode ? 'Resolve from Address' : 'Use My Location'}
          </button>
          {store.coords && (
            <span className="text-xs text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {store.coords.latitude.toFixed(4)}, {store.coords.longitude.toFixed(4)}
            </span>
          )}
        </div>

        {/* Store Hours */}
        <div>
          <label className={`${labelClass} flex items-center gap-2`}>
            <Clock className="w-3.5 h-3.5" /> Store Hours
          </label>
          <label className={`flex items-center gap-2 mb-3 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <input
              type="checkbox"
              checked={store.is24hrs}
              onChange={(e) => onChange('is24hrs', e.target.checked)}
              className="w-4 h-4 rounded accent-slate-900"
            />
            <span className="text-sm">Open 24 Hours</span>
          </label>
          {!store.is24hrs && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Opens at</label>
                <select
                  value={store.shift1}
                  onChange={(e) => onChange('shift1', e.target.value)}
                  className={inputClass}
                >
                  {SHIFT1_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Closes at</label>
                <select
                  value={store.shift2}
                  onChange={(e) => onChange('shift2', e.target.value)}
                  className={inputClass}
                >
                  {SHIFT2_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={floatIn(300, visible)} className="mt-auto pb-safe-bottom pt-4 flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// Helper to get state name from ID — simplified, the locationsearchService handles the actual mapping
function getStateName(stateId: number): string {
  const stateMap: Record<number, string> = {
    1: 'Andhra Pradesh', 2: 'Arunachal Pradesh', 3: 'Assam', 4: 'Bihar',
    5: 'Chhattisgarh', 6: 'Goa', 7: 'Gujarat', 8: 'Haryana',
    9: 'Himachal Pradesh', 10: 'Jharkhand', 11: 'Karnataka', 12: 'Kerala',
    13: 'Madhya Pradesh', 14: 'Maharashtra', 15: 'Manipur', 16: 'Meghalaya',
    17: 'Mizoram', 18: 'Nagaland', 19: 'Odisha', 20: 'Punjab',
    21: 'Rajasthan', 22: 'Sikkim', 23: 'Tamil Nadu', 24: 'Telangana',
    25: 'Tripura', 26: 'Uttar Pradesh', 27: 'Uttarakhand', 28: 'West Bengal',
    29: 'Delhi',
  };
  return stateMap[stateId] || '';
}
