import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image as ImageIcon, Loader2, RotateCcw, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { uploadProductPhoto } from '../services/productPhotoUpload';

/**
 * "Your photo" for a product the merchant added from the DealFynd catalogue: take or pick a photo
 * to show instead of the catalogue photo, or go back to the catalogue photo. Before uploading, the
 * merchant ticks the photo notice (Terms of Service 4.4): the photo is theirs to use, and if the
 * catalogue has no photo for this product yet, DealFynd may use it there (after review).
 */
const TERMS_KEY = (merchantId: string) => `catalogue_photo_terms_v1_${merchantId}`;

async function setPhoto(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('catalog-browse', { body: { action: 'set_photo', ...body } });
  if (error) {
    let msg = 'Could not save the photo. Please try again.';
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data as { ok: boolean; imageUrl: string | null; contributed: boolean };
}

export const CataloguePhotoSheet: React.FC<{
  productId: string;
  productName: string;
  merchantId: string;
  hasOwnPhoto: boolean;
  theme: 'light' | 'dark';
  onClose: () => void;
  onSaved: (imageUrl: string | null, ownPhoto: boolean) => void;
}> = ({ productId, productName, merchantId, hasOwnPhoto, theme, onClose, onSaved }) => {
  const isDark = theme === 'dark';
  const [agreed, setAgreed] = useState(() => {
    try { return localStorage.getItem(TERMS_KEY(merchantId)) === '1'; } catch { return false; }
  });
  const [busy, setBusy] = useState<'upload' | 'reset' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ contributed: boolean } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const tick = (v: boolean) => {
    setAgreed(v);
    try { localStorage.setItem(TERMS_KEY(merchantId), v ? '1' : '0'); } catch { /* not critical */ }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose a photo.'); return; }
    setBusy('upload');
    setError(null);
    try {
      const up = await uploadProductPhoto(file);
      const r = await setPhoto({ productId, imageUrl: up.url, width: up.width, height: up.height, agreedTerms: true });
      onSaved(r.imageUrl, true);
      setDone({ contributed: r.contributed });
    } catch (err: any) {
      setError(err?.message || 'Could not upload the photo. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const useCataloguePhoto = async () => {
    setBusy('reset');
    setError(null);
    try {
      const r = await setPhoto({ productId, imageUrl: null });
      onSaved(r.imageUrl, false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not change the photo. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const card = isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const btn = 'w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50" onClick={busy ? undefined : onClose}>
      <div className={`w-full max-w-md rounded-t-2xl sm:rounded-2xl border p-5 space-y-4 ${card}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{done ? 'Photo saved' : 'Your own photo'}</h3>
            <p className={`text-xs mt-0.5 truncate ${muted}`}>{productName}</p>
          </div>
          <button onClick={onClose} disabled={!!busy} aria-label="Close" className={muted}><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <>
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <p>
                Customers now see your photo for this product.
                {done.contributed && ' This product had no DealFynd photo yet, so we may also use yours in the DealFynd catalogue after a quick review. Thank you!'}
              </p>
            </div>
            <button onClick={onClose} className={`${btn} bg-slate-900 text-white`}>Done</button>
          </>
        ) : (
          <>
            <p className={`text-sm ${muted}`}>
              Show customers your actual product. Your photo replaces the DealFynd photo on this product in your shop.
            </p>
            <ul className={`text-xs space-y-1 list-disc pl-4 ${muted}`}>
              <li>Only the product, on a plain background, in good light.</li>
              <li>No people or faces, and no phone numbers, prices or other text added on the photo.</li>
            </ul>

            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${
              isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'
            }`}>
              <input type="checkbox" checked={agreed} onChange={(e) => tick(e.target.checked)} className="w-4 h-4 mt-0.5 shrink-0 accent-slate-900" />
              <span className="text-xs leading-relaxed">
                I took this photo or have the right to use it. If this product has no photo in the DealFynd
                catalogue yet, I allow DealFynd to use my photo there too, where other shops and customers can
                see it (Terms of Service, section 4.4).
              </span>
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
            <input ref={galleryRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            <div className="grid grid-cols-2 gap-2">
              <button disabled={!agreed || !!busy} onClick={() => cameraRef.current?.click()} className={`${btn} bg-slate-900 text-white`}>
                {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} Take photo
              </button>
              <button disabled={!agreed || !!busy} onClick={() => galleryRef.current?.click()}
                className={`${btn} border ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
                <ImageIcon className="w-4 h-4" /> Gallery
              </button>
            </div>
            {!agreed && <p className={`text-[11px] text-center ${muted}`}>Tick the box above to add a photo.</p>}
            {hasOwnPhoto && (
              <button disabled={!!busy} onClick={useCataloguePhoto} className={`w-full text-xs font-medium flex items-center justify-center gap-1.5 ${muted}`}>
                {busy === 'reset' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Use the DealFynd photo instead
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};
