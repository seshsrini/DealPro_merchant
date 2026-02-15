import { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation, PermissionStatus } from '@capacitor/geolocation';
import { locationsearchService } from '../services/locationsearchService'; // Import the service

export interface Coords {
  latitude: number;
  longitude: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds between retries

export const useCapacitorLocation = (active: boolean = true) => {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null); // NEW: State for resolved city
  const watchIdRef = useRef<string | null>(null);
  const retryCountRef = useRef<number>(0);

  // Fallback to browser Geolocation API
  const getBrowserLocation = useCallback(async (): Promise<Coords | null> => {
    console.log('[useCapacitorLocation] Trying browser Geolocation API as fallback');

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.error('[useCapacitorLocation] Browser Geolocation not supported');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('[useCapacitorLocation] Browser geolocation success:', position.coords);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('[useCapacitorLocation] Browser geolocation failed:', error);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }, []);

  const checkPermissionsAndGetLocation = useCallback(async (retryCount: number = 0) => {
    try {
      setLoading(true);
      console.log(`[useCapacitorLocation] Attempt ${retryCount + 1}/${MAX_RETRIES + 1} to get location`);

      let status: PermissionStatus;
      let isCapacitorAvailable = false;

      // Check if Capacitor is available
      try {
        status = await Geolocation.checkPermissions();
        isCapacitorAvailable = true;
        console.log('[useCapacitorLocation] Capacitor Geolocation available, status:', status);
      } catch (e) {
        console.warn('[useCapacitorLocation] Capacitor Geolocation not available, will use browser fallback');
        status = { location: 'prompt', coarseLocation: 'prompt' };
      }

      let position: any = null;

      if (isCapacitorAvailable) {
        // Try Capacitor Geolocation first
        if (status.location !== 'granted') {
          try {
            status = await Geolocation.requestPermissions();
            console.log('[useCapacitorLocation] Permission requested, new status:', status);
          } catch (e) {
            console.warn('[useCapacitorLocation] Permission request failed, trying browser fallback');
            const browserCoords = await getBrowserLocation();
            if (browserCoords) {
              position = { coords: browserCoords };
            }
          }
        }

        if (!position && status.location === 'granted') {
          try {
            position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000, // 10 second timeout
              maximumAge: 0   // Force fresh location
            });
            console.log('[useCapacitorLocation] Capacitor position obtained:', position);
          } catch (geoError: any) {
            console.warn('[useCapacitorLocation] Capacitor getCurrentPosition failed, trying browser fallback:', geoError);
            const browserCoords = await getBrowserLocation();
            if (browserCoords) {
              position = { coords: browserCoords };
            }
          }
        }
      } else {
        // Use browser geolocation directly if Capacitor is not available
        const browserCoords = await getBrowserLocation();
        if (browserCoords) {
          position = { coords: browserCoords };
        }
      }

      if (position && position.coords) {
        const newCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };

        setCoords(newCoords);
        setError(null);
        setLoading(false); // Clear loading state on success
        retryCountRef.current = 0; // Reset retry count on success

        console.log('[useCapacitorLocation] Location acquired successfully:', newCoords);

        // Reverse geocode to get the city name
        try {
          const geoResult = await locationsearchService.reverseGeocodeCoordinates(newCoords.latitude, newCoords.longitude);
          setResolvedCity(geoResult?.city || null);
          console.log('[useCapacitorLocation] City resolved:', geoResult?.city);
        } catch (geoError) {
          console.error('[useCapacitorLocation] Reverse geocoding failed:', geoError);
          setResolvedCity(null);
        }
      } else {
        throw new Error('Unable to get location from any source');
      }
    } catch (err: any) {
      console.error('[useCapacitorLocation] Error:', err);

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        console.log(`[useCapacitorLocation] Retrying in ${RETRY_DELAY}ms...`);
        setError(`Acquiring location... (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`);
        retryCountRef.current = retryCount + 1;

        setTimeout(() => {
          checkPermissionsAndGetLocation(retryCount + 1);
        }, RETRY_DELAY);
        return;
      }

      // All retries exhausted
      const errorMsg = err.message || 'Unable to detect your location. Please enable location services and try again.';
      setError(errorMsg);
      setResolvedCity(null);
      setLoading(false);
    }
  }, [getBrowserLocation]);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      setResolvedCity(null); // Clear city when not active
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
        watchIdRef.current = null;
      }
      return;
    }

    // Initial location fetch
    checkPermissionsAndGetLocation(0);

    const startWatching = async () => {
      try {
        // Check if Capacitor Geolocation is available
        const status = await Geolocation.checkPermissions();
        if (status.location === 'granted') {
          console.log('[useCapacitorLocation] Starting position watch');

          // Clear existing watch before starting a new one
          if (watchIdRef.current) {
             await Geolocation.clearWatch({ id: watchIdRef.current });
          }

          watchIdRef.current = await Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 5000 // Allow cached position up to 5 seconds old
            },
            async (position, err) => {
              if (err) {
                console.warn('[useCapacitorLocation] Watch position error:', err);
                return;
              }

              if (position) {
                const newCoords = {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                };

                console.log('[useCapacitorLocation] Watch position update:', newCoords);
                setCoords(newCoords);

                // Reverse geocode for watched position
                try {
                  const geoResult = await locationsearchService.reverseGeocodeCoordinates(newCoords.latitude, newCoords.longitude);
                  setResolvedCity(geoResult?.city || null);
                } catch (geoError) {
                  console.error('[useCapacitorLocation] Reverse geocoding failed in watch:', geoError);
                }
              }
            }
          );
        }
      } catch (e) {
        console.warn('[useCapacitorLocation] Watch setup failed, will rely on initial position:', e);
      }
    };

    // Start watching after initial position is acquired
    const watchTimer = setTimeout(() => {
      startWatching();
    }, 2000);

    return () => {
      clearTimeout(watchTimer);
      if (watchIdRef.current) {
        Geolocation.clearWatch({ id: watchIdRef.current }).catch(() => {});
        watchIdRef.current = null;
      }
    };
  }, [active, checkPermissionsAndGetLocation]);

  const refresh = useCallback(() => {
    retryCountRef.current = 0;
    return checkPermissionsAndGetLocation(0);
  }, [checkPermissionsAndGetLocation]);

  return { coords, error, loading, resolvedCity, refresh }; // Return resolvedCity
};