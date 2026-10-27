import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Store } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { merchantLogoService } from '../services/merchantLogoService';

interface MerchantLogoEditorProps {
  logoUrl: string | null | undefined;
  storeName: string;
  theme: 'light' | 'dark';
  /** Staff acting for the owner can see but not change the logo. */
  canEdit: boolean;
  onChange: (logoUrl: string | null) => void;
}

/** Edit Profile → Business logo. Uploads immediately (with a server-side content check). */
export const MerchantLogoEditor: React.FC<MerchantLogoEditorProps> = ({ logoUrl, storeName, theme, canEdit, onChange }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  const initial = (storeName || '?').trim().charAt(0).toUpperCase();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!/^image\//.test(file.type)) { setError(t('m_logo_not_image')); return; }
    setBusy('upload');
    try {
      const { logo_url } = await merchantLogoService.setLogo(file);
      setBroken(false);
      onChange(logo_url);
      setNotice(t('m_logo_saved'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('m_save_failed'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    setError(null);
    setNotice(null);
    setBusy('remove');
    try {
      await merchantLogoService.removeLogo();
      onChange(null);
      setNotice(t('m_logo_removed'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('m_save_failed'));
    } finally {
      setBusy(null);
    }
  };

  const showImage = !!logoUrl && !broken;

  return (
    <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`relative w-16 h-16 shrink-0 rounded-full overflow-hidden flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
          {showImage ? (
            <img src={logoUrl!} alt="" className="w-full h-full object-cover" onError={() => setBroken(true)} />
          ) : initial !== '?' ? (
            <span className={`text-xl font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{initial}</span>
          ) : (
            <Store className="w-6 h-6 text-slate-400" />
          )}
          {busy && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_logo_title')}</p>
          <p className={`text-[11px] leading-snug mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {canEdit ? t('m_logo_hint') : t('m_logo_owner_only')}
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!busy}
            className="flex-1 h-10 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
          >
            {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {busy === 'upload' ? t('m_logo_checking') : logoUrl ? t('m_logo_change') : t('m_logo_upload')}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={!!busy}
              className={`h-10 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-50 ${
                isDark ? 'bg-slate-800 text-red-400' : 'bg-white border border-slate-200 text-red-600'
              }`}
            >
              {busy === 'remove' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t('m_logo_remove')}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </div>
      )}

      {error && <p className="mt-2 text-[11px] leading-snug text-red-500">{error}</p>}
      {notice && !error && <p className={`mt-2 text-[11px] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{notice}</p>}
    </div>
  );
};
