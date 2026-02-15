

import React, { useState, useEffect, useCallback } from 'react';
import { Target, LocateFixed, Globe, Zap, Loader2, Compass, Sparkles, Hash, MapPin } from 'lucide-react';
import { locationsearchService } from './services/locationsearchService';
import { LocationMap } from './components/LocationMap';
import { useTranslation } from './contexts/LanguageContext';
import { DBState, DBCity, DBLocality } from './types';
import { Geolocation } from '@capacitor/geolocation'; // Keep for client-side GPS access

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
  
  // -- Dropdown States --
  const [states, setStates] = useState<DBState[]>([]);
  const [cities, setCities] = useState<DBCity[]>([]);
  const [localities, setLocalities] = useState<DBLocality[]>([]);
  
  // -- Selection States --
  const [selectedStateId, setSelectedStateId] = useState<number | ''>('');
  const [selectedCityId, setSelectedCityId] = useState<number | ''>('');
  const [selectedLocalityId, setSelectedLocalityId] = useState<number | ''>('');
  
  // -- Search & Utility States --
  const [searchRadius, setSearchRadius] = useState<number>(2.0);
  const [pincode, setPincode] = useState('');
  const [isSearchingLocality, setIsSearchingLocality] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [manualCoords, setManualCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // 1. Initial Load: Fetch all states with locale
  useEffect(() => {
    // locationsearchService.getStates now calls an Edge Function
    locationsearchService.getStates(locale).then(setStates).catch(err => console.error("Error fetching states:", err));
  }, [locale]);

  // 2. Cascade: Handle State Change
  useEffect(() => {
    if (selectedStateId) {
      // locationsearchService.getCities now calls an Edge Function
      locationsearchService.getCities(selectedStateId as number, locale).then(setCities).catch(err => console.error("Error fetching cities:", err));
      setSelectedCityId('');
      setSelectedLocalityId('');
    } else {
      setCities([]);
    }
  }, [selectedStateId, locale]);

  // 3. Cascade: Handle City Change
  useEffect(() => {
    if (selectedCityId) {
      // locationsearchService.getLocalities now calls an Edge Function
      locationsearchService.getLocalities(selectedCityId as number, locale).then(setLocalities).catch(err => console.error("Error fetching localities:", err));
      setSelectedLocalityId('');
    } else {
      setLocalities([]);
    }
  }, [selectedCityId, locale]);

  // 4. Reverse Lookup: Auto-resolve hierarchy from Pincode
  useEffect(() => {
    if (pincode.length === 6) {
      const resolvePin = async () => {
        setIsSearchingLocality(true);
        try {
          // Fix: Explicitly type the result from lookupPincode
          const result: { locality: DBLocality, city: DBCity, stateId: number } | null = await locationsearchService.lookupPincode(pincode);
          if (result) {
            // Fix: Ensure Number() cast for stateId
            setSelectedStateId(Number(result.stateId));
            
            const fetchedCities = await locationsearchService.getCities(result.stateId, locale);
            setCities(fetchedCities);
            // Fix: Ensure Number() cast for city.id
            setSelectedCityId(Number(result.city.id));
            
            const fetchedLocalities = await locationsearchService.getLocalities(result.city.id, locale);
            setLocalities(fetchedLocalities);
            // Fix: Ensure Number() cast for locality.id
            setSelectedLocalityId(Number(result.locality.id));
            
            // geocodeAddressWithAI remains client-side
            const locName = result.locality.names[locale] || result.locality.names['en'];
            const cityObj = fetchedCities.find(c => c.id === result.city.id);
            const cityName = cityObj?.display_name || "India";
            const fullAddress = `${locName}, ${cityName}, India`;
            const coords = await locationsearchService.geocodeAddressWithAI(fullAddress);
            setManualCoords(coords);
          }
        } catch (err) {
          console.error("Pincode lookup error:", err);
          // Handle specific error messages from BLL if needed
        } finally {
          setIsSearchingLocality(false);
        }
      };
      resolvePin();
    }
  }, [pincode, locale]);

  // 5. Geocode selection for the map preview (Standard Selection Path)
  useEffect(() => {
    const resolveManualLocation = async () => {
      if (!isAutoDetect && selectedLocalityId && !isSearchingLocality) {
        setIsGeocoding(true);
        try {
          const loc = localities.find(l => l.id === selectedLocalityId);
          const city = cities.find(c => c.id === selectedCityId);
          const state = states.find(s => s.id === selectedStateId);
          
          if (loc && city && state) {
            // geocodeAddressWithAI remains client-side
            const fullAddress = `${loc.display_name}, ${city.display_name}, ${state.display_name}, India`;
            const result = await locationsearchService.geocodeAddressWithAI(fullAddress);
            setManualCoords(result);
          }
        } catch (error) {
          setManualCoords(null);
        } finally {
          setIsGeocoding(false);
        }
      }
    };
    resolveManualLocation();
  }, [selectedLocalityId, selectedCityId, selectedStateId, isAutoDetect, localities, cities, states, isSearchingLocality]);

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
      const loc = localities.find(l => l.id === selectedLocalityId);
      const city = cities.find(c => c.id === selectedCityId);
      finalLabel = loc ? `${loc.display_name}, ${city?.display_name}` : (city?.display_name || 'Manual Selection');
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
              selectedLocation={isAutoDetect ? (resolvedAddress || 'GPS Center') : (localities.find(l => l.id === selectedLocalityId)?.display_name || 'Manual Selection')}
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
             onClick={() => { setIsAutoDetect(true); requestGpsPosition(); }}
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

        {!isAutoDetect && (
          <div className="glass p-8 rounded-[3rem] border-white/5 space-y-6 animate-reveal bg-slate-900/40">
            <div className="space-y-4">
              <select 
                className="input-premium h-16" 
                value={selectedStateId} 
                onChange={(e) => setSelectedStateId(e.target.value === '' ? '' : Number(e.target.value as string))}
              >
                <option value="">{t('loc_region')}</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
              </select>

              <select 
                className="input-premium h-16" 
                value={selectedCityId} 
                onChange={(e) => setSelectedCityId(e.target.value === '' ? '' : Number(e.target.value as string))}
                disabled={!selectedStateId}
              >
                <option value="">{t('loc_city')}</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
              </select>

              <select 
                className="input-premium h-16" 
                value={selectedLocalityId} 
                onChange={(e) => setSelectedLocalityId(e.target.value === '' ? '' : Number(e.target.value as string))}
                disabled={!selectedCityId}
              >
                <option value="">{t('loc_area')}</option>
                {localities.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.display_name} ({l.pincode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4">
          <button 
            onClick={handleSearchClick} 
            disabled={isGeocoding || (isAutoDetect ? !userCoords : !selectedLocalityId)} 
            className="w-full btn-premium shadow-2xl h-20 active:scale-[0.98] disabled:opacity-30 transition-all rounded-[2rem]"
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
        </div>
      </div>
    </div>
  );
};