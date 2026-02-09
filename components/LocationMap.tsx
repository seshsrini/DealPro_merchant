

import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || !(window as any).google) return;

    const initialLat = targetCoords?.latitude || userCoords?.latitude || 12.9716;
    const initialLng = targetCoords?.longitude || userCoords?.longitude || 77.5946;

    try {
      const map = new (window as any).google.maps.Map(mapContainerRef.current, {
        center: { lat: initialLat, lng: initialLng },
        zoom: 15,
        disableDefaultUI: true,
        mapId: 'DEMO_MAP_ID',
      });
      mapInstanceRef.current = map;
    } catch (e) {
      console.error("Map initialization failed", e);
    }
  }, []);

  useEffect(() => {
    const g = (window as any).google;
    if (!mapInstanceRef.current || !userCoords || !g?.maps?.marker) return;
    const pos = { lat: userCoords.latitude, lng: userCoords.longitude };
    try {
      if (userMarkerRef.current) {
        userMarkerRef.current.position = pos;
      } else {
        userMarkerRef.current = new g.maps.marker.AdvancedMarkerElement({
          position: pos,
          map: mapInstanceRef.current,
          content: createUserMarkerContent(),
          title: "You",
        });
      }
    } catch (e) {}
  }, [userCoords]);

  useEffect(() => {
    const g = (window as any).google;
    if (!mapInstanceRef.current || !targetCoords || !g?.maps?.marker) return;
    const pos = { lat: targetCoords.latitude, lng: targetCoords.longitude };
    try {
      if (targetMarkerRef.current) {
        targetMarkerRef.current.position = pos;
      } else {
        targetMarkerRef.current = new g.maps.marker.AdvancedMarkerElement({
          position: pos,
          map: mapInstanceRef.current,
          content: createTargetMarkerContent(),
          title: selectedLocation,
        });
      }
      mapInstanceRef.current.panTo(pos);
    } catch (e) {}
  }, [targetCoords, selectedLocation]);

  const handleZoomIn = () => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() + 1);
  const handleZoomOut = () => mapInstanceRef.current?.setZoom(mapInstanceRef.current.getZoom() - 1);
  const handleRecenter = () => {
    if (onRefreshLocation) onRefreshLocation();
    const coords = targetCoords || userCoords;
    if (coords && mapInstanceRef.current) mapInstanceRef.current.panTo({ lat: coords.latitude, lng: coords.longitude });
  };

  return (
    <div className={`relative w-full h-full rounded-3xl border-2 overflow-hidden shadow-2xl transition-all duration-500 ${isDark ? 'border-slate-800' : 'border-blue-100'}`}>
      <div ref={mapContainerRef} className="w-full h-full z-0"></div>
      
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