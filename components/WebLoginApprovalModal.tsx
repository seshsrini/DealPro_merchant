import React, { useState } from 'react';
import { Monitor, ShieldCheck } from 'lucide-react';
import type { PendingWebLogin } from '../services/webLoginApprovalService';

interface WebLoginApprovalModalProps {
  request: PendingWebLogin;
  theme: 'light' | 'dark';
  onApprove: () => Promise<void>;
  onDeny: () => Promise<void>;
}

/**
 * Shown on the merchant's mobile app when a web sign-in is awaiting approval
 * (someone entered this merchant's phone on vedicjaalam.com/merchant/). The
 * merchant confirms the request code matches what they see on the computer,
 * then approves — minting the web session without an SMS OTP.
 */
export const WebLoginApprovalModal: React.FC<WebLoginApprovalModalProps> = ({ request, theme, onApprove, onDeny }) => {
  const isDark = theme === 'dark';
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);

  const handle = async (kind: 'approve' | 'deny') => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === 'approve') await onApprove();
      else await onDeny();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 px-8">
      <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Approve web sign-in?</h3>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{request.requester_label || 'Web browser'}</p>
          </div>
        </div>

        <div className={`rounded-xl px-4 py-3 mb-4 text-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <p className={`text-[11px] uppercase tracking-wide mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Request code</p>
          <p className={`text-2xl font-bold tracking-[0.3em] ${isDark ? 'text-white' : 'text-slate-900'}`}>#{request.request_code}</p>
        </div>

        <div className="flex items-start gap-2 mb-5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Only approve if you just tried to sign in on a computer and this code matches the one shown there.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handle('approve')}
            disabled={!!busy}
            className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={() => handle('deny')}
            disabled={!!busy}
            className={`w-full h-11 rounded-xl text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-700'}`}
          >
            {busy === 'deny' ? 'Declining…' : "Not me — decline"}
          </button>
        </div>
      </div>
    </div>
  );
};
