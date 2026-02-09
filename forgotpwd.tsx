
import React, { useState, useEffect, useRef } from 'react';
import { AppView } from './types';
import { userService } from './services/userService'; 
import { editProfileService } from './services/editProfileService'; // New import
import { 
  Loader2, 
  Fingerprint, 
  ShieldCheck, 
  Key, 
  Lock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  User as UserIcon,
  MessageSquareText,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';

interface ForgotPwdProps {
  setView: (view: AppView) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export const ForgotPwd: React.FC<ForgotPwdProps> = ({ setView, loading, setLoading }) => {
  const { t } = useTranslation();
  const [forgotStep, setForgotStep] = useState<'identify' | 'verifying' | 'otp' | 'reset' | 'success'>('identify');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  const validatePassword = (pass: string): boolean => {
    const regex = /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/;
    return regex.test(pass);
  };

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

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    
    if (forgotStep === 'identify') {
      setLoading(true);
      try {
        // In a real app, validateUserIdentifier would check if the identifier exists
        const isValid = await userService.validateUserIdentifier(forgotIdentifier); 
        if (isValid) {
          // Simulate sending an OTP. In production, this would be an API call.
          setForgotStep('verifying');
          // Dummy: Simulate successful OTP send after a delay
          setTimeout(() => {
            setForgotStep('otp');
            setResendTimer(60); // Start resend timer
            setLoading(false);
          }, 2000);
        } else {
          setForgotError("Identity not recognized. Please check your username or email.");
        }
      } catch (err: any) {
        setForgotError(err.message || "Validation failed. Please try again.");
      } finally {
        if (forgotStep === 'identify') setLoading(false); // Only stop loading here if not transitioning to 'verifying'
      }
    } else if (forgotStep === 'otp') {
      // Dummy OTP verification
      setLoading(true);
      if (otpValue === "123456") { // Hardcoded dummy OTP
        setTimeout(() => {
          setLoading(false);
          setForgotStep('reset');
        }, 1500);
      } else {
        setForgotError("Invalid OTP (hint: try 123456).");
        setLoading(false);
      }
    } else if (forgotStep === 'reset') {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const newPassword = formData.get('newPassword') as string;
      const confirmPassword = formData.get('confirmPassword') as string;

      if (!validatePassword(newPassword)) {
        setForgotError("Password must be 8-15 characters, contain one uppercase letter, one number, and no spaces.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setForgotError("Passwords do not match.");
        return;
      }
      
      setLoading(true);
      try {
        // In production, this would be an API call to reset the password
        await editProfileService.resetPassword(forgotIdentifier, newPassword); 
        setTimeout(() => {
          setForgotStep('success');
          setLoading(false);
        }, 2000);
      } catch (err: any) {
        setForgotError(err.message || "Password reset failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResendOtp = async () => {
    setForgotError(null);
    setResendTimer(0); // Reset timer
    setLoading(true);
    try {
      // In a real app, this would be an API call to resend OTP
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResendTimer(60); // Restart timer
      setForgotError(null);
    } catch (err: any) {
      setForgotError(err.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (forgotStep) {
      case 'identify':
        return (
          <>
            <div className="w-full text-left mb-8">
              <h2 className="text-5xl font-black tracking-tighter uppercase leading-none mb-3 text-white">
                Lost<br/><span className="text-blue-500">Credentials?</span>
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                Enter your registered username or email to recover your access.
              </p>
            </div>

            {forgotError && (
              <div className="mb-6 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-6 flex-1">
              <div className="relative group">
                <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500" />
                <input 
                  name="identifier" 
                  placeholder="Username / Email" 
                  className="input-premium pl-14" 
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  required 
                />
              </div>
              <button type="submit" disabled={loading} className="w-full btn-premium shadow-2xl shadow-blue-500/20">
                {loading ? <Loader2 className="animate-spin w-6 h-6" /> : "Recover Account"}
              </button>
            </form>
          </>
        );
      case 'verifying':
        return (
          <div className="flex flex-col items-center justify-center py-20 gap-4 animate-reveal">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Sending OTP Securely...</p>
          </div>
        );
      case 'otp':
        return (
          <>
            <div className="w-full text-left mb-8">
              <h2 className="text-5xl font-black tracking-tighter uppercase leading-none mb-3 text-white">
                Verify<br/><span className="text-blue-500">Identity</span>
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                A one-time password has been dispatched. Enter it below to proceed.
              </p>
            </div>
            
            {forgotError && (
              <div className="mb-6 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{forgotError}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} className="space-y-6 flex-1">
              <div className="relative group">
                <Key className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500" />
                <input 
                  name="otp" 
                  placeholder="6-Digit OTP" 
                  className="input-premium pl-14 tracking-[1em] text-xl font-black" 
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required 
                />
              </div>
              <button type="submit" disabled={loading || otpValue.length !== 6} className="w-full btn-premium shadow-2xl shadow-blue-500/20">
                {loading ? <Loader2 className="animate-spin w-6 h-6" /> : "Confirm OTP"}
              </button>
            </form>
            <div className="mt-4 text-center">
              {resendTimer > 0 ? (
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Resend in {resendTimer}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-blue-500 text-[10px] font-black uppercase tracking-widest hover:text-blue-400 active:scale-95 transition-colors flex items-center gap-2 mx-auto"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Resend OTP
                </button>
              )}
            </div>
          </>
        );
      case 'reset':
        return (
          <>
            <div className="w-full text-left mb-8">
              <h2 className="text-5xl font-black tracking-tighter uppercase leading-none mb-3 text-white">
                Set New<br/><span className="text-emerald-500">Password</span>
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                Secure your account with a strong, new credential.
              </p>
            </div>
            {forgotError && (
              <div className="mb-6 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{forgotError}</span>
              </div>
            )}
            <form onSubmit={handleForgotSubmit} className="space-y-6 flex-1">
              <div className="relative group">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500" />
                <input 
                  name="newPassword" 
                  type={showNewPassword ? "text" : "password"} 
                  placeholder="New Password (8-15 chars, 1 Cap, 1 Num)" 
                  className="input-premium pl-14 pr-14" 
                  onChange={() => setForgotError(null)}
                  required 
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500" />
                <input 
                  name="confirmPassword" 
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="Confirm New Password" 
                  className="input-premium pl-14 pr-14" 
                  onChange={() => setForgotError(null)}
                  required 
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button type="submit" disabled={loading} className="w-full btn-premium bg-emerald-600 shadow-2xl shadow-emerald-500/20">
                {loading ? <Loader2 className="animate-spin w-6 h-6" /> : "Reset Password"}
              </button>
            </form>
          </>
        );
      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-20 gap-4 animate-reveal">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h3 className="text-xl font-black uppercase text-white text-center">Password Updated!</h3>
            <p className="text-slate-400 text-xs text-center leading-relaxed">
              Your security clearance has been successfully updated.
            </p>
            <button 
              onClick={() => setView('login')} 
              className="mt-6 btn-premium px-8 h-16 rounded-2xl shadow-xl shadow-blue-500/20"
            >
              Back to Login
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="px-8 pt-8 animate-reveal flex flex-col min-h-screen">
      {renderContent()}
      <div className="mt-8 text-center pb-20">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Remembered your access? <button onClick={() => setView('login')} className="text-white border-b border-white/20 ml-1">Secure Login</button>
        </p>
      </div>
    </div>
  );
};
