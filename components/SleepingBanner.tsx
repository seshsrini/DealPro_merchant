import React, { useEffect, useRef, useState } from 'react';
import { bannerService, ActiveBanner } from '../services/bannerService';

interface Props {
  userId: string;
  audience: 'consumer' | 'merchant';
  /** The viewer's area (city), used to fill dynamic {count} banners. Optional. */
  city?: string | null;
  /** True when the user is on the app's Home screen — the banner pops there. */
  isHome: boolean;
  theme: 'light' | 'dark';
}

const POLL_MS = 60_000; // silent check every 60s

/**
 * "Sleeping banner": silently polls for an active broadcast banner every 60s and,
 * when the user is on Home, pops it up ONCE (a card with an OK button). OK marks it
 * acknowledged server-side so it never returns for this user. Renders nothing when
 * there's no active banner — truly dormant until you activate a row.
 */
export const SleepingBanner: React.FC<Props> = ({ userId, audience, city, isHome, theme }) => {
  const isDark = theme === 'dark';
  const [banner, setBanner] = useState<ActiveBanner | null>(null);
  const [show, setShow] = useState(false);
  const acking = useRef(false);

  // Poll silently (mount + every 60s) while logged in.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const b = await bannerService.getActiveBanner(audience, userId, city);
      if (!cancelled) setBanner(b);
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [userId, audience, city]);

  // Pop it once when the user is on Home and a banner is available.
  useEffect(() => {
    if (isHome && banner && !show) setShow(true);
  }, [isHome, banner, show]);

  const handleOk = async () => {
    if (acking.current) return;
    acking.current = true;
    const b = banner;
    setShow(false);
    setBanner(null);
    if (b) await bannerService.ackBanner(b.id, userId);
    acking.current = false;
  };

  if (!show || !banner) return null;

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
          <p className={`text-sm leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {banner.message}
          </p>
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={handleOk}
            className="w-full h-11 rounded-xl bg-amber-500 text-white text-sm font-bold active:scale-[0.98] transition-all"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
