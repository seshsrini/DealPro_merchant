
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, MapPin, Plus, Edit2, X, Loader2, CheckCircle2,
  Clock, Navigation, ChevronDown, Store,
} from 'lucide-react';
import { AppView, MerchantStore, User } from './types';
import { merchantService } from './services/merchantService';
import { locationsearchService } from './services/locationsearchService';

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
}

const blankForm = (): StoreForm => ({
  store_name: '', address: '', landmark: '', locality: '',
  city: '', state: '', pincode: '',
  latitude: 0, longitude: 0,
  shift1: '9:00 AM', shift2: '10:00 PM', is24hrs: false,
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
}

export const MerchantStores: React.FC<Props> = ({ user, setView, theme }) => {
  const isDark = theme === 'dark';
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [form, setForm] = useState<StoreForm>(blankForm());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Fetch stores on mount
  useEffect(() => {
    merchantService.getMerchantStores(user.id)
      .then(data => setStores(data))
      .catch(() => {})
      .finally(() => setLoadingStores(false));
  }, [user.id]);

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
    if (!form.address.trim()) { setError('Address is required'); return; }
    if (!form.city.trim()) { setError('City is required'); return; }
    if (!form.state.trim()) { setError('State is required'); return; }

    setSaving(true);
    setError(null);

    try {
      const storeHrs = buildStoreHrs(form);

      if (editingStoreId) {
        // Update (address fields only)
        const updated = await merchantService.updateStore(user.id, editingStoreId, {
          address: form.address,
          landmark: form.landmark,
          locality: form.locality,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          latitude: form.latitude,
          longitude: form.longitude,
          store_hrs: storeHrs,
        });
        setStores(prev => prev.map(s => s.id === editingStoreId ? updated : s));
        setSuccess('Store updated successfully');
      } else {
        // Add new
        if (!form.store_name.trim()) { setError('Store name is required'); setSaving(false); return; }
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
        });
        setStores(prev => [...prev, added]);
        setSuccess('Store added successfully');
      }
      closePanel();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save store');
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

  const labelClass = `block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  return (
    <div className={`min-h-screen pb-40 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('profile')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>My Stores</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{stores.length} {stores.length === 1 ? 'store' : 'stores'}</p>
            </div>
          </div>
          <button
            onClick={openAddStore}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Store
          </button>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className={`mx-6 mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium text-emerald-500">{success}</span>
        </div>
      )}

      {/* Loading */}
      {loadingStores && (
        <div className="flex justify-center py-16">
          <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        </div>
      )}

      {/* Empty state */}
      {!loadingStores && stores.length === 0 && (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Store className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No stores yet</h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Add your first store location.</p>
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
      {!loadingStores && stores.length > 0 && (
        <div className="px-6 space-y-3">
          {stores.map(store => {
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
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {store.city}, {store.state}
                    </p>
                  </div>
                  <button
                    onClick={() => openEditStore(store)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <MapPin className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {store.address}{store.landmark ? `, nr ${store.landmark}` : ''}
                    </span>
                  </div>
                  {store.pincode && (
                    <div className="flex items-center gap-2 ml-5">
                      <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PIN: {store.pincode}</span>
                    </div>
                  )}
                  {store.store_hrs && (
                    <div className="flex items-center gap-2">
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                      <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{store.store_hrs}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-[9999]">
          <div className="absolute inset-0 bg-black/50" onClick={closePanel} />
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
                  {editingStoreId ? 'Edit Store' : 'Add Store'}
                </h2>
                <button onClick={closePanel} className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className={`mx-6 mb-3 p-3 rounded-lg text-xs font-medium text-red-500 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                  {error}
                </div>
              )}

              {/* Scrollable form */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-4">
                {/* Store Name */}
                <div>
                  <label className={labelClass}>Store / Branch Name <span className="text-red-500">*</span></label>
                  {editingStoreId ? (
                    <input value={form.store_name} className={readOnlyClass} readOnly />
                  ) : (
                    <input
                      value={form.store_name}
                      onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))}
                      placeholder="e.g. Main Branch, Mall Outlet"
                      className={inputClass}
                    />
                  )}
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

                {/* Pincode */}
                <div>
                  <label className={labelClass}>Pincode</label>
                  <div className="relative">
                    <input
                      value={form.pincode}
                      onChange={e => handlePincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit pincode"
                      maxLength={6}
                      inputMode="numeric"
                      className={inputClass}
                    />
                    {pincodeLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
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
                    {form.city || form.pincode ? 'Resolve from Address' : 'Use Device GPS'}
                  </button>
                  {(form.latitude !== 0 || form.longitude !== 0) && (
                    <p className={`text-[10px] mt-1.5 text-center font-mono ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                    </p>
                  )}
                </div>

                {/* Store Hours */}
                <div>
                  <label className={labelClass}>Store Hours</label>
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
                          <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Opens at</label>
                          <select
                            value={form.shift1}
                            onChange={e => setForm(f => ({ ...f, shift1: e.target.value }))}
                            className={`w-full h-10 px-3 rounded-lg text-xs outline-none border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                          >
                            {SHIFT1_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className={`text-[10px] font-medium mb-1 block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Closes at</label>
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

              {/* Footer */}
              <div className={`shrink-0 px-6 py-4 border-t flex gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <button
                  onClick={closePanel}
                  className={`flex-1 h-12 rounded-xl text-sm font-medium border ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl text-sm font-semibold text-white bg-slate-900 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingStoreId ? 'Save Changes' : 'Add Store'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
