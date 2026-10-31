import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, ArrowLeft, Image as ImageIcon, X, Link2, MapPin, Globe2, Calendar,
  Loader2, Check, Users, Zap, Heart, Eye, Send, Tag, FileText, Store, Phone, CheckCircle2,
} from 'lucide-react';
import {
  fetchStores, fetchNearbyAreas, fetchLinkableDeals, uploadAnnouncementImage, createAnnouncement,
  type NearbyArea, type LinkableDeal, type TargetingOptions, type MerchantStore,
} from './services/announcementService';
import { addCampaignService } from './services/addCampaignService';

interface Props {
  user: any;
  theme: 'light' | 'dark';
  onBack: () => void;
  onCreated: () => void;
}

const TITLE_MAX = 30;
const DESC_MAX = 200;
const MAX_AREAS = 3;
/** Announcements run for 15 days, inclusive of the start date (server-enforced too). */
const ANNOUNCEMENT_DAYS = 15;
const ALL_STORES = '__all__';

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const AnnouncementWizard: React.FC<Props> = ({ user, theme, onBack, onCreated }) => {
  const isDark = theme === 'dark';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [storeSel, setStoreSel] = useState<string>(ALL_STORES);
  const [showContact, setShowContact] = useState(false);
  const [contactStoreId, setContactStoreId] = useState<string>('');
  const [targeting, setTargeting] = useState<TargetingOptions>({ city: null, anchorPincode: null, nearbyAreas: [] });
  const [deals, setDeals] = useState<LinkableDeal[]>([]);
  const [mode, setMode] = useState<'area' | 'city'>('area');
  const [selectedPincodes, setSelectedPincodes] = useState<string[]>([]);
  const [linkedDeal, setLinkedDeal] = useState('');
  // Today in India (IST). Using the UTC date let the picker offer YESTERDAY
  // between midnight and 05:30 IST.
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const [sendFrom, setSendFrom] = useState(today);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sendTo = useMemo(() => addDaysISO(sendFrom, ANNOUNCEMENT_DAYS - 1), [sendFrom]);

  // Load stores + linkable deals once.
  useEffect(() => {
    if (!user?.id) return;
    fetchStores(user.id).then((s) => {
      setStores(s);
      setStoreSel(s.length === 1 ? s[0].id : ALL_STORES);
      if (s[0]) setContactStoreId(s[0].id);
    }).catch(() => {});
    fetchLinkableDeals(user.id).then(setDeals).catch(() => {});
  }, [user?.id]);

  // The store that anchors the audience suggestions (the selected one, or the
  // first store when "All stores" is chosen).
  const anchorStore: MerchantStore | undefined = useMemo(
    () => (storeSel === ALL_STORES ? stores[0] : stores.find((s) => s.id === storeSel)) || stores[0],
    [storeSel, stores],
  );

  // Recompute nearby areas whenever the anchor store changes.
  useEffect(() => {
    if (!anchorStore) return;
    fetchNearbyAreas({ pincode: anchorStore.pincode, city: anchorStore.city, locality: anchorStore.locality })
      .then((opts) => {
        setTargeting(opts);
        if (storeSel === ALL_STORES) { setMode('city'); setSelectedPincodes(opts.nearbyAreas[0] ? [opts.nearbyAreas[0].pincode] : []); }
        else { setMode('area'); setSelectedPincodes(opts.nearbyAreas[0] ? [opts.nearbyAreas[0].pincode] : []); }
      })
      .catch(() => {});
  }, [anchorStore?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAreas: NearbyArea[] = useMemo(
    () => targeting.nearbyAreas.filter((a) => selectedPincodes.includes(a.pincode)),
    [targeting.nearbyAreas, selectedPincodes],
  );

  const toggleArea = (pincode: string) => {
    setMode('area'); setError(null);
    setSelectedPincodes((prev) => {
      if (prev.includes(pincode)) return prev.filter((p) => p !== pincode);
      if (prev.length >= MAX_AREAS) { setError(`You can pick up to ${MAX_AREAS} areas.`); return prev; }
      return [...prev, pincode];
    });
  };

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null); setUploading(true);
    try {
      // Scan the photo for inappropriate content before it's uploaded anywhere.
      const mod = await addCampaignService.moderateImage(f);
      if (mod.flagged) { setError(mod.reason || 'This image looks inappropriate for a public announcement. Please choose another.'); return; }
      setImageUrl(await uploadAnnouncementImage(f));
    }
    catch (err: any) { setError(err?.message || 'Image upload failed.'); }
    finally { setUploading(false); }
  };

  const audienceOk = mode === 'city' ? !!targeting.city : selectedAreas.length >= 1;
  const canSubmit = !!(title.trim() && description.trim() && audienceOk && !submitting && !uploading);

  const effContactStoreId = storeSel === ALL_STORES ? contactStoreId : storeSel;
  const contactStore = stores.find((s) => s.id === effContactStoreId);

  const submit = async () => {
    if (!audienceOk) { setError('Please choose who should see this.'); return; }
    if (showContact && !effContactStoreId) { setError('Choose which store\'s address to show.'); return; }
    setError(null); setSubmitting(true);
    try {
      // Profanity / inappropriate-language check on title + description.
      const mod = await addCampaignService.moderateContent(title.trim(), '', description.trim());
      if (mod.flagged) { setError(mod.reason || 'Please remove inappropriate language and try again.'); setSubmitting(false); return; }
      await createAnnouncement({
        title: title.trim(),
        description: description.trim(),
        image_url: imageUrl,
        linked_campaign_id: linkedDeal || null,
        send_from: sendFrom,
        store_id: storeSel === ALL_STORES ? null : storeSel,
        show_store_contact: showContact,
        contact_store_id: showContact ? effContactStoreId : null,
        ...(mode === 'city'
          ? { target_type: 'city', target_city: targeting.city }
          : {
              target_type: 'area',
              target_pincodes: selectedAreas.map((a) => a.pincode),
              target_localities: selectedAreas.map((a) => a.locality),
            }),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Could not create the announcement.');
    } finally { setSubmitting(false); }
  };

  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const labelC = isDark ? 'text-slate-200' : 'text-slate-800';
  const inputC = `w-full rounded-xl px-3 py-2 text-sm border outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'}`;

  const stat = (Icon: any, big: string, small: string, tint: string) => (
    <div className="flex items-center gap-1.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tint}`}><Icon className="w-3.5 h-3.5 text-white" /></div>
      <div className="leading-none"><p className="text-[11px] font-bold text-white">{big}</p><p className="text-[9px] text-white/70">{small}</p></div>
    </div>
  );

  const contactLines = contactStore
    ? { name: contactStore.store_name, addr: [contactStore.locality, contactStore.city, contactStore.pincode].filter(Boolean).join(', ') }
    : null;

  return (
    <div className={`fixed inset-0 z-[60] max-w-md mx-auto flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-4 pt-4 pb-4">
          <button onClick={onBack} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="flex items-start gap-3 mt-6">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Megaphone className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-white leading-tight">Share a New Announcement</h1>
              <p className="text-xs text-white/80">Keep your customers informed and engaged</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            {stat(Users, 'Reach', 'Local customers', 'bg-emerald-500/80')}
            {stat(Zap, 'Drive', 'More footfall', 'bg-orange-500/80')}
            {stat(Heart, 'Grow', 'Your business', 'bg-rose-500/80')}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</div>
          )}

          {/* Title + Description */}
          <div className={`rounded-2xl border p-3 space-y-3 ${card}`}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={`text-xs font-semibold flex items-center gap-1 ${labelC}`}><Tag className="w-3 h-3" /> Title <span className="text-red-500">*</span></label>
                <span className={`text-[10px] ${title.length >= TITLE_MAX ? 'text-red-500' : 'text-slate-400'}`}>{title.length}/{TITLE_MAX}</span>
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))} placeholder="Grand reopening this weekend!" className={inputC} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className={`text-xs font-semibold flex items-center gap-1 ${labelC}`}><FileText className="w-3 h-3" /> Description <span className="text-red-500">*</span></label>
                <span className={`text-[10px] ${description.length >= DESC_MAX ? 'text-red-500' : 'text-slate-400'}`}>{description.length}/{DESC_MAX}</span>
              </div>
              <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))} rows={2}
                placeholder="Tell your customers what is happening..." className={`${inputC} resize-none`} />
            </div>
          </div>

          {/* Photo + deal link */}
          <div className={`rounded-2xl border p-3 ${card}`}>
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              {imageUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0">
                  <img src={imageUrl} className="w-full h-full object-cover" alt="announcement" />
                  <button onClick={() => setImageUrl(null)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  className={`w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-0.5 shrink-0 ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ImageIcon className="w-5 h-5" /><span className="text-[9px]">Photo</span></>}
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${labelC}`}>Photo <span className="text-slate-400 font-normal">(optional)</span></p>
                {deals.length > 0 ? (
                  <>
                    <label className={`text-[11px] flex items-center gap-1 mt-2 mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}><Link2 className="w-3 h-3" /> Link a deal</label>
                    <select value={linkedDeal} onChange={(e) => setLinkedDeal(e.target.value)} className={`${inputC} py-1.5`}>
                      <option value="">No deal linked</option>
                      {deals.map((d) => <option key={d.campaign_id} value={d.campaign_id}>{d.deal_heading}</option>)}
                    </select>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">A clear, attractive image gets more taps.</p>
                )}
              </div>
            </div>
          </div>

          {/* Store selection + contact */}
          <div className={`rounded-2xl border p-3 space-y-2.5 ${card}`}>
            <label className={`text-xs font-semibold flex items-center gap-1 ${labelC}`}><Store className="w-3 h-3" /> From which store?</label>
            <select value={storeSel} onChange={(e) => setStoreSel(e.target.value)} className={inputC}>
              {stores.length > 1 && <option value={ALL_STORES}>All stores</option>}
              {stores.map((s) => <option key={s.id} value={s.id}>{s.store_name}{s.locality ? ` — ${s.locality}` : ''}</option>)}
              {stores.length === 0 && <option value={ALL_STORES}>All stores</option>}
            </select>

            <button onClick={() => setShowContact((v) => !v)}
              className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 border text-left ${showContact ? 'border-indigo-500 bg-indigo-500/10' : isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <span className={`w-4 h-4 rounded flex items-center justify-center border ${showContact ? 'bg-indigo-600 border-indigo-600' : isDark ? 'border-slate-600' : 'border-slate-300'}`}>
                {showContact && <Check className="w-3 h-3 text-white" />}
              </span>
              <span className={`text-xs ${labelC}`}>Include store address & phone in the banner</span>
            </button>

            {showContact && storeSel === ALL_STORES && (
              <div>
                <p className="text-[11px] text-slate-400 mb-1">Which store's address to show?</p>
                <select value={contactStoreId} onChange={(e) => setContactStoreId(e.target.value)} className={inputC}>
                  {stores.map((s) => <option key={s.id} value={s.id}>{s.store_name}{s.locality ? ` — ${s.locality}` : ''}</option>)}
                </select>
              </div>
            )}
            {showContact && contactLines && (
              <div className={`rounded-xl px-3 py-2 text-[11px] ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                <span className="font-semibold">{contactLines.name}</span>{contactLines.addr ? ` · ${contactLines.addr}` : ''}
              </div>
            )}
          </div>

          {/* Audience */}
          <div className={`rounded-2xl border p-3 ${card}`}>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs font-semibold ${labelC}`}>Who should see this?</label>
              {mode === 'area' && <span className="text-[10px] text-slate-400">{selectedAreas.length}/{MAX_AREAS} areas</span>}
            </div>

            {targeting.nearbyAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {targeting.nearbyAreas.map((a, i) => {
                  const active = mode === 'area' && selectedPincodes.includes(a.pincode);
                  return (
                    <button key={a.pincode + i} onClick={() => toggleArea(a.pincode)}
                      className={`flex items-center gap-1 rounded-full pl-2 pr-2.5 py-1 text-[11px] border transition-all ${active ? 'bg-indigo-600 border-indigo-600 text-white' : isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                      {active ? <Check className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                      {a.locality}{i === 0 && storeSel !== ALL_STORES ? ' · your area' : ''}
                    </button>
                  );
                })}
              </div>
            )}

            {targeting.city && (
              <button onClick={() => { setMode('city'); setError(null); }}
                className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 border text-left transition-all ${mode === 'city' ? 'border-indigo-500 bg-indigo-500/10' : isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <Globe2 className={`w-4 h-4 ${mode === 'city' ? 'text-indigo-500' : 'text-slate-400'}`} />
                <div className="flex-1">
                  <p className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>All of {targeting.city}</p>
                  <p className="text-[10px] text-slate-400">Everyone in the city</p>
                </div>
                {mode === 'city' && <Check className="w-4 h-4 text-indigo-500" />}
              </button>
            )}

            {targeting.nearbyAreas.length === 0 && !targeting.city && (
              <p className="text-xs text-slate-400">Add a store with a location first to choose an audience.</p>
            )}
            <p className="text-[10px] text-slate-400 mt-2">
              {mode === 'area' ? 'Pick your area plus nearby ones to reach a wider local audience.' : `Shown to customers across ${targeting.city}.`}
            </p>
          </div>

          {/* When to notify */}
          <div className={`rounded-2xl border p-3 ${card}`}>
            <label className={`text-xs font-semibold flex items-center gap-1 mb-2 ${labelC}`}><Calendar className="w-3 h-3" /> When to notify</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-slate-400 mb-1">From</p>
                <input type="date" min={today} value={sendFrom} onChange={(e) => setSendFrom(e.target.value && e.target.value >= today ? e.target.value : today)} className={inputC} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 mb-1">To (auto · {ANNOUNCEMENT_DAYS} days)</p>
                <input type="date" value={sendTo} readOnly disabled className={`${inputC} opacity-60 cursor-not-allowed`} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">Consumers see this banner for {ANNOUNCEMENT_DAYS} days, then it expires automatically.</p>
          </div>
        </div>
      </div>

      {/* Pinned footer */}
      <div className={`shrink-0 border-t px-4 py-2.5 flex gap-2 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.625rem)' }}>
        <button onClick={() => setShowPreview(true)} disabled={!title.trim() && !description.trim()}
          className={`px-4 h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 border ${isDark ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-700'} disabled:opacity-50`}>
          <Eye className="w-4 h-4" /> Preview
        </button>
        <button onClick={submit} disabled={!canSubmit}
          className={`flex-1 h-11 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-1.5 transition-all ${canSubmit ? 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 active:scale-[0.98]' : 'bg-slate-400 cursor-not-allowed'}`}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Publish Announcement</>}
        </button>
      </div>

      {/* Success confirmation */}
      {submitted && (
        <div className="fixed inset-0 z-[950] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl text-center ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="pt-7 pb-2 flex justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
            </div>
            <div className="px-6 pb-6">
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Announcement published!</h2>
              <p className={`mt-1.5 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Your customers will see it{mode === 'city' ? ` across ${targeting.city}` : ' in the selected areas'} and get a notification.
              </p>
              <button onClick={onCreated}
                className="mt-5 w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-sm font-semibold active:scale-[0.98]">
                View announcements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm" onClick={() => setShowPreview(false)}>
          <div className={`w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-5 pt-4 pb-3">
              <span className="absolute top-2 right-2 text-[10px] text-white/70">Preview</span>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center"><Megaphone className="w-4 h-4 text-white" /></div>
                <p className="text-[11px] uppercase tracking-wide text-white/80 font-semibold">Announcement</p>
              </div>
            </div>
            {imageUrl && <img src={imageUrl} alt="" className="w-full h-40 object-cover" />}
            <div className="px-5 py-4">
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title || 'Your title'}</h2>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{description || 'Your description will appear here.'}</p>
              {showContact && contactLines && (
                <div className={`mt-3 rounded-xl px-3 py-2 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <p className={`text-xs font-semibold flex items-center gap-1 ${isDark ? 'text-white' : 'text-slate-900'}`}><Store className="w-3 h-3" /> {contactLines.name}</p>
                  {contactLines.addr && <p className="text-[11px] text-slate-400 mt-0.5">{contactLines.addr}</p>}
                  {contactStore?.phone && <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {contactStore.phone}</p>}
                </div>
              )}
              <button onClick={() => setShowPreview(false)} className="mt-4 w-full h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white text-sm font-semibold">
                Close preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
