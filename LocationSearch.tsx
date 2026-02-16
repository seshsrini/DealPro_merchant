

import React, { useState, useCallback } from 'react';
import { Target, LocateFixed, Globe, Zap, Loader2, Hash, MapPin } from 'lucide-react';
import { locationsearchService } from './services/locationsearchService';
import { LocationMap } from './components/LocationMap';
import { useTranslation } from './contexts/LanguageContext';
import { DBLocality } from './types';

interface LocationSearchProps {
  theme: 'light' | 'dark';
  userCoords: { latitude: number; longitude: number } | null;
  resolvedAddress: string;
  isAutoDetect: boolean;
  setIsAutoDetect: (val: boolean) => void;
  onSearch: (searchData: { 
    isAutoDetect: boolean; 
    radius: number; 
    coords: { latitude: number; longitude: number } | null;
    label: string;
  }) => void;
  onRefreshLocation?: () => Promise<void>;
}

export const LocationSearch: React.FC<LocationSearchProps> = ({
  theme, userCoords, resolvedAddress, isAutoDetect, setIsAutoDetect, onSearch, onRefreshLocation
}) => {
  const { t, locale } = useTranslation();
  const isDark = theme === 'dark';
  
  // -- Manual Location Search States (Pincode-based) --
  const [locality, setLocality] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [localitySuggestions, setLocalitySuggestions] = useState<DBLocality[]>([]);
  const [showLocalityDropdown, setShowLocalityDropdown] = useState(false);

  // -- Search & Utility States --
  const [searchRadius, setSearchRadius] = useState<number>(2.0);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [manualCoords, setManualCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Locality search handler - searches as user types
  const handleLocalitySearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setShowLocalityDropdown(false);
      setLocalitySuggestions([]);
      return;
    }

    try {
      console.log(`[LocationSearch] Searching for "${query}"`);
      const results = await locationsearchService.searchLocalities(query, locale);
      console.log(`[LocationSearch] Found ${results.length} localities`);

      setLocalitySuggestions(results);
      setShowLocalityDropdown(results.length > 0);
    } catch (error) {
      console.error('[LocationSearch] Error searching localities:', error);
      setLocalitySuggestions([]);
      setShowLocalityDropdown(false);
    }
  }, [locale]);

  // Locality selection handler - auto-populates pincode, city, state
  const handleLocalitySelect = useCallback(async (selectedLocality: DBLocality) => {
    const localizedName = selectedLocality.display_name || selectedLocality.names[locale] || selectedLocality.names.en;

    setLocality(localizedName);
    setPincode(selectedLocality.pincode);
    setShowLocalityDropdown(false);

    // Fetch city and state from pincode
    setIsGeocoding(true);
    try {
      const result = await locationsearchService.reverseGeocodePincode(selectedLocality.pincode);
      if (result) {
        setCity(result.city);
        setState(result.state);

        // Geocode the full address for map display
        const fullAddress = `${localizedName}, ${result.city}, ${result.state}, India`;
        const coords = await locationsearchService.geocodeAddressWithAI(fullAddress);
        setManualCoords(coords);
      }
    } catch (err) {
      console.error('[LocationSearch] Error fetching city/state:', err);
      setCity('');
      setState('');
      setManualCoords(null);
    } finally {
      setIsGeocoding(false);
    }

    console.log(`[LocationSearch] Selected: ${localizedName} (${selectedLocality.pincode})`);
  }, [locale]);

  const requestGpsPosition = async () => {
    if (onRefreshLocation) {
      setIsGeocoding(true);
      try { await onRefreshLocation(); } catch (e) {} finally { setIsGeocoding(false); }
    }
  };

  const handleSearchClick = () => {
    const activeCoords = isAutoDetect ? userCoords : manualCoords;
    if (!activeCoords) return;

    let finalLabel = '';
    if (isAutoDetect) {
      finalLabel = resolvedAddress || 'GPS Location';
    } else {
      finalLabel = locality ? `${locality}, ${city}` : (city || 'Manual Selection');
    }

    onSearch({
      isAutoDetect,
      radius: searchRadius,
      coords: activeCoords,
      label: finalLabel
    });
  };

  return (
    <div className="px-6 pt-4 animate-reveal pb-32 max-w-lg mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('loc_title').split(' ')[0]}<br/>
            <span className="text-yellow-500">{t('loc_title').split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">{t('loc_sub')}</p>
        </div>
        <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
           <MapPin className="w-6 h-6 text-yellow-500" />
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="glass p-6 rounded-[2rem] border-white/5 bg-slate-900/40 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                <Target className="w-4 h-4 text-yellow-500" />
              </div>
              <p className={`font-bold text-[11px] uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('loc_radius')}</p>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-yellow-500 font-bold text-2xl">{searchRadius.toFixed(1)}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase">km</span>
            </div>
          </div>

          {/* Sleek Minimalist Slider */}
          <div className="relative py-2">
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.5"
              value={searchRadius}
              onChange={(e) => setSearchRadius(parseFloat(e.target.value))}
              className="slider-modern w-full h-1.5 appearance-none bg-slate-800/50 rounded-full cursor-pointer outline-none"
              style={{
                background: `linear-gradient(to right, rgb(234 179 8) 0%, rgb(234 179 8) ${((searchRadius - 1) / (5 - 1)) * 100}%, rgb(30 41 59 / 0.5) ${((searchRadius - 1) / (5 - 1)) * 100}%, rgb(30 41 59 / 0.5) 100%)`
              }}
            />
          </div>

          {/* Minimal Distance Markers */}
          <div className="flex justify-between px-0.5 mt-2">
            {[1, 2, 3, 4, 5].map((label) => (
              <span
                key={label}
                className={`text-[8px] font-bold transition-all duration-200 ${
                  searchRadius === label
                    ? 'text-yellow-500'
                    : 'text-slate-600'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        <style jsx>{`
          .slider-modern::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgb(250 204 21), rgb(234 179 8));
            cursor: pointer;
            border: 3px solid rgb(15 23 42);
            box-shadow: 0 2px 8px rgba(234, 179, 8, 0.4);
            transition: all 0.2s ease;
          }

          .slider-modern::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(234, 179, 8, 0.5);
          }

          .slider-modern::-webkit-slider-thumb:active {
            transform: scale(1.05);
          }

          .slider-modern::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgb(250 204 21), rgb(234 179 8));
            cursor: pointer;
            border: 3px solid rgb(15 23 42);
            box-shadow: 0 2px 8px rgba(234, 179, 8, 0.4);
            transition: all 0.2s ease;
          }

          .slider-modern::-moz-range-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(234, 179, 8, 0.5);
          }

          .slider-modern::-moz-range-thumb:active {
            transform: scale(1.05);
          }
        `}</style>

        <div className="h-64 w-full rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl relative group">
            <LocationMap
              theme={theme}
              userCoords={userCoords || undefined}
              targetCoords={manualCoords || undefined}
              selectedLocation={isAutoDetect ? (resolvedAddress || 'GPS Center') : (locality || 'Manual Selection')}
              onRefreshLocation={requestGpsPosition}
            />
        </div>

        {/* Google Maps Attribution */}
        <div className="flex justify-end mt-2">
          <span className={`text-[8px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            Powered by{' '}
            <span className="font-semibold text-blue-500">Google Maps</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <button
             onClick={() => {
               setIsAutoDetect(true);
               if (!userCoords) {
                 requestGpsPosition();
               }
             }}
             className={`p-6 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-3 ${isAutoDetect ? 'bg-yellow-600/10 border-yellow-500/50 shadow-xl' : 'glass border-white/5 opacity-60'} ${isAutoDetect ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-600'}`}
           >
              <LocateFixed className="w-8 h-8" />
              <span className="text-[10px] font-black uppercase tracking-widest">{t('loc_gps')}</span>
           </button>
           <button
             onClick={() => setIsAutoDetect(false)}
             className={`p-6 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-3 ${!isAutoDetect ? 'bg-yellow-600/10 border-yellow-500/50 shadow-xl' : 'glass border-white/5 opacity-60'} ${!isAutoDetect ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-600'}`}
           >
              <Globe className="w-8 h-8" />
              <span className="text-[10px] font-black uppercase tracking-widest">{t('loc_manual')}</span>
           </button>
        </div>

        {/* Auto-Detect Location Details */}
        {isAutoDetect && userCoords && (
          <div className="glass p-6 rounded-[2.5rem] border-white/5 bg-slate-900/40 space-y-4 animate-reveal">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <LocateFixed className="w-4 h-4 text-blue-500" />
              </div>
              <p className="font-bold text-sm uppercase tracking-wider text-blue-400">GPS Location Detected</p>
            </div>

            <div className="space-y-3">
              {/* Coordinates Display */}
              <div className="glass p-4 rounded-2xl border-white/5 bg-slate-950/40">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Coordinates</p>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-[8px] font-bold uppercase text-slate-600">Latitude</p>
                    <p className="text-sm font-black text-emerald-400 font-mono">{userCoords.latitude.toFixed(6)}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[8px] font-bold uppercase text-slate-600">Longitude</p>
                    <p className="text-sm font-black text-emerald-400 font-mono">{userCoords.longitude.toFixed(6)}</p>
                  </div>
                </div>
              </div>

              {/* Address Display */}
              <div className="glass p-4 rounded-2xl border-white/5 bg-slate-950/40">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Location</p>
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {resolvedAddress || 'Resolving address...'}
                </p>
              </div>

              {/* Refresh GPS Button */}
              <button
                onClick={requestGpsPosition}
                disabled={isGeocoding}
                className="w-full px-4 py-3 rounded-2xl glass border-blue-500/30 hover:border-blue-500/50 transition-all flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 active:scale-95 disabled:opacity-50"
              >
                {isGeocoding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LocateFixed className="w-4 h-4" />
                )}
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isGeocoding ? 'Updating...' : 'Refresh GPS'}
                </span>
              </button>
            </div>
          </div>
        )}

        {!isAutoDetect && (
          <div className="glass p-8 rounded-[3rem] border-white/5 space-y-6 animate-reveal bg-slate-900/40">
            <div className="space-y-4">
              {/* Locality Input with Autocomplete */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Locality / Area (type to search)"
                  className="input-premium h-16"
                  value={locality}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setLocality(newValue);
                    // Clear pincode, city, and state when user manually types
                    setPincode('');
                    setCity('');
                    setState('');
                    setManualCoords(null);
                    handleLocalitySearch(newValue);
                  }}
                  onFocus={() => {
                    if (localitySuggestions.length > 0) {
                      setShowLocalityDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowLocalityDropdown(false), 200);
                  }}
                />

                {/* Autocomplete dropdown */}
                {showLocalityDropdown && localitySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {localitySuggestions.map((loc) => {
                      const displayName = loc.display_name || loc.names[locale] || loc.names.en;
                      return (
                        <div
                          key={loc.id}
                          className="px-4 py-3 hover:bg-blue-600/20 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleLocalitySelect(loc);
                          }}
                        >
                          <div className="text-sm font-medium text-white">{displayName}</div>
                          <div className="text-xs text-slate-400 mt-0.5">Pincode: {loc.pincode}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Display pincode, city, state below when populated */}
              {pincode && city && state && (
                <div className="glass p-5 rounded-2xl border-white/5 bg-slate-950/40 space-y-2.5 animate-reveal">
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-slate-400">
                      <span className="font-semibold text-blue-400">Pincode:</span> {pincode}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-slate-400">
                      <span className="font-semibold text-blue-400">City:</span> {city}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <p className="text-xs text-slate-400">
                      <span className="font-semibold text-blue-400">State:</span> {state}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scan Area Button - Always show, require click for both modes */}
        <div className="space-y-4 pt-4">
          <button
            onClick={handleSearchClick}
            disabled={isGeocoding || (isAutoDetect ? !userCoords : !locality || !pincode || !city || !state || !manualCoords)}
            className="w-full btn-premium shadow-2xl h-20 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed transition-all rounded-[2rem]"
          >
            {isGeocoding ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <div className="flex items-center gap-4">
                <Zap className="w-8 h-8 fill-white" />
                <span className="font-black text-xl tracking-widest uppercase">{t('loc_scan_btn')}</span>
              </div>
            )}
          </button>

          {/* Helper text */}
          <p className="text-center text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {isAutoDetect
              ? (userCoords ? 'Review your GPS location above, then scan area' : 'Enable GPS to continue')
              : (locality && pincode && city && state ? 'Review your selection above, then scan area' : 'Type and select a locality to continue')
            }
          </p>
        </div>
      </div>
    </div>
  );
};