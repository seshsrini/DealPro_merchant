/**
 * ImageUploader.tsx
 * Merchant product image uploader backed by Cloudinary.
 *
 * Flow:
 *  1. Merchant taps "Choose Image" → native file picker opens
 *  2. On file selection → calls `cloudinary-sign` edge function for a signed signature
 *  3. POSTs the file directly to Cloudinary with the signature
 *  4. Calls onChange(secure_url) on success
 *
 * Fallback: "Use placeholder" toggle sets imageUrl to null and shows a
 *           category-specific emoji icon instead.
 */

import React, { useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';

// Category-specific placeholder emojis (keyed on first word of category label, lowercase)
const CATEGORY_ICONS: Record<string, string> = {
  electronics:  '📺',
  mobiles:      '📱',
  computers:    '💻',
  fashion:      '👗',
  clothing:     '👕',
  footwear:     '👟',
  groceries:    '🛒',
  food:         '🍔',
  beauty:       '💄',
  health:       '💊',
  sports:       '⚽',
  furniture:    '🛋️',
  home:         '🏠',
  books:        '📚',
  stationery:   '✏️',
  toys:         '🧸',
  automotive:   '🚗',
  jewellery:    '💍',
};

function placeholderForCategory(categoryLabel: string): string {
  const key = categoryLabel.toLowerCase().split(' ')[0];
  return CATEGORY_ICONS[key] ?? '📦';
}

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
  theme: 'light' | 'dark';
  categoryLabel?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  theme,
  categoryLabel = '',
}) => {
  const isDark   = theme === 'dark';
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading,      setUploading]      = useState(false);
  const [usePlaceholder, setUsePlaceholder] = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);

  const icon = placeholderForCategory(categoryLabel);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset so the same file can be re-selected

    setUploading(true);
    setUploadError(null);

    try {
      // Step 1 — get signature from edge function
      const { data: signData, error: signErr } = await supabase.functions.invoke('cloudinary-sign', {
        body: { folder: 'dealpro-products' },
      });
      if (signErr) throw new Error(signErr.message ?? 'Signing failed');

      const { signature, timestamp, api_key, cloud_name, folder } = signData;

      // Step 2 — upload directly to Cloudinary
      const form = new FormData();
      form.append('file',      file);
      form.append('signature', signature);
      form.append('timestamp', String(timestamp));
      form.append('api_key',   api_key);
      form.append('folder',    folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        { method: 'POST', body: form, signal: AbortSignal.timeout(30000) }
      );
      if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`);

      const json = await res.json();
      onChange(json.secure_url as string);
      setUsePlaceholder(false);
    } catch (err: any) {
      console.error('[ImageUploader]', err);
      setUploadError('Upload failed — check connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handlePlaceholderToggle = () => {
    const next = !usePlaceholder;
    setUsePlaceholder(next);
    if (next) onChange(null); // clear URL — card will show icon
    setUploadError(null);
  };

  const hasImage = !!value && !usePlaceholder;

  return (
    <div className="space-y-3">
      <label className={`block text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Product Image
      </label>

      {/* ── Upload / preview area ──────────────────────────────────────────── */}
      <div
        className={`relative w-full rounded-2xl overflow-hidden border-2 border-dashed transition-all
          ${isDark ? 'border-slate-600 bg-slate-800/40' : 'border-slate-300 bg-slate-50'}
          ${hasImage ? 'aspect-video' : 'aspect-[4/3]'}`}
      >
        {hasImage ? (
          /* ── Image preview ────────────────────────────────────────────── */
          <>
            <img
              src={value!}
              alt="product preview"
              className="w-full h-full object-contain"
              onError={() => onChange(null)}
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </>
        ) : usePlaceholder ? (
          /* ── Placeholder icon ─────────────────────────────────────────── */
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 py-8">
            <span className="text-6xl leading-none">{icon}</span>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Placeholder — no image
            </p>
          </div>
        ) : (
          /* ── Upload tap area ──────────────────────────────────────────── */
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-full flex flex-col items-center justify-center gap-3 py-8"
          >
            {uploading ? (
              <Loader2 className={`w-10 h-10 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            ) : (
              <Upload className={`w-10 h-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            )}
            <div className="text-center">
              <p className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {uploading ? 'Uploading…' : 'Tap to upload image'}
              </p>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                JPG · PNG · WEBP · up to 10 MB
              </p>
            </div>
          </button>
        )}
      </div>

      {/* ── Action row ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Choose / Replace button */}
        {!usePlaceholder && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50
              ${isDark
                ? 'border-white/10 text-slate-300 bg-slate-800 hover:bg-slate-700'
                : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'}`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {hasImage ? 'Replace' : 'Choose Image'}
          </button>
        )}

        {/* Use placeholder toggle */}
        <label className="flex items-center gap-2 cursor-pointer ml-auto" onClick={handlePlaceholderToggle}>
          <div
            className={`w-9 h-5 rounded-full transition-all
              ${usePlaceholder ? 'bg-green-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow mt-0.5 transition-transform
                ${usePlaceholder ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </div>
          <span className={`text-[10px] font-bold select-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Use placeholder
          </span>
        </label>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {uploadError && (
        <div className="flex items-center gap-2 text-rose-400 text-[10px] font-bold">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
