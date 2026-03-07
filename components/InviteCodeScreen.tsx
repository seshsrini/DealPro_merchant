
import React, { useState } from 'react';
import { AppView } from '../types';
import { KeyRound, ArrowRight } from 'lucide-react';

const VALID_INVITE_CODE = 'BALA10';

interface InviteCodeScreenProps {
  setView: (view: AppView) => void;
  nextView: AppView;
  onInviteCodeValidated: (code: string) => void;
}

export const InviteCodeScreen: React.FC<InviteCodeScreenProps> = ({ setView, nextView, onInviteCodeValidated }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleVerify = () => {
    setError(null);
    if (!code.trim()) {
      setError('Please enter an invite code.');
      return;
    }
    if (code.trim().toUpperCase() !== VALID_INVITE_CODE) {
      setError('Invalid invite code. Please check and try again.');
      return;
    }
    onInviteCodeValidated(code.trim().toUpperCase());
    setView(nextView);
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
          DealPro Merchant is invite-only. Enter your invite code to get started.
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
            placeholder="e.g. BALA10"
            maxLength={20}
            autoCapitalize="characters"
            className={`w-full h-14 px-4 rounded-xl border-2 text-slate-900 text-base font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 outline-none transition-all ${
              error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50 focus:border-slate-900'
            }`}
          />
          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}
          <button
            onClick={handleSkip}
            className="text-sm text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline transition-colors"
          >
            I don&apos;t have an invite code
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div className="shrink-0 px-6 py-6">
        <button
          onClick={handleVerify}
          className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Verify & Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
