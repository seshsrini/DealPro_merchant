import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';

interface WhatsAppConsentModalProps {
  isOpen: boolean;
  theme: 'light' | 'dark';
  /** The store's WhatsApp number (10 digits) shown in the question. */
  phone?: string;
  onYes: () => void;
  onNo: () => void;
  /** Close without answering (X / backdrop). Defaults to onNo. */
  onClose?: () => void;
}

/**
 * Asks the merchant whether consumers may message this store on WhatsApp.
 * Used by the signup Address step and Profile → My Stores. Layered above the
 * My Stores bottom sheet (z-[9999]).
 */
export const WhatsAppConsentModal: React.FC<WhatsAppConsentModalProps> = ({
  isOpen, theme, phone, onYes, onNo, onClose,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const isDark = theme === 'dark';
  const close = onClose ?? onNo;

  return (
    <div
      className="fixed inset-0 z-[10050] bg-black/50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={`w-full max-w-xs rounded-2xl p-5 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <MessageCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
          >
            <X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        <h2 className={`text-sm font-semibold leading-tight mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('wa_consent_title')}
        </h2>
        <p className={`text-xs leading-relaxed mb-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          {t('wa_consent_body')}
        </p>
        {phone && (
          <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>+91 {phone}</p>
        )}
        <p className={`text-[11px] leading-relaxed mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('wa_consent_note')}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNo}
            className={`flex-1 h-10 rounded-xl text-xs font-medium active:scale-[0.98] transition-all ${
              isDark ? 'text-slate-300 bg-slate-700' : 'text-slate-600 bg-slate-100'
            }`}
          >
            {t('wa_consent_no')}
          </button>
          <button
            type="button"
            onClick={onYes}
            className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-xs font-semibold active:scale-[0.98] transition-all"
          >
            {t('wa_consent_yes')}
          </button>
        </div>
      </div>
    </div>
  );
};
