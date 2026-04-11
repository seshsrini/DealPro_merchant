
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Key, AlertTriangle, Phone, ArrowLeft, RefreshCw } from 'lucide-react';
import { firebaseAuthService } from './services/firebaseAuthService';

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  onVerificationSuccess: () => void;
  onVerificationError: () => void;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  onClose,
  phoneNumber,
  onVerificationSuccess,
  onVerificationError,
}) => {
  const [currentStep, setCurrentStep] = useState<'sending' | 'otpInput'>('sending');
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<number | null>(null);
  const hasSentRef = useRef(false);

  useEffect(() => {
    if (isOpen && phoneNumber && !hasSentRef.current) {
      hasSentRef.current = true;
      sendOtp();
    }
    if (!isOpen) {
      hasSentRef.current = false;
      setCurrentStep('sending');
      setOtpInput('');
      setOtpError(null);
      setResendTimer(0);
      firebaseAuthService.reset();
    }
  }, [isOpen, phoneNumber]);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resendTimer]);

  const TEST_NUMBERS = ['6666666666', '7777777777', '9999999999', '8888888888', '4444444444', '5555555555'];

  const sendOtp = async () => {
    setOtpError(null);
    setIsSendingOtp(true);
    try {
      // Test bypass — auto-verify test numbers without Firebase
      const digits = phoneNumber.replace(/\D/g, '').slice(-10);
      if (TEST_NUMBERS.includes(digits)) {
        console.log('[OtpModal] Test number detected, auto-verifying');
        onVerificationSuccess();
        return;
      }

      await firebaseAuthService.sendOtp(phoneNumber);

      // Check if auto-verified (instant verification on same device)
      if (firebaseAuthService.isAutoVerified()) {
        console.log('[OtpModal] Auto-verified, completing login');
        onVerificationSuccess();
        return;
      }

      setCurrentStep('otpInput');
      setResendTimer(60);
    } catch (err: any) {
      console.error("[OtpModal] Failed to send OTP:", err);
      setOtpError("Unable to send verification code. Please try again.");
      setCurrentStep('sending');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResend = async () => {
    firebaseAuthService.reset();
    setOtpInput('');
    await sendOtp();
  };

  const verifyOtp = async () => {
    setOtpError(null);
    if (otpInput.length !== 6) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const verified = await firebaseAuthService.verifyOtp(otpInput);
      if (verified) {
        onVerificationSuccess();
      } else {
        setOtpError("Verification failed. Please try again.");
        onVerificationError();
      }
    } catch (err: any) {
      console.error("[OtpModal] OTP verification failed:", err);
      setOtpError("Verification failed. Please check the code and try again.");
      onVerificationError();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = 'w-full h-12 px-4 rounded-lg text-sm font-normal outline-none transition-all bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500';

  return (
    <div className="fixed inset-0 z-[1500] bg-black/50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-slate-800 p-6 rounded-2xl relative text-center flex flex-col">

        {currentStep === 'sending' && (
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <Phone className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Sending OTP</h3>
            <p className="text-slate-400 text-xs mb-4 leading-relaxed">
              Sending verification code to <span className="font-semibold text-white">{phoneNumber}</span>
            </p>

            {otpError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 w-full">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs font-medium text-red-500 text-left">{otpError}</p>
              </div>
            )}

            {isSendingOtp ? (
              <Loader2 className="animate-spin w-8 h-8 text-blue-500 mb-4" />
            ) : (
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 h-11 rounded-xl bg-slate-700 text-slate-300 text-sm font-medium active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={sendOtp}
                  className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'otpInput' && (
          <div className="flex flex-col">
            <button
              onClick={onClose}
              className="absolute top-4 left-4 w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center active:scale-[0.98] transition-all z-10"
            >
              <ArrowLeft className="w-4 h-4 text-slate-300" />
            </button>
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Key className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Enter OTP</h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Code sent to: <span className="font-semibold text-white">{phoneNumber}</span>
              </p>
            </div>

            {otpError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs font-medium text-red-500">{otpError}</p>
              </div>
            )}

            <div className="relative mb-4">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="XXXXXX"
                className={`${inputClass} pl-11 tracking-[0.5em] text-lg font-semibold`}
                maxLength={6}
                required
              />
            </div>

            <button
              onClick={verifyOtp}
              disabled={otpInput.length !== 6 || isVerifyingOtp}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifyingOtp ? <Loader2 className="animate-spin w-5 h-5" /> : "Verify Code"}
            </button>

            <div className="mt-4 text-center">
              {resendTimer > 0 ? (
                <p className="text-xs text-slate-400">
                  Resend in {resendTimer}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isSendingOtp}
                  className="text-xs font-medium text-blue-500 flex items-center gap-2 mx-auto active:scale-[0.98] transition-all"
                >
                  {isSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
