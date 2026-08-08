import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { bannerService, ActiveBanner } from '../services/bannerService';
import { sanitizeHtml } from '../utils/sanitizeHtml';

interface Props {
  userId: string;
  audience: 'consumer' | 'merchant';
  /** True when the user is on the app's Home screen — the banner pops there. */
  isHome: boolean;
  theme: 'light' | 'dark';
  /** In-app "browse deals" handler for a banner's link_search term (consumer). */
  onLinkSearch?: (term: string) => void;
}

const POLL_MS = 60_000; // silent check every 60s

const openExternal = (url: string) => {
  // '_system' opens the OS browser on Capacitor; falls back to a normal open.
  try { window.open(url, '_system'); } catch { try { window.open(url, '_blank'); } catch { /* ignore */ } }
};

/**
 * "Sleeping banner": silently polls for an active, geo-targeted broadcast banner
 * every 60s and, when the user is on Home, pops it up ONCE (a card with an OK
 * button + optional CTA link). OK/CTA acknowledges it server-side so it never
 * returns for this user. Renders nothing when no banner is active.
 */
export const SleepingBanner: React.FC<Props> = ({ userId, audience, isHome, theme, onLinkSearch }) => {
  const isDark = theme === 'dark';
  const [banner, setBanner] = useState<ActiveBanner | null>(null);
  const [show, setShow] = useState(false);
  const acking = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const b = await bannerService.getActiveBanner(audience, userId);
      if (!cancelled) setBanner(b);
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [userId, audience]);

  useEffect(() => {
    if (isHome && banner && !show) setShow(true);
  }, [isHome, banner, show]);

  const dismiss = async () => {
    if (acking.current) return true;
    acking.current = true;
    const b = banner;
    setShow(false);
    setBanner(null);
    if (b) await bannerService.ackBanner(b.id, userId);
    acking.current = false;
    return true;
  };

  if (!show || !banner) return null;

  const canLink = !!banner.link_label && (!!banner.link_url || (!!banner.link_search && !!onLinkSearch));
  const onLinkTap = async () => {
    const url = banner.link_url; const term = banner.link_search;
    await dismiss(); // engaging with the link also acknowledges it
    if (url) openExternal(url);
    else if (term && onLinkSearch) onLinkSearch(term);
  };

  return (
    // Full-screen banner constrained to the app's mobile frame (max-w-md) so a
    // desktop browser shows a phone-width column, not the whole viewport. Warm
    // amber / orange / yellow gradient surface.
    <div className={`fixed inset-0 z-[900] flex justify-center ${isDark ? 'bg-black/70' : 'bg-black/50'}`}>
      <div className="relative w-full max-w-md h-full flex flex-col select-none overflow-hidden bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-50">
        {/* Hero image */}
        {banner.image_url ? (
          <div className="relative w-full h-[42%] overflow-hidden shrink-0">
            <img
              src={banner.image_url}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
            />
            {/* fade the image into the warm background so text below reads cleanly */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-orange-100 to-transparent" />
          </div>
        ) : (
          <div className="pt-16 shrink-0" />
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4 leading-tight text-slate-900">
            {banner.title}
          </h2>
          {/* message supports basic formatting (bold / line breaks), sanitized */}
          <div
            className="text-base leading-relaxed max-w-md text-slate-700"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(banner.message) }}
          />
          {canLink && (
            <button
              onClick={onLinkTap}
              className="mt-6 text-base font-semibold underline underline-offset-4 text-orange-700"
            >
              {banner.link_label}
            </button>
          )}
        </div>

        {/* Bottom action — arrow to acknowledge, like the onboarding "next" button */}
        <div className="px-8 pb-10 pt-4 shrink-0 flex justify-end">
          <button
            onClick={dismiss}
            aria-label="Got it"
            className="w-14 h-14 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-center active:scale-90 transition-all shadow-lg"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
