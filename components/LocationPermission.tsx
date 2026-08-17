
import React, { useState } from 'react';
import { AppView } from '../types';
import { MapPin, Navigation, Loader2 } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';

interface LocationPermissionProps {
  setView: (view: AppView) => void;
  nextView: AppView;
  onLocationDetected: (city: string, state: string) => void;
}

export const LocationPermission: React.FC<LocationPermissionProps> = ({ setView, nextView, onLocationDetected }) => {
  const [requesting, setRequesting] = useState(false);

  const handleAllowLocation = async () => {
    setRequesting(true);
    try {
      // Request permission only — don't wait for coordinates
      await Geolocation.requestPermissions();
      console.log('[LocationPermission] Permission granted, navigating immediately');
      // Signal consent to App.tsx (city/state will be detected in background on login screen)
      onLocationDetected('', '');
    } catch (err) {
      console.log('[LocationPermission] Permission request failed, trying browser fallback:', err);
      try {
        // Trigger browser permission prompt (fire-and-forget)
        navigator.geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 1 });
        onLocationDetected('', '');
      } catch {
        // Permission denied — still continue
      }
    } finally {
      setRequesting(false);
      setView(nextView);
    }
  };

  const handleSkip = () => {
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
          Allow Sreshta to use your location to show deals near you
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 flex flex-col items-center justify-center">
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
      </div>

      {/* Buttons */}
      <div className="shrink-0 px-6 pt-6 pb-safe-bottom space-y-3">
        <button
          onClick={handleAllowLocation}
          disabled={requesting}
          className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Allow Location
        </button>
        <button
          onClick={handleSkip}
          disabled={requesting}
          className="w-full h-12 rounded-xl bg-white border border-slate-200 text-slate-600 font-medium text-sm active:scale-[0.98] transition-all disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};
