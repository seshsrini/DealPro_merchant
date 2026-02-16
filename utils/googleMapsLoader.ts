/**
 * Dynamically loads Google Maps JavaScript API with API key from environment variables
 * This prevents exposing the API key in the HTML file
 */

let isLoading = false;
let isLoaded = false;

export const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (isLoaded && (window as any).google?.maps) {
      console.log('[GoogleMapsLoader] Already loaded');
      resolve();
      return;
    }

    // If currently loading, wait for it
    if (isLoading) {
      const checkInterval = setInterval(() => {
        if (isLoaded && (window as any).google?.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    isLoading = true;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('[GoogleMapsLoader] CRITICAL: VITE_GOOGLE_MAPS_API_KEY not found in environment variables!');
      reject(new Error('Google Maps API key not configured'));
      return;
    }

    // Create callback function
    (window as any).initGoogleMaps = function() {
      console.log('[GoogleMapsLoader] SDK loaded successfully');
      (window as any).googleMapsReady = true;
      isLoaded = true;
      isLoading = false;
      // Dispatch custom event to notify components
      window.dispatchEvent(new Event('google-maps-loaded'));
      resolve();
    };

    // Create script element with async loading parameter
    // IMPORTANT: language=en ensures geocoding results (city, state, locality names) are always in English
    // This is critical for database matching, as our database stores location names in English
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&v=weekly&loading=async&language=en&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = (error) => {
      console.error('[GoogleMapsLoader] Failed to load Google Maps SDK:', error);
      isLoading = false;
      reject(error);
    };

    // Append to document
    document.head.appendChild(script);
  });
};
