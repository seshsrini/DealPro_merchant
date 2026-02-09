
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, ShieldCheck, Key, AlertTriangle, CheckCircle2, X, RefreshCw, Send, Phone, ArrowLeft } from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';
// Removed userService import as it's no longer directly used for dummy OTP functionality
// import { userService } from './services/userService'; 

interface OtpVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string; // Initial phone number passed from parent
  onVerificationSuccess: () => void;
  onVerificationError: () => void;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  isOpen,
  onClose,
  phoneNumber, // This is now an initial value
  onVerificationSuccess,
  onVerificationError,
}) => {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<'phoneNumberInput' | 'otpInput'>('phoneNumberInput');
  const [internalPhoneNumber, setInternalPhoneNumber] = useState(phoneNumber); // Internal state for editable phone number
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSentToPhone, setOtpSentToPhone] = useState<string | null>(null); // To confirm which number OTP was 'sent' to
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInternalPhoneNumber(phoneNumber); // Reset internal phone number to prop when opening
      setCurrentStep('phoneNumberInput'); // Always start at phone input step
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
    if (!internalPhoneNumber || internalPhoneNumber.length < 7) { // Basic validation
      setOtpError("Please enter a valid phone number.");
      return;
    }

    setIsSendingOtp(true);
    try {
      // DUMMY: Simulate OTP sending with a delay
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      
      setOtpSentToPhone(internalPhoneNumber);
      setCurrentStep('otpInput');
      setResendTimer(60); // Start resend timer
    } catch (err: any) {
      // In dummy mode, this block might not be reached but kept for structure
      console.error("Failed to send OTP (dummy):", err);
      setOtpError(err.message || "Failed to send OTP (simulated error). Please try again.");
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
      // DUMMY: Simulate OTP verification with a delay
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      // DUMMY: Hardcoded OTP check for demonstration
      if (otpInput === "123456") {
        onVerificationSuccess();
      } else {
        setOtpError("Invalid OTP (dummy: try 123456). Please try again.");
        onVerificationError();
      }
    } catch (err: any) {
      // In dummy mode, this block might not be reached but kept for structure
      console.error("OTP verification failed (dummy):", err);
      setOtpError(err.message || "OTP verification failed (simulated error). Please try again.");
      onVerificationError();
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1500] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-reveal">
      <div className="w-full max-w-sm glass p-8 rounded-[3.5rem] border-blue-500/20 bg-slate-900/95 shadow-2xl relative text-center flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 glass rounded-full flex items-center justify-center border-white/10 active:scale-90 transition-transform z-10"
        >
          <X className="w-5 h-5 text-slate-400" />
        </button>

        {currentStep === 'phoneNumberInput' && (
          <div className="flex flex-col animate-reveal">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <Phone className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-black uppercase text-white leading-none">Verify Phone</h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Enter your phone number to receive a verification code.
              </p>
            </div>

            {otpError && (
              <div className="mb-6 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake">
                <AlertTriangle className="w-3 h-3 inline-block mr-1" /> {otpError}
              </div>
            )}

            <div className="relative group mb-6">
              <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="tel"
                value={internalPhoneNumber}
                onChange={(e) => setInternalPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Mobile Number"
                className="input-premium pl-14"
                maxLength={15}
                required
              />
            </div>

            <button
              onClick={handleSendOtp}
              disabled={isSendingOtp || internalPhoneNumber.length < 7}
              className="w-full btn-premium h-16 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
            >
              {isSendingOtp ? <Loader2 className="animate-spin w-6 h-6" /> : "Send OTP"}
            </button>
          </div>
        )}

        {currentStep === 'otpInput' && (
          <div className="flex flex-col animate-reveal">
            <button
              onClick={() => { setCurrentStep('phoneNumberInput'); setOtpError(null); setOtpInput(''); setResendTimer(0); }}
              className="absolute top-6 left-6 w-10 h-10 glass rounded-full flex items-center justify-center border-white/10 active:scale-90 transition-transform z-10"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
                <Key className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-black uppercase text-white leading-none">Enter OTP</h3>
              <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                Code sent to: <span className="font-bold text-white">{otpSentToPhone}</span>
              </p>
            </div>

            {otpError && (
              <div className="mb-6 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake">
                <AlertTriangle className="w-3 h-3 inline-block mr-1" /> {otpError}
              </div>
            )}

            <div className="relative group mb-6">
              <Key className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="XXXXXX"
                className="input-premium pl-14 tracking-[1em] text-xl font-black focus:border-blue-500/40"
                maxLength={6}
                required
              />
            </div>

            <button
              onClick={verifyOtp}
              disabled={otpInput.length !== 6 || isVerifyingOtp}
              className="w-full btn-premium h-16 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
            >
              {isVerifyingOtp ? <Loader2 className="animate-spin w-6 h-6" /> : "Verify Code"}
            </button>

            <div className="mt-4 text-center">
              {resendTimer > 0 ? (
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Resend in {resendTimer}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                  className="text-blue-500 text-[10px] font-black uppercase tracking-widest hover:text-blue-400 active:scale-95 transition-colors flex items-center gap-2 mx-auto"
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
