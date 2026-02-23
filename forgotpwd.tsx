
import React, { useState, useEffect, useRef } from 'react';
import { AppView } from './types';
import { userService } from './services/userService';
import { editProfileService } from './services/editProfileService';
import {
  Loader2,
  Key,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  User as UserIcon,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';

interface ForgotPwdProps {
  setView: (view: AppView) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  theme: 'light' | 'dark';
}

export const ForgotPwd: React.FC<ForgotPwdProps> = ({ setView, loading, setLoading, theme }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [forgotStep, setForgotStep] = useState<'identify' | 'verifying' | 'otp' | 'reset' | 'success'>('identify');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef<number | null>(null);

  const inputClass = `w-full h-12 rounded-lg text-sm font-normal outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
  }`;

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
        const isValid = await userService.validateUserIdentifier(forgotIdentifier);
        if (isValid) {
          setForgotStep('verifying');
          setTimeout(() => {
            setForgotStep('otp');
            setResendTimer(60);
            setLoading(false);
          }, 2000);
        } else {
          setForgotError("Identity not recognized. Please check your username or email.");
        }
      } catch (err: any) {
        setForgotError(err.message || "Validation failed. Please try again.");
      } finally {
        if (forgotStep === 'identify') setLoading(false);
      }
    } else if (forgotStep === 'otp') {
      setLoading(true);
      if (otpValue === "123456") {
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
    setResendTimer(0);
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResendTimer(60);
      setForgotError(null);
    } catch (err: any) {
      setForgotError(err.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const renderError = () => {
    if (!forgotError) return null;
    return (
      <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        <span className="text-xs font-medium text-red-500">{forgotError}</span>
      </div>
    );
  };

  const renderContent = () => {
    switch (forgotStep) {
      case 'identify':
        return (
          <>
            <div className="w-full text-left mb-6">
              <h2 className={`text-2xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Forgot Password
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Enter your registered username or email to recover your access.
              </p>
            </div>

            {renderError()}

            <form onSubmit={handleForgotSubmit} className="space-y-4 flex-1">
              <div className="relative">
                <UserIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  name="identifier"
                  placeholder="Username / Email"
                  className={`${inputClass} pl-11 pr-4`}
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Recover Account"}
              </button>
            </form>
          </>
        );
      case 'verifying':
        return (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            <p className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sending OTP...</p>
          </div>
        );
      case 'otp':
        return (
          <>
            <div className="w-full text-left mb-6">
              <h2 className={`text-2xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Verify Identity
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                A one-time password has been sent. Enter it below to proceed.
              </p>
            </div>

            {renderError()}

            <form onSubmit={handleForgotSubmit} className="space-y-4 flex-1">
              <div className="relative">
                <Key className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  name="otp"
                  placeholder="6-Digit OTP"
                  className={`${inputClass} pl-11 pr-4 tracking-[0.5em] font-medium`}
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit" disabled={loading || otpValue.length !== 6} className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Confirm OTP"}
              </button>
            </form>
            <div className="mt-4 text-center">
              {resendTimer > 0 ? (
                <p className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Resend in {resendTimer}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-xs font-medium text-blue-400 active:scale-95 transition-colors flex items-center gap-1.5 mx-auto"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Resend OTP
                </button>
              )}
            </div>
          </>
        );
      case 'reset':
        return (
          <>
            <div className="w-full text-left mb-6">
              <h2 className={`text-2xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Set New Password
              </h2>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Secure your account with a strong, new password.
              </p>
            </div>
            {renderError()}
            <form onSubmit={handleForgotSubmit} className="space-y-4 flex-1">
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="New Password (8-15 chars, 1 Cap, 1 Num)"
                  className={`${inputClass} pl-11 pr-12`}
                  onChange={() => setForgotError(null)}
                  required
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm New Password"
                  className={`${inputClass} pl-11 pr-12`}
                  onChange={() => setForgotError(null)}
                  required
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center">
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Reset Password"}
              </button>
            </form>
          </>
        );
      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            <h3 className={`text-lg font-semibold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Password Updated!</h3>
            <p className={`text-sm text-center leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Your password has been successfully updated.
            </p>
            <button
              onClick={() => setView('login')}
              className="mt-4 h-12 px-8 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all flex items-center justify-center"
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
    <div className={`px-6 pt-6 flex flex-col min-h-screen ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Back button */}
      <button
        onClick={() => setView('login')}
        className={`w-10 h-10 rounded-lg border flex items-center justify-center active:scale-90 transition-all mb-4 ${
          isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
        }`}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {renderContent()}

      <div className="mt-6 text-center pb-20">
        <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Remember your password?{' '}
          <button onClick={() => setView('login')} className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Login
          </button>
        </p>
      </div>
    </div>
  );
};
