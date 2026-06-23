import { useEffect, useRef } from 'react';

/**
 * useResumeRefetch — re-run a loader when the app returns to the foreground.
 *
 * When the app is backgrounded the WebView freezes; on resume, data is often
 * stale (and the token may have expired). This fires `refetch` on every
 * foreground transition (visibilitychange / focus), throttled so rapid toggles
 * don't spam. Pair the loader with `resilient()` (retry + cache fallback) so the
 * re-fetch recovers the token and never blanks the section.
 */
export function useResumeRefetch(refetch: () => void, throttleMs = 4000): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    let last = 0;
    const onResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - last < throttleMs) return;
      last = now;
      try {
        refetchRef.current();
      } catch {
        /* loader is best-effort */
      }
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [throttleMs]);
}
