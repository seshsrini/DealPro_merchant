import React, { useEffect, useRef, useState } from 'react';
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
    <div className="fixed inset-0 z-[900] bg-black/60 flex items-center justify-center px-6">
      <div className={`w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        {banner.image_url && (
          <img
            src={banner.image_url}
            alt=""
            className="w-full h-40 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        <div className="p-5 text-center">
          <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{banner.title}</h3>
          {/* message supports basic formatting (bold / line breaks), sanitized */}
          <div
            className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(banner.message) }}
          />
          {canLink && (
            <button
              onClick={onLinkTap}
              className={`mt-3 text-sm font-semibold underline underline-offset-2 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
            >
              {banner.link_label}
            </button>
          )}
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={dismiss}
            className="w-full h-11 rounded-xl bg-amber-500 text-white text-sm font-bold active:scale-[0.98] transition-all"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
