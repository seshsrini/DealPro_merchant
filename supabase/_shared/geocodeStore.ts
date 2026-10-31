// Fill a store's map position from its address when the app didn't send one.
//
// The consumer "deals near me" search places stores by latitude/longitude; a
// store saved at 0,0 (location permission denied, address typed without the
// map pin) never shows up nearby, even 100 m away. Uses Google Geocoding
// (secret GOOGLE_MAPS_API_KEY, restricted to the Geocoding API). Never throws:
// on any failure the store is saved as before.

// @ts-ignore: Deno global
declare const Deno: { env: { get(key: string): string | undefined } };

type StoreAddress = {
  address?: unknown;
  landmark?: unknown;
  locality?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function hasCoords(s: { latitude?: unknown; longitude?: unknown }): boolean {
  const lat = Number(s.latitude);
  const lng = Number(s.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Address → { latitude, longitude } via Google, or null. */
export async function geocodeStoreAddress(s: StoreAddress): Promise<{ latitude: number; longitude: number } | null> {
  const key = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!key) return null;
  const pin = str(s.pincode);
  const text = [str(s.address), str(s.locality), str(s.city), str(s.state), pin, 'India'].filter(Boolean).join(', ');
  if (!text || text === 'India') return null;
  const components = ['country:IN', /^\d{6}$/.test(pin) ? `postal_code:${pin}` : ''].filter(Boolean).join('|');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(text)}&components=${encodeURIComponent(components)}&region=in&key=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (data?.status !== 'OK' || typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') {
      console.warn('[geocodeStore] no result:', data?.status, data?.error_message ?? '', '|', text.slice(0, 120));
      return null;
    }
    console.log('[geocodeStore] located from address:', text.slice(0, 120), '→', loc.lat, loc.lng, `(${data.results[0].geometry.location_type})`);
    return { latitude: loc.lat, longitude: loc.lng };
  } catch (e) {
    console.warn('[geocodeStore] lookup failed:', (e as Error)?.message);
    return null;
  }
}

/** Mutates each store missing coordinates, filling them from its address where possible. */
export async function fillMissingStoreCoords<T extends StoreAddress>(stores: T[]): Promise<T[]> {
  await Promise.all(stores.map(async (s) => {
    if (hasCoords(s)) return;
    const found = await geocodeStoreAddress(s);
    if (found) {
      (s as any).latitude = found.latitude;
      (s as any).longitude = found.longitude;
    }
  }));
  return stores;
}
