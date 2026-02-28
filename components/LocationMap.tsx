import React, { useEffect, useRef, useState } from 'react';
import { Navigation, ZoomIn, ZoomOut, LocateFixed, Compass } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LIGHT_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const userIcon = L.divIcon({
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  html: `
    <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 100%; height: 100%; background: #3b82f6; opacity: 0.4; border-radius: 50%; animation: map-pulse 2s infinite;"></div>
      <div style="width: 12px; height: 12px; background: #3b82f6; border: 2px solid white; border-radius: 50%; position: relative; z-index: 1; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>
    </div>
  `
});

const targetIcon = L.divIcon({
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  html: `
    <div style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="#f43f5e" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3" fill="white"></circle>
      </svg>
    </div>
  `
});

interface LocationMapProps {
  onSelect?: (location: string) => void;
  selectedLocation: string;
  theme: 'light' | 'dark';
  userCoords?: { latitude: number; longitude: number };
  targetCoords?: { latitude: number; longitude: number };
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
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const isDark = theme === 'dark';
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = 12.9716;
    const initialLng = 77.5946;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      tileLayerRef.current = L.tileLayer(isDark ? DARK_TILES : LIGHT_TILES, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
      setIsMapReady(true);
      console.log('[LocationMap] Leaflet map initialized successfully');
    } catch (e) {
      console.error('[LocationMap] Map initialization failed:', e);
      setMapLoadError('Failed to initialize map.');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch tiles on theme change
  useEffect(() => {
    if (!tileLayerRef.current) return;
    tileLayerRef.current.setUrl(isDark ? DARK_TILES : LIGHT_TILES);
  }, [isDark]);

  // Center map when coords change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const coords = userCoords || targetCoords;
    if (coords && coords.latitude != null && coords.longitude != null &&
        !isNaN(coords.latitude) && !isNaN(coords.longitude)) {
      mapInstanceRef.current.setView([coords.latitude, coords.longitude], 15);
    }
  }, [userCoords, targetCoords]);

  // User marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!userCoords) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const pos: L.LatLngExpression = [userCoords.latitude, userCoords.longitude];

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(pos);
    } else {
      userMarkerRef.current = L.marker(pos, { icon: userIcon, title: 'Your Location' })
        .addTo(mapInstanceRef.current);
    }
  }, [userCoords]);

  // Target marker
  useEffect(() => {
    if (!mapInstanceRef.current || !targetCoords) return;
    if (targetCoords.latitude == null || targetCoords.longitude == null ||
        isNaN(targetCoords.latitude) || isNaN(targetCoords.longitude)) return;

    const pos: L.LatLngExpression = [targetCoords.latitude, targetCoords.longitude];

    if (targetMarkerRef.current) {
      targetMarkerRef.current.setLatLng(pos);
    } else {
      targetMarkerRef.current = L.marker(pos, { icon: targetIcon, title: selectedLocation })
        .addTo(mapInstanceRef.current);
    }

    mapInstanceRef.current.panTo(pos);
  }, [targetCoords, selectedLocation]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleRecenter = () => {
    if (onRefreshLocation) onRefreshLocation();
    const coords = targetCoords || userCoords;
    if (coords && coords.latitude != null && coords.longitude != null &&
        !isNaN(coords.latitude) && !isNaN(coords.longitude) && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([coords.latitude, coords.longitude]);
    }
  };

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

  return (
    <div className={`relative w-full h-full rounded-xl border overflow-hidden transition-all duration-300 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0"></div>

      {/* Loading/Error Indicator */}
      {!isMapReady && (
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
