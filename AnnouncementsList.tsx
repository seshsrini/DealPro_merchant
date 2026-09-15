import React, { useEffect, useState } from 'react';
import { Megaphone, ArrowLeft, MapPin, Globe2, Calendar, Loader2, Link2, Store } from 'lucide-react';
import { fetchMyAnnouncements, type MyAnnouncement, type AnnouncementStatus } from './services/announcementService';

interface Props {
  user: any;
  theme: 'light' | 'dark';
  onBack: () => void;
}

const fmt = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const badge: Record<AnnouncementStatus, { label: string; cls: string }> = {
  active:    { label: 'Active',    cls: 'bg-emerald-500/15 text-emerald-500' },
  scheduled: { label: 'Scheduled', cls: 'bg-amber-500/15 text-amber-500' },
  expired:   { label: 'Expired',   cls: 'bg-slate-500/15 text-slate-400' },
};

export const AnnouncementsList: React.FC<Props> = ({ user, theme, onBack }) => {
  const isDark = theme === 'dark';
  const [items, setItems] = useState<MyAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchMyAnnouncements(user.id).then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, [user?.id]);

  const audience = (a: MyAnnouncement) => {
    if (a.target_type === 'city') return `All of ${a.target_city || 'city'}`;
    const list = (a.target_localities || []).filter(Boolean);
    if (list.length) return list.join(', ');
    return (a.target_pincodes || []).filter(Boolean).join(', ') || 'Selected areas';
  };

  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  return (
    <div className={`fixed inset-0 z-[60] max-w-md mx-auto flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-4 pt-4 pb-4 shrink-0">
        <button onClick={onBack} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex items-center gap-3 mt-6">
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Megaphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Your Announcements</h1>
            <p className="text-xs text-white/80">{items.length} total · active shown first</p>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className={`w-10 h-10 mb-3 ${isDark ? 'text-slate-700' : 'text-slate-300'}`} />
            <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>No announcements yet</p>
            <p className="text-xs text-slate-400 mt-1">Create one from the My Campaigns page.</p>
          </div>
        ) : (
          items.map((a) => {
            const b = badge[a.status];
            return (
              <div key={a.id} className={`rounded-2xl border p-3 ${card} ${a.status === 'expired' ? 'opacity-70' : ''}`}>
                <div className="flex gap-3">
                  {a.image_url ? (
                    <img src={a.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <Megaphone className="w-6 h-6 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{a.title}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${b.cls}`}>{b.label}</span>
                    </div>
                    <p className={`text-xs mt-1 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{a.description}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        {a.target_type === 'city' ? <Globe2 className="w-3 h-3" /> : <MapPin className="w-3 h-3" />} {audience(a)}
                      </span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmt(a.send_from)} – {fmt(a.send_to)}</span>
                      {a.linked_campaign_id && <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> Deal</span>}
                      {a.show_store_contact && <span className="flex items-center gap-1"><Store className="w-3 h-3" /> Contact</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
