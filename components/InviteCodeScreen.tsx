
import React, { useState } from 'react';
import { AppView } from '../types';
import { KeyRound, ArrowRight, Users, Share2, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface InviteCodeScreenProps {
  setView: (view: AppView) => void;
  nextView: AppView;
  onInviteCodeValidated: (code: string) => void;
}

export const InviteCodeScreen: React.FC<InviteCodeScreenProps> = ({ setView, nextView, onInviteCodeValidated }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [validatedHint, setValidatedHint] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);
    setValidatedHint(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter an invite code.');
      return;
    }
    if (trimmed.length < 4) {
      setError('Code is too short. Please check and try again.');
      return;
    }

    setVerifying(true);
    try {
      // Validates against the contractor_codes table; rejects codes that
      // don't exist or have active_status = false.
      const { data, error: efErr } = await supabase.functions.invoke('validate-invite-code', {
        body: { code: trimmed },
      });
      if (efErr) {
        // Try to surface the function-side error message if present
        const ctxJson = await (efErr as any).context?.json?.().catch(() => null);
        throw new Error(ctxJson?.error || efErr.message || 'Could not verify code right now.');
      }
      if (!data?.valid) {
        const reason = data?.reason as string | undefined;
        if (reason === 'inactive') {
          setError('This invite code has been deactivated. Ask for an active code.');
        } else if (reason === 'staff_invite_consumed') {
          setError('This staff invite has already been used.');
        } else {
          setError("This invite code isn't recognised. Double-check and try again.");
        }
        setVerifying(false);
        return;
      }
      // Briefly show what kind of code matched, then advance.
      const label = data.label as string | undefined;
      if (label) setValidatedHint(`Verified — ${label}.`);
      onInviteCodeValidated(trimmed);
      // Small delay so the merchant sees the confirmation before the screen swaps.
      setTimeout(() => {
        setVerifying(false);
        setView(nextView);
      }, 600);
    } catch (err) {
      console.error('[InviteCodeScreen] verify failed:', err);
      setError(err instanceof Error ? err.message : 'Could not verify code right now.');
      setVerifying(false);
    }
  };

  const handleSkip = () => {
    setView(nextView);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-5">
          <KeyRound className="w-6 h-6 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">
          Enter invite code
        </h2>
        <p className="text-sm text-slate-500">
          Enter your invite code, referral code, or staff team code to get started.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 flex flex-col justify-center">
        <div className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={e => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. BALA10 or ABCD1234"
            maxLength={20}
            autoCapitalize="characters"
            className={`w-full h-14 px-4 rounded-xl border-2 text-slate-900 text-base font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 outline-none transition-all ${
              error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 focus:border-slate-900'
            }`}
          />
          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
          {validatedHint && (
            <p className="text-sm text-emerald-600 font-medium">{validatedHint}</p>
          )}

          {/* Code type hints */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
              <span className="text-[11px] text-slate-400">App invite code from DealFynd</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Share2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[11px] text-slate-400">Referral code from another merchant</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="text-[11px] text-slate-400">Staff team code from your store owner</span>
            </div>
          </div>

          {/* Skip disabled the moment the merchant starts typing a code — if
              they have one, they should verify it, not skip past it. */}
          <button
            onClick={handleSkip}
            disabled={code.trim().length > 0}
            className={`w-full h-12 rounded-xl text-white font-semibold text-sm transition-all mt-4 ${
              code.trim().length > 0
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-slate-900 active:scale-[0.98]'
            }`}
          >
            I don&apos;t have an invite code
          </button>
        </div>
      </div>

      {/* Buttons — lift the CTA off the very bottom edge (safe-area aware), matching
          the consumer invite screen and the rest of merchant onboarding. */}
      <div className="shrink-0 px-6 pt-6 pb-safe-bottom">
        <button
          onClick={handleVerify}
          disabled={verifying || code.trim().length < 4}
          className={`w-full h-12 rounded-xl text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            verifying || code.trim().length < 4
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-slate-900 active:scale-[0.98]'
          }`}
        >
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying…
            </>
          ) : (
            <>
              Verify & Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
