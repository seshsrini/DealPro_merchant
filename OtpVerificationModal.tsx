
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Key, AlertTriangle, Phone, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';

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
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<'phoneNumberInput' | 'otpInput'>('phoneNumberInput');
  const [internalPhoneNumber, setInternalPhoneNumber] = useState(phoneNumber);
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSentToPhone, setOtpSentToPhone] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInternalPhoneNumber(phoneNumber);
      setCurrentStep('phoneNumberInput');
      setOtpInput('');
      setOtpError(null);
      setResendTimer(0);
      setOtpSentToPhone(null);
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

  const handleSendOtp = async () => {
    setOtpError(null);
    if (!internalPhoneNumber || internalPhoneNumber.length < 7) {
      setOtpError("Please enter a valid phone number.");
      return;
    }

    setIsSendingOtp(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      setOtpSentToPhone(internalPhoneNumber);
      setCurrentStep('otpInput');
      setResendTimer(60);
    } catch (err: any) {
      console.error("Failed to send OTP (dummy):", err);
      setOtpError(err.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    setOtpError(null);
    if (otpInput.length !== 6) {
      setOtpError("Please enter the 6-digit OTP.");
      return;
    }
    if (!otpSentToPhone) {
      setOtpError("No phone number to verify OTP against. Please resend OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (otpInput === "123456") {
        onVerificationSuccess();
      } else {
        setOtpError("Invalid OTP (dummy: try 123456). Please try again.");
        onVerificationError();
      }
    } catch (err: any) {
      console.error("OTP verification failed (dummy):", err);
      setOtpError(err.message || "OTP verification failed. Please try again.");
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

        {currentStep === 'phoneNumberInput' && (
          <div className="flex flex-col">
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-white">Verify Phone</h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Enter your phone number to receive a verification code.
              </p>
            </div>

            {otpError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs font-medium text-red-500">{otpError}</p>
              </div>
            )}

            <div className="relative mb-4">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="tel"
                value={internalPhoneNumber}
                onChange={(e) => setInternalPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Mobile Number"
                className={`${inputClass} pl-11`}
                maxLength={15}
                required
              />
            </div>

            <button
              onClick={handleSendOtp}
              disabled={isSendingOtp || internalPhoneNumber.length < 7}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingOtp ? <Loader2 className="animate-spin w-5 h-5" /> : "Send OTP"}
            </button>
          </div>
        )}

        {currentStep === 'otpInput' && (
          <div className="flex flex-col">
            <button
              onClick={() => { setCurrentStep('phoneNumberInput'); setOtpError(null); setOtpInput(''); setResendTimer(0); }}
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
                Code sent to: <span className="font-semibold text-white">{otpSentToPhone}</span>
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
                  onClick={handleSendOtp}
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
