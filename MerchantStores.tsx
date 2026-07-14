
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, MapPin, Plus, Edit2, X, Loader2, CheckCircle2,
  Clock, Navigation, ChevronDown, Store, Trash2, AlertTriangle, Phone, Truck,
} from 'lucide-react';
import { AppView, MerchantStore, User } from './types';
import { merchantService } from './services/merchantService';
import { locationsearchService } from './services/locationsearchService';
import { addCampaignService } from './services/addCampaignService';
import { resilient } from './services/resilientData';
import { useResumeRefetch } from './services/useResumeRefetch';
import { useTranslation } from './contexts/LanguageContext';

const SHIFT1_OPTIONS = [
  '5:00 AM','5:30 AM','6:00 AM','6:30 AM','7:00 AM','7:30 AM',
  '8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM',
  '11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM',
];

const SHIFT2_OPTIONS = [
  '2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM',
  '5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM','7:30 PM',
  '8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM',
  '11:00 PM','11:30 PM','12:00 AM','12:30 AM','1:00 AM','1:30 AM',
  '2:00 AM','2:30 AM','3:00 AM','3:30 AM','4:00 AM',
];

const FALLBACK_CATEGORIES = [
  'Grocery', 'Restaurant', 'Electronics', 'Fashion', 'Beauty',
  'Health', 'Books', 'Home', 'Automotive', 'Tires',
  'Sports', 'Jewellery', 'Toys', 'Furniture', 'General',
];

interface StoreForm {
  store_name: string;
  address: string;
  landmark: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number;
  longitude: number;
  shift1: string;
  shift2: string;
  is24hrs: boolean;
  store_category: string;
  store_phone: string;
  store_phone_alt: string;
  delivers: boolean;
  delivery_radius_km: number | null;
}

const blankForm = (): StoreForm => ({
  store_name: '', address: '', landmark: '', locality: '',
  city: '', state: '', pincode: '',
  latitude: 0, longitude: 0,
  shift1: '9:00 AM', shift2: '10:00 PM', is24hrs: false,
  store_category: '', store_phone: '', store_phone_alt: '',
  delivers: false, delivery_radius_km: null,
});

function parseStoreHrs(hrs?: string): { shift1: string; shift2: string; is24hrs: boolean } {
  if (!hrs) return { shift1: '9:00 AM', shift2: '10:00 PM', is24hrs: false };
  if (hrs === '24 Hours') return { shift1: '', shift2: '', is24hrs: true };
  const parts = hrs.split(' - ');
  return { shift1: parts[0] || '9:00 AM', shift2: parts[1] || '10:00 PM', is24hrs: false };
}

function buildStoreHrs(form: StoreForm): string {
  if (form.is24hrs) return '24 Hours';
  return `${form.shift1} - ${form.shift2}`;
}

interface Props {
  user: User;
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
  forceAddMode?: boolean;
  onFirstStoreAdded?: () => void;
  onStoreCountChange?: (count: number) => void;
}

export const MerchantStores: React.FC<Props> = ({ user, setView, theme, forceAddMode = false, onFirstStoreAdded, onStoreCountChange }) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreForm>(blankForm());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  // Pincode autocomplete — suggestions from the pincode_directory table (>=3 digits),
  // same UX as the signup wizard's store-address step.
  const [pincodeResults, setPincodeResults] = useState<Array<{ pincode: string; locality: string; city: string | null; state: string | null }>>([]);
  const [showPincodeDropdown, setShowPincodeDropdown] = useState(false);
  const pincodeSuggestRef = useRef<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [storeCategories, setStoreCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch stores on mount. Force a FRESH fetch (bypass the 1-hour cache) so a
  // store just added during onboarding always shows here — the cache could
  // otherwise display a stale count (e.g. 1 of 4). This also refreshes the cache.
  const loadStores = useCallback(async () => {
    try {
      // Resilient: retries + falls back to last-good cache, so a resume-time
      // blip can't blank the stores list. Still force-fresh on the happy path.
      const data = await resilient(
        () => merchantService.getMerchantStores(user.id, true),
        { cacheKey: `stores_page_${user.id}` },
      );
      setStores(data);
      const activeCount = data.filter(s => s.active_status !== 'disabled').length;
      onStoreCountChange?.(activeCount);
      if (forceAddMode && activeCount === 0) {
        setForm(blankForm());
        setEditingStoreId(null);
        setShowPanel(true);
        setError(null);
      }
    } catch {
      /* keep last-good stores */
    } finally {
      setLoadingStores(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => { loadStores(); }, [loadStores]);
  useResumeRefetch(loadStores);

  // Fetch store categories
  useEffect(() => {
    addCampaignService.getStoreCategories()
      .then(cats => { if (cats.length > 0) setStoreCategories(cats); })
      .catch(() => {});
  }, []);

  const openAddStore = () => {
    setForm(blankForm());
    setEditingStoreId(null);
    setShowPanel(true);
    setError(null);
  };

  const openEditStore = (store: MerchantStore) => {
    const hrs = parseStoreHrs(store.store_hrs);
    setForm({
      store_name: store.store_name,
      address: store.address,
      landmark: store.landmark || '',
      locality: store.locality || '',
      city: store.city,
      state: store.state,
      pincode: store.pincode || '',
      latitude: store.latitude,
      longitude: store.longitude,
      shift1: hrs.shift1,
      shift2: hrs.shift2,
      is24hrs: hrs.is24hrs,
      store_category: store.store_category || '',
      store_phone: store.store_phone || '',
      store_phone_alt: store.store_phone_alt || '',
      delivers: store.delivers || false,
      delivery_radius_km: store.delivery_radius_km ?? null,
    });
    setEditingStoreId(store.id || null);
    setShowPanel(true);
    setError(null);
  };

  const closePanel = () => {
    setShowPanel(false);
    setEditingStoreId(null);
    setError(null);
  };

  const handleDeleteStore = async (storeId: string) => {
    setDeleting(true);
    try {
      await merchantService.deleteStore(user.id, storeId);
      // Soft delete: mark disabled locally so it moves to the deleted section immediately
      const updated = stores.map(s => s.id === storeId ? { ...s, active_status: 'disabled' } : s);
      setStores(updated);
      const activeCount = updated.filter(s => s.active_status !== 'disabled').length;
      onStoreCountChange?.(activeCount);
      setDeletingStoreId(null);
    } catch (err: any) {
      setError('Unable to delete store. Please try again.');
      setDeletingStoreId(null);
    } finally {
      setDeleting(false);
    }
  };

  // Auto-geocode when address + city are available and coords are still 0,0
  const autoGeocode = useCallback(async (address: string, locality: string, city: string, state: string, pincode: string) => {
    if (!address || !city) return;
    const addr = [address, locality, city, state, pincode].filter(Boolean).join(', ');
    try {
      const coords = await locationsearchService.geocodeAddressWithAI(addr);
      if (coords) {
        setForm(f => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
      }
    } catch {}
  }, []);

  // Pincode auto-resolve — uses DB lookup first, then Nominatim as fallback
  // Also silently auto-resolves coordinates so merchant doesn't need to click GPS button
  const handlePincodeChange = useCallback(async (pincode: string) => {
    setForm(f => ({ ...f, pincode }));

    // Autocomplete: once 3+ digits are typed, suggest matching pincodes + areas.
    // Debounced; a no-op if the pincode_directory table has no matches.
    if (pincode.length >= 3) {
      if (pincodeSuggestRef.current) clearTimeout(pincodeSuggestRef.current);
      pincodeSuggestRef.current = setTimeout(async () => {
        const rows = await locationsearchService.searchPincodePrefix(pincode);
        setPincodeResults(rows);
        setShowPincodeDropdown(rows.length > 0);
      }, 250) as unknown as number;
    } else {
      setPincodeResults([]);
      setShowPincodeDropdown(false);
    }

    if (pincode.length === 6) {
      setPincodeLoading(true);
      try {
        // Try DB lookup first (has structured locality data + cached coordinates)
        const dbResult = await locationsearchService.lookupPincode(pincode);
        if (dbResult) {
          const localityName = dbResult.locality?.names?.en || '';
          const cityName = dbResult.city?.names?.en || '';
          setForm(f => ({
            ...f,
            city: cityName || f.city,
            locality: localityName || f.locality,
          }));

          // Auto-set coords from DB if available (instant, no extra API call)
          if (dbResult.locality?.latitude && dbResult.locality?.longitude) {
            const dbCoords = { latitude: dbResult.locality.latitude!, longitude: dbResult.locality.longitude! };
            setForm(f => ({ ...f, ...dbCoords }));
            // If locality name missing from DB, reverse-geocode coords to get it
            if (!localityName) {
              locationsearchService.reverseGeocodeCoordinates(dbCoords.latitude, dbCoords.longitude).then((geo) => {
                if (geo?.locality) setForm(f => ({ ...f, locality: geo.locality }));
              }).catch(() => {});
            }
          } else {
            // Silently geocode from pincode in background, then reverse-geocode for locality
            locationsearchService.geocodePincode(pincode).then((coords) => {
              if (coords) {
                setForm(f => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
                if (!localityName) {
                  locationsearchService.reverseGeocodeCoordinates(coords.latitude, coords.longitude).then((geo) => {
                    if (geo?.locality) setForm(f => ({ ...f, locality: geo.locality }));
                  }).catch(() => {});
                }
              }
            }).catch(() => {});
          }

          // Fetch state name from stateId
          if (dbResult.stateId) {
            try {
              const states = await locationsearchService.getStates('en');
              const matchedState = states.find(s => s.id === dbResult.stateId);
              if (matchedState) {
                setForm(f => ({ ...f, state: matchedState.names?.en || matchedState.display_name || f.state }));
              }
            } catch {}
          }
        } else {
          // Fallback: Nominatim reverse geocode for city/state
          const geoResult = await locationsearchService.reverseGeocodePincode(pincode);
          if (geoResult) {
            setForm(f => ({
              ...f,
              city: geoResult.city,
              state: geoResult.state,
              locality: geoResult.locality || f.locality,
            }));
          }
          // Silently geocode coordinates from pincode
          locationsearchService.geocodePincode(pincode).then((coords) => {
            if (coords) setForm(f => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
          }).catch(() => {});
        }
      } catch {
        // Last resort: try both in parallel
        Promise.allSettled([
          locationsearchService.reverseGeocodePincode(pincode).then(r => {
            if (r) setForm(f => ({ ...f, city: r.city, state: r.state, locality: r.locality || f.locality }));
          }),
          locationsearchService.geocodePincode(pincode).then(coords => {
            if (coords) setForm(f => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
          }),
        ]);
      }
      setPincodeLoading(false);
    }
  }, []);

  // Merchant picked a pincode suggestion — fill pincode/locality/city/state directly
  // (we already have them, so no lookup round-trip) and resolve coords in the
  // background, since the directory table carries no lat/long.
  const selectPincode = useCallback((row: { pincode: string; locality: string; city: string | null; state: string | null }) => {
    if (pincodeSuggestRef.current) clearTimeout(pincodeSuggestRef.current);
    setShowPincodeDropdown(false);
    setPincodeResults([]);
    setForm(f => ({
      ...f,
      pincode: row.pincode,
      city: row.city || f.city,
      state: row.state || f.state,
      locality: row.locality || f.locality,
    }));
    setPincodeLoading(true);
    locationsearchService.geocodePincode(row.pincode)
      .then((coords) => {
        if (coords) setForm(f => ({ ...f, latitude: coords.latitude, longitude: coords.longitude }));
      })
      .catch(() => {})
      .finally(() => setPincodeLoading(false));
  }, []);

  // Resolve GPS coordinates from store address (pincode/city/locality) or device GPS as fallback
  const handleGetGPS = async () => {
    setGpsLoading(true);
    try {
      // First try: geocode from the address already entered in the form
      const hasAddress = form.city || form.pincode;
      if (hasAddress) {
        let coords = null;

        // Try full address first
        const addrParts = [form.address, form.locality, form.city, form.state, form.pincode].filter(Boolean).join(', ');
        if (addrParts) {
          coords = await locationsearchService.geocodeAddressWithAI(`${addrParts}, India`);
        }

        // Fallback: structured pincode geocoding
        if (!coords && form.pincode.length === 6) {
          coords = await locationsearchService.geocodePincode(form.pincode);
        }

        // Fallback: just city + state
        if (!coords && form.city) {
          coords = await locationsearchService.geocodeAddressWithAI(`${form.city}, ${form.state}, India`);
        }

        if (coords) {
          setForm(f => ({ ...f, latitude: coords!.latitude, longitude: coords!.longitude }));
          setGpsLoading(false);
          return;
        }
      }

      // Last resort: use device GPS (user's current location)
      const deviceCoords = await locationsearchService.getCurrentLocation();
      if (deviceCoords) {
        setForm(f => ({ ...f, latitude: deviceCoords.latitude, longitude: deviceCoords.longitude }));
        const geo = await locationsearchService.reverseGeocodeCoordinates(deviceCoords.latitude, deviceCoords.longitude);
        if (geo) {
          setForm(f => ({ ...f, city: geo.city || f.city, state: geo.state || f.state }));
        }
      }
    } catch {}
    setGpsLoading(false);
  };

  const handleSave = async () => {
    if (!form.address.trim()) { setError(t('m_address_required')); return; }
    if (!form.city.trim()) { setError(t('m_city_required')); return; }
    if (!form.state.trim()) { setError(t('m_state_required')); return; }
    if (!form.store_category) { setError(t('m_category_required')); return; }

    setSaving(true);
    setError(null);

    try {
      const storeHrs = buildStoreHrs(form);

      if (editingStoreId) {
        // Update (address fields only)
        const updated = await merchantService.updateStore(user.id, editingStoreId, {
          store_name: form.store_name,
          address: form.address,
          landmark: form.landmark,
          locality: form.locality,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          latitude: form.latitude,
          longitude: form.longitude,
          store_hrs: storeHrs,
          store_category: form.store_category,
          store_phone: form.store_phone || null,
          store_phone_alt: form.store_phone_alt || null,
          delivers: form.delivers,
          delivery_radius_km: form.delivers ? form.delivery_radius_km : null,
        });
        setStores(prev => prev.map(s => s.id === editingStoreId ? updated : s));
        setSuccess(t('m_store_updated'));
      } else {
        // Add new
        if (!form.store_name.trim()) { setError(t('m_store_name_required')); setSaving(false); return; }
        const added = await merchantService.addStore(user.id, {
          store_name: form.store_name,
          address: form.address,
          landmark: form.landmark,
          locality: form.locality,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          latitude: form.latitude,
          longitude: form.longitude,
          store_hrs: storeHrs,
          store_category: form.store_category,
          store_phone: form.store_phone || null,
          store_phone_alt: form.store_phone_alt || null,
          delivers: form.delivers,
          delivery_radius_km: form.delivers ? form.delivery_radius_km : null,
        });
        const newCount = stores.length + 1;
        setStores(prev => [...prev, added]);
        onStoreCountChange?.(newCount);
        setSuccess(t('m_store_added'));
        if (forceAddMode) onFirstStoreAdded?.();
      }
      closePanel();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Unable to save store. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = `w-full h-12 px-4 rounded-lg text-sm outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
      : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
  }`;

  const readOnlyClass = `w-full h-12 px-4 rounded-lg text-sm outline-none ${
    isDark
      ? 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
      : 'bg-slate-100 text-slate-500 border border-slate-200'
  }`;

  const labelClass = `block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`;

  // Mandatory-field gate — mirrors the signup wizard's store-address step (StepStoreAddress)
  // so the required fields are identical wherever a merchant adds a store. The Save/Add
  // button stays disabled until every asterisked field is valid.
  const phoneDigits = (form.store_phone || '').replace(/\D/g, '');
  const phoneAltDigits = (form.store_phone_alt || '').replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length === 10;
  const isPhoneAltValid = !form.store_phone_alt?.trim() || phoneAltDigits.length === 10;
  const canSave = !!(
    form.store_name?.trim() &&
    form.store_category &&
    form.address?.trim() &&
    form.pincode?.length === 6 &&
    form.city?.trim() &&
    form.state?.trim() &&
    isPhoneValid &&
    isPhoneAltValid &&
    (form.is24hrs || (form.shift1 && form.shift2))
  );

  const activeStores = stores.filter(s => s.active_status !== 'disabled');
  const disabledStores = stores.filter(s => s.active_status === 'disabled');

  return (
    <div className={`min-h-screen pb-40 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!forceAddMode && (
              <button
                onClick={() => setView('profile')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {forceAddMode ? t('m_add_store') : t('m_my_stores')}
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                {forceAddMode ? t('m_required_continue') : `${activeStores.length} active${disabledStores.length > 0 ? `, ${disabledStores.length} deleted` : ''}`}
              </p>
            </div>
          </div>
          {!forceAddMode && (
            <button
              onClick={openAddStore}
              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              {t('m_add_store')}
            </button>
          )}
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className={`mx-6 mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium text-emerald-500">{success}</span>
        </div>
      )}

      {/* Force-add banner */}
      {forceAddMode && (
        <div className={`mx-6 mb-4 p-3 rounded-xl border text-center ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
          <p className={`text-xs font-semibold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
            You need at least one store to use DealPro Merchant.
          </p>
          <p className={`text-[11px] mt-0.5 ${isDark ? 'text-amber-400/70' : 'text-amber-600/70'}`}>
            Add your store below to continue.
          </p>
        </div>
      )}

      {/* Loading */}
      {loadingStores && (
        <div className="flex justify-center py-16">
          <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </div>
      )}

      {/* Empty state */}
      {!loadingStores && activeStores.length === 0 && (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Store className={`w-8 h-8 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No stores yet</h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Add your first store location.</p>
          <button
            onClick={openAddStore}
            className="flex items-center gap-2 h-11 px-6 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Add First Store
          </button>
        </div>
      )}

      {/* Store cards */}
      {!loadingStores && activeStores.length > 0 && (
        <div className="px-6 space-y-3">
          {activeStores.map(store => {
            const hrs = parseStoreHrs(store.store_hrs);
            return (
              <div
                key={store.id}
                className={`p-4 rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {store.store_name}
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                      {store.city}, {store.state}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEditStore(store)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingStoreId(store.id || null)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-400'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline delete confirmation */}
                {deletingStoreId === store.id && (
                  <div className={`mt-2 rounded-xl border overflow-hidden ${isDark ? 'border-red-500/20' : 'border-red-200'}`}>
                    {/* Warning header */}
                    <div className={`px-3 py-2.5 flex items-center gap-2 ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <p className={`text-xs font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                        Delete this store?
                      </p>
                    </div>

                    {/* Consequences */}
                    <div className={`px-3 py-3 space-y-2 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-[10px] font-bold mt-0.5 ${isDark ? 'text-red-400' : 'text-red-500'}`}>•</span>
                        <p className={`text-[11px] leading-snug ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                          All active, pending, and under-review campaigns for this store will be <span className="font-bold">immediately expired</span> and removed from the consumer app.
                        </p>
                      </div>
                      {activeStores.length === 1 && (
                        <div className="flex items-start gap-2">
                          <span className={`text-[10px] font-bold mt-0.5 ${isDark ? 'text-red-400' : 'text-red-500'}`}>•</span>
                          <p className={`text-[11px] leading-snug font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                            This is your only store — you'll need to add another to continue using the app.
                          </p>
                        </div>
                      )}
                      <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                        Store is preserved in records and can be reviewed by support.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className={`px-3 py-3 flex gap-2 ${isDark ? 'bg-red-500/10' : 'bg-red-50'} border-t ${isDark ? 'border-red-500/20' : 'border-red-200'}`}>
                      <button
                        onClick={() => setDeletingStoreId(null)}
                        disabled={deleting}
                        className={`flex-1 h-9 rounded-lg text-xs font-medium border ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-600'}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteStore(store.id!)}
                        disabled={deleting}
                        className="flex-1 h-9 rounded-lg text-xs font-bold bg-red-500 text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Yes, Delete
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {store.store_category && (
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {store.store_category}
                    </span>
                  )}
                  <div className="flex items-start gap-2">
                    <MapPin className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                      {store.address}{store.landmark ? `, nr ${store.landmark}` : ''}
                    </span>
                  </div>
                  {store.pincode && (
                    <div className="flex items-center gap-2 ml-5">
                      <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>PIN: {store.pincode}</span>
                    </div>
                  )}
                  {store.store_hrs && (
                    <div className="flex items-center gap-2">
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
                      <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{store.store_hrs}</span>
                    </div>
                  )}
                  {store.store_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
                      <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                        {store.store_phone}{store.store_phone_alt ? ` / ${store.store_phone_alt}` : ''}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Truck className={`w-3.5 h-3.5 shrink-0 ${store.delivers ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-300' : 'text-slate-900')}`} />
                    <span className={`text-xs ${store.delivers ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-300' : 'text-slate-900')}`}>
                      {store.delivers
                        ? `Delivers${store.delivery_radius_km ? (store.delivery_radius_km >= 10 ? ' anywhere within city' : ` within ${store.delivery_radius_km} km`) : ''}`
                        : 'In-store only'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deleted stores section */}
      {!loadingStores && disabledStores.length > 0 && (
        <div className="px-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <div className={`flex-1 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
              Deleted Stores
            </span>
            <div className={`flex-1 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>
          <div className="space-y-2">
            {disabledStores.map(store => (
              <div
                key={store.id}
                className={`p-3 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`text-xs font-medium line-through ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                    {store.store_name}
                  </h3>
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800 text-slate-600' : 'bg-slate-200 text-slate-400'}`}>
                    Deleted
                  </span>
                </div>
                <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                  {store.city}, {store.state}{store.pincode ? ` · ${store.pincode}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/50" onClick={!forceAddMode ? closePanel : undefined} />
          <div className="max-w-md mx-auto w-full h-full relative">
            <div
              className={`absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-hidden flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}
              style={{ maxHeight: '92dvh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
              </div>

              {/* Panel header */}
              <div className="px-6 pb-4 flex items-center justify-between">
                <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {editingStoreId ? t('m_edit_store') : t('m_add_store')}
                </h2>
                {!forceAddMode && (
                  <button onClick={closePanel} className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className={`mx-6 mb-3 p-3 rounded-lg text-xs font-medium text-red-500 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                  {error}
                </div>
              )}

              {/* Scrollable form */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-24 space-y-4">
                {/* Store Name */}
                <div>
                  <label className={labelClass}>Store / Branch Name <span className="text-red-500">*</span></label>
                  <input
                    value={form.store_name}
                    onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))}
                    placeholder="e.g. Main Branch, Mall Outlet"
                    className={inputClass}
                  />
                </div>

                {/* Store Category */}
                <div>
                  <label className={labelClass}>Store Category <span className="text-red-500">*</span></label>
                  <select
                    value={form.store_category}
                    onChange={e => setForm(f => ({ ...f, store_category: e.target.value }))}
                    className={`${inputClass} ${!form.store_category ? (isDark ? 'text-slate-300' : 'text-slate-900') : ''}`}
                  >
                    <option value="">Select category</option>
                    {storeCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div>
                  <label className={labelClass}>Street Address <span className="text-red-500">*</span></label>
                  <input
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="Shop no, building, street"
                    className={inputClass}
                  />
                </div>

                {/* Landmark */}
                <div>
                  <label className={labelClass}>Landmark</label>
                  <input
                    value={form.landmark}
                    onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))}
                    placeholder="Near temple, opposite bus stop..."
                    className={inputClass}
                  />
                </div>

                {/* Store Phone */}
                <div>
                  <label className={labelClass}>Store Phone Number <span className="text-red-500">*</span></label>
                  <input
                    value={form.store_phone}
                    onChange={e => setForm(f => ({ ...f, store_phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                    placeholder="e.g. 9876543210"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className={inputClass}
                  />
                  {form.store_phone && form.store_phone.length > 0 && form.store_phone.length < 10 && (
                    <p className="text-[11px] text-red-500 mt-1">Phone number must be 10 digits</p>
                  )}
                </div>

                {/* Alternate Phone */}
                <div>
                  <label className={labelClass}>Alternate Phone (optional)</label>
                  <input
                    value={form.store_phone_alt}
                    onChange={e => setForm(f => ({ ...f, store_phone_alt: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) }))}
                    placeholder="e.g. 9876543210 (optional)"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    className={inputClass}
                  />
                  {form.store_phone_alt && form.store_phone_alt.length > 0 && form.store_phone_alt.length < 10 && (
                    <p className="text-[11px] text-red-500 mt-1">Phone number must be 10 digits</p>
                  )}
                </div>

                {/* Delivery Option */}
                <div>
                  <label className={`${labelClass} flex items-center gap-2`}>
                    <Truck className="w-3.5 h-3.5" /> Delivery
                  </label>
                  <label className={`flex items-center gap-2 mb-3 cursor-pointer ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    <input
                      type="checkbox"
                      checked={form.delivers}
                      onChange={(e) => {
                        setForm(f => ({ ...f, delivers: e.target.checked, delivery_radius_km: e.target.checked ? f.delivery_radius_km : null }));
                      }}
                      className="w-4 h-4 rounded accent-slate-900"
                    />
                    <span className="text-sm">We deliver to customers</span>
                  </label>
                  {form.delivers && (
                    <div>
                      <label className={labelClass}>Delivery Range</label>
                      <select
                        value={form.delivery_radius_km ?? ''}
                        onChange={(e) => setForm(f => ({ ...f, delivery_radius_km: e.target.value ? Number(e.target.value) : null }))}
                        className={inputClass}
                      >
                        <option value="">Select range</option>
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
                          <p className={`text-[10px] mt-0.5 leading-snug ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                            Delivered by you or your delivery partner; DealPro is not liable.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pincode */}
                <div>
                  <label className={labelClass}>Pincode <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <input
                      value={form.pincode}
                      onChange={e => handlePincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onFocus={() => { if (pincodeResults.length > 0) setShowPincodeDropdown(true); }}
                      onBlur={() => setTimeout(() => setShowPincodeDropdown(false), 150)}
                      placeholder="6-digit pincode"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="off"
                      className={inputClass}
                    />
                    {pincodeLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}

                    {/* Pincode suggestions — "pincode (locality, city)" */}
                    {showPincodeDropdown && pincodeResults.length > 0 && (
                      <div className={`absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border max-h-56 overflow-y-auto shadow-lg ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                      }`}>
                        {pincodeResults.map((row, i) => (
                          <button
                            key={`${row.pincode}-${i}`}
                            type="button"
                            // onMouseDown (not onClick) so it fires before the input's onBlur hides the list.
                            onMouseDown={(e) => { e.preventDefault(); selectPincode(row); }}
                            className={`w-full text-left px-4 py-2.5 text-sm border-b last:border-b-0 ${
                              isDark ? 'border-slate-700/60 hover:bg-slate-700' : 'border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <span className={`font-semibold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{row.pincode}</span>
                            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                              {'  '}({[row.locality, row.city].filter(Boolean).join(', ')})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Locality */}
                <div>
                  <label className={labelClass}>Locality / Area</label>
                  <input
                    value={form.locality}
                    onChange={e => setForm(f => ({ ...f, locality: e.target.value }))}
                    placeholder="Area or neighbourhood"
                    className={inputClass}
                  />
                </div>

                {/* City & State (auto-filled from pincode) */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className={labelClass}>City <span className="text-red-500">*</span></label>
                    <input
                      value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="City"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={labelClass}>State <span className="text-red-500">*</span></label>
                    <input
                      value={form.state}
                      onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                      placeholder="State"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* GPS */}
                <div>
                  <label className={labelClass}>GPS Coordinates</label>
                  <button
                    type="button"
                    onClick={handleGetGPS}
                    disabled={gpsLoading}
                    className={`w-full h-10 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border ${
                      isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                    {form.city || form.pincode ? t('m_resolve_address') : t('m_use_location')}
                  </button>
                  {(form.latitude !== 0 || form.longitude !== 0) && (
                    <p className={`text-[10px] mt-1.5 text-center font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                    </p>
                  )}
                </div>

                {/* Store Hours */}
                <div>
                  <label className={labelClass}>Store Hours <span className="text-red-500">*</span></label>
                  <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    {/* 24hrs toggle */}
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Open 24 Hours</span>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, is24hrs: !f.is24hrs }))}
                        className={`w-11 h-6 rounded-full transition-all ${form.is24hrs ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.is24hrs ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>

                    {!form.is24hrs && (
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Opens at</label>
                          <select
                            value={form.shift1}
                            onChange={e => setForm(f => ({ ...f, shift1: e.target.value }))}
                            className={`w-full h-10 px-3 rounded-lg text-xs outline-none border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                          >
                            {SHIFT1_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Closes at</label>
                          <select
                            value={form.shift2}
                            onChange={e => setForm(f => ({ ...f, shift2: e.target.value }))}
                            className={`w-full h-10 px-3 rounded-lg text-xs outline-none border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                          >
                            {SHIFT2_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer — extra bottom padding accounts for the device's gesture / home bar
                  (Android navigation bar, iOS home indicator) so the Save button is never clipped. */}
              <div
                className={`shrink-0 px-6 pt-4 border-t flex gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
              >
                {!forceAddMode && (
                  <button
                    onClick={closePanel}
                    className={`flex-1 h-12 rounded-xl text-sm font-medium border ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !canSave}
                  className={`${forceAddMode ? 'w-full' : 'flex-1'} h-12 rounded-xl text-sm font-semibold text-white bg-slate-900 disabled:opacity-40 flex items-center justify-center gap-2`}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingStoreId ? t('m_save_changes') : t('m_add_store')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
