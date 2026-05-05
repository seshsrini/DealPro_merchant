import { MerchantStore } from '../types';

const STORAGE_KEY = 'dealpro_merchant_stores_cache_v1';
const SCHEMA_VERSION = 1;
// Stores rarely change. 1 hour keeps the data fresh enough while sparing the network
// (and the edge function — every avoided call is one less chance to trip an auth error).
// Cache is busted explicitly on add/update/delete so edits show up immediately.
const FRESH_TTL_MS = 60 * 60 * 1000;

interface PersistedEntry {
  stores: MerchantStore[];
  timestamp: number;
}

interface PersistedShape {
  v: number;
  byMerchant: Record<string, PersistedEntry>;
}

function readAll(): Record<string, PersistedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.byMerchant) return {};
    return parsed.byMerchant;
  } catch {
    return {};
  }
}

function writeAll(byMerchant: Record<string, PersistedEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, byMerchant }));
  } catch {
    // Quota / disabled storage — ignore.
  }
}

export interface CachedStoresResult {
  stores: MerchantStore[];
  ageMs: number;
  isFresh: boolean;
}

export function loadCachedStores(merchantId: string): CachedStoresResult | null {
  const all = readAll();
  const entry = all[merchantId];
  if (!entry) return null;
  const ageMs = Date.now() - entry.timestamp;
  return { stores: entry.stores, ageMs, isFresh: ageMs < FRESH_TTL_MS };
}

export function saveCachedStores(merchantId: string, stores: MerchantStore[]): void {
  const all = readAll();
  all[merchantId] = { stores, timestamp: Date.now() };
  writeAll(all);
}

export function clearCachedStores(merchantId?: string): void {
  if (!merchantId) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    return;
  }
  const all = readAll();
  if (merchantId in all) {
    delete all[merchantId];
    writeAll(all);
  }
}
