import { supabase } from './supabaseClient';

/**
 * resilientData — one place for robust data loading across the app.
 *
 * The problem it solves: when the app is backgrounded the WebView freezes its
 * timers, the access token can expire, and on resume the first fetches fail
 * (401 / network). Single-attempt fetches that wipe state to empty then blank
 * whole sections (dashboard counts, stores, subscriptions, staff…).
 *
 * This helper makes any fetch:
 *   1. RETRY transient failures with backoff (cold start, 401, network, 5xx).
 *   2. CACHE the last good result in localStorage (durable across resumes).
 *   3. FALL BACK to that cache on failure — so a section keeps its last-good
 *      data instead of vanishing. It only throws if every attempt fails AND
 *      there is nothing cached.
 *
 * Usage:
 *   const stores = await resilientInvoke('get-stores', { merchant_id }, { cacheKey: `stores_${id}` });
 *   const rows   = await resilient(() => supabase.from('x').select('*').then(unwrap), { cacheKey: 'x' });
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isTransient(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || err.error_description || err).toLowerCase();
  const status = err.status || err.statusCode || err?.context?.status;
  if (status && status >= 500 && status < 600) return true;
  if (status === 401 || status === 403 || status === 408 || status === 425 || status === 429) return true;
  return /failed to fetch|network|timeout|timed out|socket|econn|aborted|unauthor|invalid token|expired|jwt/.test(msg);
}

interface ResilientOpts {
  /** localStorage key. When set, the last good result is cached and used as a
   *  fallback on failure (so the UI keeps last-good instead of blanking). */
  cacheKey?: string;
  /** Retry attempts (default 3). */
  attempts?: number;
  /** Base backoff in ms (default 400, exponential). */
  baseDelayMs?: number;
  /** Treat an empty array/null result as "don't cache" (default true) so a
   *  momentary empty response can't poison the cache. */
  skipCacheIfEmpty?: boolean;
}

const CACHE_PREFIX = 'rdc_'; // resilient-data-cache

function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

const isEmpty = (v: any) => v == null || (Array.isArray(v) && v.length === 0);

/** Run an async producer with retry + cache fallback. */
export async function resilient<T>(producer: () => Promise<T>, opts: ResilientOpts = {}): Promise<T> {
  const { cacheKey, attempts = 3, baseDelayMs = 400, skipCacheIfEmpty = true } = opts;
  let lastErr: any = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const data = await producer();
      if (cacheKey && !(skipCacheIfEmpty && isEmpty(data))) writeCache(cacheKey, data);
      return data;
    } catch (err) {
      lastErr = err;
      if (attempt < attempts) {
        const transient = isTransient(err);
        await sleep((transient ? baseDelayMs : baseDelayMs / 2) * Math.pow(2, attempt - 1) + Math.random() * 150);
      }
    }
  }

  if (cacheKey) {
    const cached = readCache<T>(cacheKey);
    if (cached != null) {
      console.warn(`[resilientData] Serving cached "${cacheKey}" after fetch failure.`);
      return cached;
    }
  }
  throw lastErr || new Error('resilient: all attempts failed');
}

/** Convenience wrapper for Edge Function calls. */
export async function resilientInvoke<T = any>(
  functionName: string,
  body?: any,
  opts: ResilientOpts = {},
): Promise<T> {
  return resilient<T>(async () => {
    const { data, error } = await supabase.functions.invoke(functionName, body !== undefined ? { body } : undefined);
    if (error) throw error;
    if (data && typeof data === 'object' && (data as any).error) throw new Error((data as any).error);
    return data as T;
  }, { cacheKey: opts.cacheKey ?? `ef_${functionName}`, ...opts });
}

/** Read a previously cached value without fetching (e.g. for instant first paint). */
export function peekCache<T = any>(cacheKey: string): T | null {
  return readCache<T>(cacheKey);
}
