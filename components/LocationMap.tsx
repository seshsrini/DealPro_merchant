

import React, { useEffect, useRef, useState } from 'react';
import { Navigation, ZoomIn, ZoomOut, LocateFixed, Compass } from 'lucide-react';

interface LocationMapProps {
  onSelect?: (location: string) => void;
  selectedLocation: string;
  theme: 'light' | 'dark';
  userCoords?: { latitude: number, longitude: number };
  targetCoords?: { latitude: number, longitude: number };
  targetAddress?: string;
  onRefreshLocation?: () => void;
}

export const LocationMap: React.FC<LocationMapProps> = ({
  selectedLocation,
  theme,
  userCoords,
  targetCoords,
  targetAddress,
  onRefreshLocation
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const userMarkerRef = useRef<any | null>(null);
  const targetMarkerRef = useRef<any | null>(null);
  const isDark = theme === 'dark';
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const checkIntervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let checkCount = 0;
    const MAX_CHECKS = 50;

    const checkGoogleMaps = () => {
      checkCount++;

      if ((window as any).google && (window as any).google.maps) {
        console.log('[LocationMap] Google Maps is ready');
        setIsGoogleMapsReady(true);
        setMapLoadError(null);

        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        return true;
      }

      if (checkCount >= MAX_CHECKS) {
        console.error('[LocationMap] Google Maps failed to load after timeout');
        setMapLoadError('Map service unavailable. Please refresh the page.');

        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }

        return false;
      }

      return false;
    };

    if (!checkGoogleMaps()) {
      console.log('[LocationMap] Starting Google Maps availability checks');
      checkIntervalRef.current = window.setInterval(() => {
        checkGoogleMaps();
      }, 200) as unknown as number;

      timeoutRef.current = window.setTimeout(() => {
        if (!isGoogleMapsReady) {
          console.error('[LocationMap] Google Maps timeout');
          setMapLoadError('Map loading timeout. Please refresh the page.');
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
        }
      }, 10000) as unknown as number;
    }

    const handleGoogleMapsLoaded = () => {
      console.log('[LocationMap] Google Maps loaded event received');
      checkGoogleMaps();
    };

    window.addEventListener('google-maps-loaded', handleGoogleMapsLoaded);

    return () => {
      window.removeEventListener('google-maps-loaded', handleGoogleMapsLoaded);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isGoogleMapsReady]);

  const handleOpenNativeMap = () => {
    if (!targetAddress) return;
    const encodedAddress = encodeURIComponent(targetAddress);
    const platform = (window as any).Capacitor?.getPlatform() || 'web';

    let url = '';
    if (platform === 'android') {
      url = `google.navigation:q=${encodedAddress}`;
    } else if (platform === 'ios') {
      url = `maps://?daddr=${encodedAddress}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    }

    try {
      window.location.href = url;
    } catch (e) {
      window.open(url, '_system');
    }
  };

  const createUserMarkerContent = () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; background: #3b82f6; opacity: 0.4; border-radius: 50%; animation: map-pulse 2s infinite;"></div>
        <div style="width: 12px; height: 12px; background: #3b82f6; border: 2px solid white; border-radius: 50%; position: relative; z-index: 1; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>
      </div>
      <style>
        @keyframes map-pulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    `;
    return div;
  };

  const createTargetMarkerContent = () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#f43f5e" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3" fill="white"></circle>
        </svg>
      </div>
    `;
    return div;
  };

  useEffect(() => {
    if (!isGoogleMapsReady || !mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = 12.9716;
    const initialLng = 77.5946;

    try {
      console.log('[LocationMap] Initializing map at default location');

      const map = new (window as any).google.maps.Map(mapContainerRef.current, {
        center: { lat: initialLat, lng: initialLng },
        zoom: 12,
        disableDefaultUI: true,
        mapId: 'DEMO_MAP_ID',
        gestureHandling: 'greedy',
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false
      });

      mapInstanceRef.current = map;
      console.log('[LocationMap] Map initialized successfully');
    } catch (e) {
      console.error('[LocationMap] Map initialization failed:', e);
      setMapLoadError('Failed to initialize map. Please refresh the page.');
    }
  }, [isGoogleMapsReady]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const coords = userCoords || targetCoords;
    if (coords && coords.latitude != null && coords.longitude != null &&
        !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
      const pos = { lat: coords.latitude, lng: coords.longitude };
      console.log('[LocationMap] Centering map on new coordinates:', pos);
      mapInstanceRef.current.panTo(pos);
      mapInstanceRef.current.setZoom(15);
    } else if (coords) {
      console.warn('[LocationMap] Invalid coordinates received:', coords);
    }
  }, [userCoords, targetCoords]);

  useEffect(() => {
    const g = (window as any).google;

    if (!mapInstanceRef.current) {
      console.log('[LocationMap] Map instance not ready for user marker');
      return;
    }

    if (!userCoords) {
      console.log('[LocationMap] No user coordinates available for marker');
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
        console.log('[LocationMap] User marker removed');
      }
      return;
    }

    const createOrUpdateMarker = () => {
      if (!g?.maps?.marker?.AdvancedMarkerElement) {
        console.warn('[LocationMap] AdvancedMarkerElement not yet available');
        return false;
      }

      const pos = { lat: userCoords.latitude, lng: userCoords.longitude };

      try {
        if (userMarkerRef.current) {
          console.log('[LocationMap] Updating user marker position:', pos);
          userMarkerRef.current.position = pos;
        } else {
          console.log('[LocationMap] Creating NEW user marker at:', pos);
          userMarkerRef.current = new g.maps.marker.AdvancedMarkerElement({
            position: pos,
            map: mapInstanceRef.current,
            content: createUserMarkerContent(),
            title: "Your Location",
          });
          console.log('[LocationMap] User marker created successfully!');
        }
        return true;
      } catch (e) {
        console.error('[LocationMap] Error creating/updating user marker:', e);
        return false;
      }
    };

    if (!createOrUpdateMarker()) {
      let retryCount = 0;
      const maxRetries = 10;

      const retryTimer = setInterval(() => {
        retryCount++;
        console.log(`[LocationMap] Retry ${retryCount}/${maxRetries} for user marker`);

        if (createOrUpdateMarker()) {
          clearInterval(retryTimer);
          console.log('[LocationMap] User marker created after retry!');
        } else if (retryCount >= maxRetries) {
          clearInterval(retryTimer);
          console.error('[LocationMap] Failed to create user marker after all retries');
        }
      }, 300);

      return () => clearInterval(retryTimer);
    }
  }, [userCoords]);

  useEffect(() => {
    const g = (window as any).google;
    if (!mapInstanceRef.current || !targetCoords) return;

    if (targetCoords.latitude == null || targetCoords.longitude == null ||
        isNaN(targetCoords.latitude) || isNaN(targetCoords.longitude)) {
      console.warn('[LocationMap] Invalid target coordinates, skipping marker:', targetCoords);
      return;
    }

    if (!g?.maps?.marker?.AdvancedMarkerElement) {
      console.warn('[LocationMap] AdvancedMarkerElement not yet available for target marker');
      return;
    }

    const pos = { lat: targetCoords.latitude, lng: targetCoords.longitude };

    try {
      if (targetMarkerRef.current) {
        console.log('[LocationMap] Updating target marker position:', pos);
        targetMarkerRef.current.position = pos;
      } else {
        console.log('[LocationMap] Creating target marker at:', pos);
        targetMarkerRef.current = new g.maps.marker.AdvancedMarkerElement({
          position: pos,
          map: mapInstanceRef.current,
          content: createTargetMarkerContent(),
          title: selectedLocation,
        });
      }

      mapInstanceRef.current.panTo(pos);
    } catch (e) {
      console.error('[LocationMap] Error creating/updating target marker:', e);
    }
  }, [targetCoords, selectedLocation]);

  const handleZoomIn = () => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() + 1);
  const handleZoomOut = () => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() - 1);
  const handleRecenter = () => {
    if (onRefreshLocation) onRefreshLocation();
    const coords = targetCoords || userCoords;
    if (coords && coords.latitude != null && coords.longitude != null &&
        !isNaN(coords.latitude) && !isNaN(coords.longitude) && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: coords.latitude, lng: coords.longitude });
    }
  };

  return (
    <div className={`relative w-full h-full rounded-xl border overflow-hidden transition-all duration-300 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0"></div>

      {/* Loading/Error Indicator */}
      {!isGoogleMapsReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-[100]">
          <div className="text-center px-6">
            {mapLoadError ? (
              <>
                <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-400 text-xs font-medium mb-2">{mapLoadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-xl active:scale-[0.98] transition-all"
                >
                  Refresh Page
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-white text-sm font-medium">Loading Map...</p>
                <p className="text-slate-500 text-xs mt-2">This may take a few seconds</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Zoom Controls Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-[20]">
        <button onClick={handleZoomIn} className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700 text-white' : 'bg-white/90 border border-slate-200 text-slate-800 shadow-sm'}`}>
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={handleZoomOut} className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800/80 border border-slate-700 text-white' : 'bg-white/90 border border-slate-200 text-slate-800 shadow-sm'}`}>
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Recenter & Status Indicator Overlay */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-[20]">
        <button onClick={handleRecenter} className="w-10 h-10 rounded-lg bg-blue-600 text-white border border-blue-500 flex items-center justify-center active:scale-[0.98] transition-all">
          <LocateFixed className="w-4 h-4" />
        </button>
        <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 ${isDark ? 'bg-slate-800/80 border border-slate-700' : 'bg-white/90 border border-slate-200 shadow-sm'}`}>
           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
           <span className={`text-[9px] font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Live</span>
        </div>
      </div>

      {/* Navigation FAB */}
      {targetAddress && (
        <div className="absolute bottom-6 right-6 z-[30]">
          <button
            onClick={handleOpenNativeMap}
            className="w-14 h-14 bg-blue-600 rounded-xl shadow-lg flex items-center justify-center border-2 border-blue-500 active:scale-[0.98] transition-all"
            aria-label="Open GPS Directions"
          >
            <Navigation className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Bottom Info Bar */}
      <div className={`absolute bottom-4 left-4 right-20 p-3 rounded-xl flex items-center justify-between z-[20] border ${isDark ? 'bg-slate-900/90 border-slate-700' : 'bg-white/95 border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
             <Compass className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[9px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Store Location</span>
            <span className={`text-[10px] font-semibold truncate max-w-[120px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedLocation || 'Loading...'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
