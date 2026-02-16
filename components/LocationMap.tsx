

import React, { useEffect, useRef, useState } from 'react';
import { Navigation, ZoomIn, ZoomOut, LocateFixed, Compass } from 'lucide-react';

interface LocationMapProps {
  onSelect?: (location: string) => void;
  selectedLocation: string;
  theme: 'light' | 'dark';
  userCoords?: { latitude: number, longitude: number };
  targetCoords?: { latitude: number, longitude: number };
  targetAddress?: string; // New prop for deep linking
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

  // Wait for Google Maps to load with timeout and retry
  useEffect(() => {
    let checkCount = 0;
    const MAX_CHECKS = 50; // Check for 10 seconds (50 * 200ms)

    const checkGoogleMaps = () => {
      checkCount++;

      if ((window as any).google && (window as any).google.maps) {
        console.log('[LocationMap] Google Maps is ready');
        setIsGoogleMapsReady(true);
        setMapLoadError(null);

        // Clear interval and timeout
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

    // Check immediately
    if (!checkGoogleMaps()) {
      // Start periodic checking
      console.log('[LocationMap] Starting Google Maps availability checks');
      checkIntervalRef.current = window.setInterval(() => {
        checkGoogleMaps();
      }, 200) as unknown as number;

      // Set timeout for error
      timeoutRef.current = window.setTimeout(() => {
        if (!isGoogleMapsReady) {
          console.error('[LocationMap] Google Maps timeout');
          setMapLoadError('Map loading timeout. Please refresh the page.');
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
        }
      }, 10000) as unknown as number; // 10 second timeout
    }

    // Listen for the custom event as backup
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
      // Android Intent for turn-by-turn navigation
      url = `google.navigation:q=${encodedAddress}`;
    } else if (platform === 'ios') {
      // Apple Maps deep link
      url = `maps://?daddr=${encodedAddress}`;
    } else {
      // Web Fallback
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
    }

    try {
      // In Capacitor/APK, window.location.href triggers the external protocol handler
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

  // Initialize map once (don't depend on coords changes)
  useEffect(() => {
    if (!isGoogleMapsReady || !mapContainerRef.current || mapInstanceRef.current) return;

    // Start with default Bangalore coordinates
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

  // Separate effect to handle centering when coords change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const coords = userCoords || targetCoords;
    // Check that coords exist AND have valid lat/lng values
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

  // Handle user marker creation/update with retry logic
  useEffect(() => {
    const g = (window as any).google;

    if (!mapInstanceRef.current) {
      console.log('[LocationMap] Map instance not ready for user marker');
      return;
    }

    if (!userCoords) {
      console.log('[LocationMap] No user coordinates available for marker');
      // Clean up existing marker if coords are removed
      if (userMarkerRef.current) {
        userMarkerRef.current.map = null;
        userMarkerRef.current = null;
        console.log('[LocationMap] User marker removed');
      }
      return;
    }

    const createOrUpdateMarker = () => {
      // Wait for markers library to be ready
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

    // Try to create marker immediately
    if (!createOrUpdateMarker()) {
      // If failed, retry with intervals
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

    // Validate target coordinates before using them
    if (targetCoords.latitude == null || targetCoords.longitude == null ||
        isNaN(targetCoords.latitude) || isNaN(targetCoords.longitude)) {
      console.warn('[LocationMap] Invalid target coordinates, skipping marker:', targetCoords);
      return;
    }

    // Wait for markers library to be ready
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

      // Center map on target location
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
    // Validate coordinates before panning
    if (coords && coords.latitude != null && coords.longitude != null &&
        !isNaN(coords.latitude) && !isNaN(coords.longitude) && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: coords.latitude, lng: coords.longitude });
    }
  };

  return (
    <div className={`relative w-full h-full rounded-3xl border-2 overflow-hidden shadow-2xl transition-all duration-500 ${isDark ? 'border-slate-800' : 'border-blue-100'}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0"></div>

      {/* Loading/Error Indicator */}
      {!isGoogleMapsReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-[100]">
          <div className="text-center px-6">
            {mapLoadError ? (
              <>
                <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-400 text-xs font-bold mb-2">{mapLoadError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-xl active:scale-95 transition-transform"
                >
                  Refresh Page
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-white text-[10px] font-black uppercase tracking-widest">Loading Map...</p>
                <p className="text-slate-500 text-[8px] font-medium mt-2">This may take a few seconds</p>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Zoom Controls Overlay */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-[20]">
        <button onClick={handleZoomIn} className="w-10 h-10 rounded-xl shadow-xl backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center text-white active:scale-90">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={handleZoomOut} className="w-10 h-10 rounded-xl shadow-xl backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center text-white active:scale-90">
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Recenter & Status Indicator Overlay */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-[20]">
        <button onClick={handleRecenter} className="w-10 h-10 rounded-xl shadow-xl bg-blue-600 text-white border border-blue-500 flex items-center justify-center active:scale-90">
          <LocateFixed className="w-4 h-4" />
        </button>
        <div className="px-3 py-1.5 glass rounded-full flex items-center gap-2 border-white/10 shadow-lg">
           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
           <span className="text-[7px] font-black uppercase text-white tracking-widest">Grid Locked</span>
        </div>
      </div>

      {/* CUSTOM NATIVE NAVIGATION FAB - High Visibility */}
      {targetAddress && (
        <div className="absolute bottom-6 right-6 z-[30]">
          <div className="relative group">
            {/* Pulsing ring behind the button */}
            <div className="absolute inset-0 rounded-full bg-blue-500/40 animate-ping scale-150"></div>
            <button 
              onClick={handleOpenNativeMap}
              className="w-16 h-16 bg-blue-600 rounded-full shadow-[0_12px_30px_rgba(37,99,235,0.5)] flex items-center justify-center border-4 border-slate-900 active:scale-95 active:bg-blue-700 transition-all"
              aria-label="Open GPS Directions"
            >
              <Navigation className="w-7 h-7 text-white" />
            </button>
            <div className="absolute -top-12 right-0 px-3 py-1.5 glass rounded-xl border-blue-500/30 whitespace-nowrap shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest">Start GPS Nav</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Info Bar */}
      <div className={`absolute bottom-4 left-4 right-20 backdrop-blur-xl p-3 rounded-2xl flex items-center justify-between shadow-2xl border z-[20] ${isDark ? 'bg-slate-950/90 border-white/10' : 'bg-white/95 border-blue-50'}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
             <Compass className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Retail Node</span>
            <span className={`text-[10px] font-black uppercase truncate max-w-[120px] ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedLocation || 'Syncing...'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};