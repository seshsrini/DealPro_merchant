
import React, { useState } from 'react';
import { AppView } from '../types';
import { MapPin, Loader2, Navigation, XCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { locationsearchService } from '../services/locationsearchService';

interface LocationPermissionProps {
  setView: (view: AppView) => void;
  nextView: AppView;
  onLocationDetected: (city: string, state: string) => void;
}

export const LocationPermission: React.FC<LocationPermissionProps> = ({ setView, nextView, onLocationDetected }) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [detectedState, setDetectedState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processCoordinates = async (latitude: number, longitude: number) => {
    console.log('[LocationPermission] Processing coordinates:', latitude, longitude);

    // Reverse geocode via Nominatim (OpenStreetMap)
    try {
      const geoResult = await locationsearchService.reverseGeocodeCoordinates(latitude, longitude);
      if (geoResult?.city) {
        console.log('[LocationPermission] Nominatim detected:', geoResult.city, geoResult.state);
        setDetectedCity(geoResult.city);
        setDetectedState(geoResult.state || '');
        onLocationDetected(geoResult.city, geoResult.state || '');
        return true;
      }
    } catch (err) {
      console.warn('[LocationPermission] Reverse geocoding failed:', err);
    }

    return false;
  };

  const isNative = Capacitor.isNativePlatform();

  const getBrowserPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      });
    });
  };

  const handleAllowLocation = async () => {
    setIsDetecting(true);
    setError(null);
    try {
      let latitude: number;
      let longitude: number;

      console.log('[LocationPermission] Platform:', Capacitor.getPlatform(), '| isNative:', isNative);

      if (isNative) {
        // Native: use Capacitor Geolocation (handles Android/iOS permissions)
        try {
          let permStatus = await Geolocation.checkPermissions();
          console.log('[LocationPermission] Current permission status:', JSON.stringify(permStatus));

          if (permStatus.location !== 'granted') {
            permStatus = await Geolocation.requestPermissions();
            console.log('[LocationPermission] After request, status:', JSON.stringify(permStatus));
          }

          if (permStatus.location !== 'granted') {
            setError('Location permission denied. Please enable location in your device settings.');
            setIsDetecting(false);
            return;
          }

          console.log('[LocationPermission] Permission granted, getting position...');
          const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (nativeErr: any) {
          // Capacitor Geolocation failed — fall back to browser API
          console.warn('[LocationPermission] Native geolocation failed, trying browser fallback:', nativeErr?.message);
          const pos = await getBrowserPosition();
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      } else {
        // Web browser: use navigator.geolocation directly
        // Capacitor's requestPermissions() can throw on web, so skip it
        if (!window.isSecureContext) {
          console.warn('[LocationPermission] Not a secure context — geolocation requires HTTPS or localhost');
          setError('Location requires a secure connection (HTTPS). Try accessing via localhost:3000 instead.');
          setIsDetecting(false);
          return;
        }
        const pos = await getBrowserPosition();
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }

      console.log('[LocationPermission] Got coordinates:', latitude, longitude);
      const success = await processCoordinates(latitude, longitude);
      if (!success) {
        console.warn('[LocationPermission] Could not determine city from coordinates');
        // Still let user continue — coordinates were obtained even if city name failed
        setError('Could not determine your city name, but your location was detected. You can continue.');
      }
    } catch (err: any) {
      console.error('[LocationPermission] Location detection failed:', err);
      const code = err?.code;
      const msg = err?.message || '';
      if (code === 1 || msg.includes('denied')) {
        setError('Location access denied. Please enable location in your device settings and try again.');
      } else if (code === 2 || msg.includes('unavailable')) {
        setError('Location unavailable. Please enable GPS/location services on your device and try again.');
      } else if (code === 3 || msg.includes('timeout')) {
        setError('Location request timed out. Please check your GPS signal and try again.');
      } else {
        setError(`Could not access location: ${msg || 'Unknown error'}. You can continue without it.`);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const handleContinue = () => {
    setView(nextView);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-5">
          <MapPin className="w-6 h-6 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">
          Enable location
        </h2>
        <p className="text-sm text-slate-500">
          Allow DealPro to use your location to show deals near you
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 flex flex-col items-center justify-center">
        {!detectedCity && !error && !isDetecting && (
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-yellow-50 flex items-center justify-center mb-6">
              <Navigation className="w-10 h-10 text-yellow-500" />
            </div>
            <p className="text-sm text-slate-600 mb-2">
              We use your location to find the best deals near you.
            </p>
            <p className="text-xs text-slate-400">
              Your location is only used to personalize your deal feed.
            </p>
          </div>
        )}

        {isDetecting && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin mb-4" />
            <p className="text-sm font-medium text-slate-700">Detecting your location...</p>
          </div>
        )}

        {detectedCity && (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">Your location</p>
            <p className="text-2xl font-semibold text-slate-900">{detectedCity}</p>
            {detectedState && (
              <p className="text-sm text-slate-500 mt-1">{detectedState}</p>
            )}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="shrink-0 px-6 py-6 space-y-3">
        {!detectedCity && !isDetecting && !error && (
          <>
            <button
              onClick={handleAllowLocation}
              className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm active:scale-[0.98] transition-all"
            >
              Allow Location
            </button>
            <button
              onClick={handleContinue}
              className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium text-sm active:scale-[0.98] transition-all"
            >
              Skip for now
            </button>
          </>
        )}

        {error && (
          <>
            <button
              onClick={handleAllowLocation}
              className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm active:scale-[0.98] transition-all"
            >
              Try Again
            </button>
            <button
              onClick={handleContinue}
              className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium text-sm active:scale-[0.98] transition-all"
            >
              Continue without location
            </button>
          </>
        )}

        {detectedCity && (
          <button
            onClick={handleContinue}
            className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm active:scale-[0.98] transition-all"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
};
