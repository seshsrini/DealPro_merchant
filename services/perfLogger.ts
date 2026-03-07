/**
 * Performance Logger — fire-and-forget, batched performance tracing.
 *
 * Usage:
 *   import { perfTimer } from './services/perfLogger';
 *
 *   const timer = perfTimer('load_merchant_dashboard', 'merchant_dashboard');
 *   timer.mark('service_init');
 *   const data = await merchantService.getDashboardData();
 *   timer.mark('edge_function_response');
 *   setDashboardData(data);
 *   requestAnimationFrame(() => timer.end('render'));
 */

import { supabase } from './supabaseClient';
import { Capacitor } from '@capacitor/core';

const APP_KEY = 'dealpro_merchant';

const sessionId = (() => {
  try { return crypto.randomUUID(); }
  catch { return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`; }
})();

const platform = (() => {
  try {
    const p = Capacitor.getPlatform();
    if (p === 'android' || p === 'ios') return p;
  } catch { /* not native */ }
  return 'web';
})();

// --- Queue & Flush ---
let traceQueue: Record<string, unknown>[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 10;

const flush = (): void => {
  if (traceQueue.length === 0) return;
  const batch = [...traceQueue];
  traceQueue = [];
  supabase.functions.invoke('log-performance', { body: batch }).catch((err) => {
    console.warn('[perfLogger] flush failed:', err?.message);
  });
};

const scheduleFlush = (): void => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
};

// Flush on app background / page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('beforeunload', () => flush());
}

// --- PerfTimer Class ---
export class PerfTimer {
  private action: string;
  private screen: string;
  private start: number;
  private lastMark: number;
  private breakdowns: { label: string; duration_ms: number }[] = [];
  private ended = false;

  constructor(action: string, screen: string) {
    this.action = action;
    this.screen = screen;
    this.start = performance.now();
    this.lastMark = this.start;
  }

  /** Record time elapsed since last mark (or start) under the given label */
  mark(label: string): void {
    if (this.ended) return;
    const now = performance.now();
    this.breakdowns.push({ label, duration_ms: Math.round(now - this.lastMark) });
    this.lastMark = now;
  }

  /** End the trace: optionally record a final segment, then queue for logging */
  end(finalLabel?: string): void {
    if (this.ended) return;
    this.ended = true;
    if (finalLabel) this.mark(finalLabel);
    const total = Math.round(performance.now() - this.start);

    traceQueue.push({
      app_key: APP_KEY,
      action_name: this.action,
      screen: this.screen,
      total_duration_ms: total,
      breakdowns: this.breakdowns,
      platform,
      session_id: sessionId,
    });

    if (traceQueue.length >= FLUSH_THRESHOLD) {
      flush();
    } else {
      scheduleFlush();
    }
  }
}

/** Create a new PerfTimer. Call .mark(label) between steps, then .end(finalLabel). */
export const perfTimer = (action: string, screen: string): PerfTimer => new PerfTimer(action, screen);

/** Force flush the trace queue immediately (e.g., before logout). */
export const flushPerfNow = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flush();
};
