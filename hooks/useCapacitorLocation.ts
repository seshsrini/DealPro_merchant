import { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation, PermissionStatus } from '@capacitor/geolocation';
import { locationsearchService } from '../services/locationsearchService'; // Import the service

export interface Coords {
  latitude: number;
  longitude: number;
}

export const useCapacitorLocation = (active: boolean = true) => {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null); // NEW: State for resolved city
  const watchIdRef = useRef<string | null>(null);

  const checkPermissionsAndGetLocation = useCallback(async () => {
    try {
      setLoading(true);
      let status: PermissionStatus;
      
      try {
        status = await Geolocation.checkPermissions();
      } catch (e) {
        status = { location: 'prompt', coarseLocation: 'prompt' };
      }

      if (status.location !== 'granted') {
        try {
          status = await Geolocation.requestPermissions();
        } catch (e) {
          setError('Permission request denied or failed.');
          setLoading(false);
          setResolvedCity(null); // Clear city on error
          return;
        }
      }
      
      if (status.location !== 'granted') {
        setError('Location access is required for auto-detect.');
        setLoading(false);
        setResolvedCity(null); // Clear city on error
        return;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout for slower GPS locks
        maximumAge: 0   // Force fresh location
      });

      if (position && position.coords) {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setError(null);

        // NEW: Reverse geocode to get the city name
        try {
          const geoResult = await locationsearchService.reverseGeocodeCoordinates(position.coords.latitude, position.coords.longitude);
          setResolvedCity(geoResult?.city || null);
        } catch (geoError) {
          console.error("Reverse geocoding failed in useCapacitorLocation:", geoError);
          setResolvedCity(null);
        }

      }
    } catch (err: any) {
      const errorMsg = err.message || 'GPS Signal Timeout.';
      setError(errorMsg);
      console.error('Geolocation Hook Error:', err);
      setResolvedCity(null); // Clear city on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      setResolvedCity(null); // Clear city when not active
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      }
      return;
    }

    checkPermissionsAndGetLocation();

    const startWatching = async () => {
      try {
        const status = await Geolocation.checkPermissions();
        if (status.location === 'granted') {
          // Clear existing watch before starting a new one
          if (watchIdRef.current) {
             await Geolocation.clearWatch({ id: watchIdRef.current });
          }
          watchIdRef.current = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 20000 },
            async (position, err) => { // Made callback async
              if (err) return;
              if (position) {
                setCoords({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                });
                // NEW: Reverse geocode for watched position
                try {
                  const geoResult = await locationsearchService.reverseGeocodeCoordinates(position.coords.latitude, position.coords.longitude);
                  setResolvedCity(geoResult?.city || null);
                } catch (geoError) {
                  console.error("Reverse geocoding failed in useCapacitorLocation (watch):", geoError);
                  setResolvedCity(null);
                }
              }
            }
          );
        }
      } catch (e) {
        console.error('Watch setup failed', e);
      }
    };

    startWatching();

    return () => {
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
      }
    };
  }, [active, checkPermissionsAndGetLocation]);

  return { coords, error, loading, resolvedCity, refresh: checkPermissionsAndGetLocation }; // NEW: Return resolvedCity
};