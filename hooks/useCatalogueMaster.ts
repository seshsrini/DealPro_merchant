import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Is the DealFynd catalogue master live on this backend?
 *
 * The same app build ships to DEV and PROD, but the catalogue (catalog-browse edge function +
 * catalogue tables and data) is switched on per database. The app asks catalog-browse for the
 * category tree: catalogue features show only when it answers with at least one category. On a
 * database without the catalogue the function is missing or empty, so every catalogue entry
 * point stays hidden, and they appear on their own once the catalogue is loaded, with no
 * new app release.
 *
 * One check per app session (a "no" is re-checked after a minute).
 */
let pending: Promise<boolean> | null = null;

export function catalogueMasterAvailable(): Promise<boolean> {
  if (!pending) {
    pending = supabase.functions
      .invoke('catalog-browse', { body: { action: 'tree' } })
      .then(({ data, error }) => !error && Array.isArray((data as any)?.categories) && (data as any).categories.length > 0)
      .catch(() => false)
      .then((ok) => {
        if (!ok) setTimeout(() => { pending = null; }, 60_000);
        return ok;
      });
  }
  return pending;
}

/** false until the catalogue is confirmed live. */
export function useCatalogueMaster(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    catalogueMasterAvailable().then((v) => { if (alive) setOk(v); });
    return () => { alive = false; };
  }, []);
  return ok;
}
