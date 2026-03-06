
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppView, User, PennyDropStatus } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { paymentService } from './services/paymentService';
import { editProfileService } from './services/editProfileService';
import {
  Banknote,
  ShieldCheck,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Fingerprint,
  Building,
  Briefcase,
  User as UserIcon,
  Info
} from 'lucide-react';

interface BankVerificationProps {
  user: User;
  setUser: (user: User) => void;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const GST_REGISTRATION_TYPES = ['Registered', 'Unregistered', 'Composition'];

export const BankVerification: React.FC<BankVerificationProps> = ({ user, setUser, setView, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  // Bank Account States
  const [ifscCode, setIfscCode] = useState(user.ifsc_code || '');
  const [bankName, setBankName] = useState(user.bank_name || '');
  const [branchName, setBranchName] = useState(user.branch_name || '');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'current' | 'other'>(user.account_type || 'current');
  const [pennyDropStatus, setPennyDropStatus] = useState<PennyDropStatus>(user.penny_drop_status || 'not_initiated');

  // IFSC API Loading & Validation
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscError, setIfscError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Penny Drop States
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);
  const [pennyDropFeedback, setPennyDropFeedback] = useState<string | null>(null);

  // KYC States
  const [panNumber, setPanNumber] = useState(user.pan || '');
  const [gstRegistrationType, setGstRegistrationType] = useState<'Registered' | 'Unregistered' | 'Composition'>(user.gst_registration_type || 'Unregistered');

  // Overall form state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (user.role !== 'merchant') {
      setView('profile');
    }
    if (user.pan) setPanNumber(user.pan);
  }, [user.role, user.pan, setView]);

  const isIfscValid = useMemo(() => IFSC_REGEX.test(ifscCode), [ifscCode]);
  const isPanValid = useMemo(() => PAN_REGEX.test(panNumber), [panNumber]);

  const fetchBankDetails = useCallback(async (ifsc: string) => {
    setIfscLoading(true);
    setIfscError(null);
    setBankName('');
    setBranchName('');
    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      if (!response.ok) {
        throw new Error('Invalid IFSC Code or Bank not found.');
      }
      const data = await response.json();
      if (data.BANK && data.BRANCH) {
        setBankName(data.BANK);
        setBranchName(data.BRANCH);
        setIfscError(null);
      } else {
        throw new Error('Bank details incomplete for this IFSC.');
      }
    } catch (err: any) {
      console.error("Razorpay IFSC API Error:", err);
      setIfscError('Unable to fetch bank details. Please try again.');
      setBankName('');
      setBranchName('');
    } finally {
      setIfscLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ifscCode.length === 11 && isIfscValid) {
      fetchBankDetails(ifscCode);
    } else if (ifscCode.length > 0 && ifscCode.length < 11 || (ifscCode.length === 11 && !isIfscValid)) {
      setIfscError('Invalid IFSC format.');
      setBankName('');
      setBranchName('');
    } else if (ifscCode.length === 0) {
      setIfscError(null);
      setBankName('');
      setBranchName('');
    }
  }, [ifscCode, isIfscValid, fetchBankDetails]);

  const handleVerifyAccount = async () => {
    if (!user.id || !isIfscValid || !bankName || !branchName || accountNumber !== confirmAccountNumber || accountNumber.length < 9) {
      setAccountError('Please fill all bank details correctly.');
      return;
    }

    setIsVerifyingAccount(true);
    setPennyDropFeedback(null);
    setAccountError(null);

    try {
      const encryptedAccountNumber = paymentService.encryptAccountNumber(accountNumber);

      const response = await paymentService.initiatePennyDrop(
        user.id,
        encryptedAccountNumber,
        ifscCode,
        bankName,
        branchName,
        accountType
      );

      if (response.success) {
        setPennyDropStatus('initiated');
        setPennyDropFeedback('Penny drop initiated successfully! Check your account.');
        setTimeout(() => {
          setPennyDropStatus('verified');
          setPennyDropFeedback('Account verified! ₹1 credit received.');
        }, 5000);
      } else {
        setPennyDropStatus('failed');
        setPennyDropFeedback(response.message || 'Penny drop failed. Please re-check details.');
      }
    } catch (err: any) {
      console.error("Penny drop initiation failed:", err);
      setPennyDropStatus('failed');
      setPennyDropFeedback('Unable to initiate verification. Please try again.');
    } finally {
      setIsVerifyingAccount(false);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    if (!user.id) {
        setSaveError("User not logged in.");
        setIsSaving(false);
        return;
    }

    if (!isIfscValid || !bankName || !branchName || pennyDropStatus !== 'verified') {
        setSaveError("Bank account must be verified via penny drop.");
        setIsSaving(false);
        return;
    }
    if (panNumber.length > 0 && !isPanValid) {
        setSaveError("Invalid PAN Number format.");
        setIsSaving(false);
        return;
    }

    try {
        const encryptedAccountNumber = paymentService.encryptAccountNumber(accountNumber);

        const updateData = {
            ifsc_code: ifscCode,
            bank_name: bankName,
            branch_name: branchName,
            account_number_encrypted: encryptedAccountNumber,
            account_type: accountType,
            penny_drop_status: pennyDropStatus,
            pan: panNumber,
            gst_registration_type: gstRegistrationType,
        };

        await editProfileService.updateUserProfile(user.id, user.role, updateData);

        setUser(prev => ({
          ...prev,
          ...updateData
        }));

        setSaveSuccess('Bank & KYC details saved successfully!');
        setTimeout(() => setView('profile'), 2000);
    } catch (err: any) {
        console.error("Failed to save bank/KYC details:", err);
        setSaveError("Unable to save details. Please try again.");
    } finally {
        setIsSaving(false);
    }
  };

  const isFormValid = useMemo(() => {
    const bankDetailsComplete = isIfscValid && bankName && branchName && accountNumber === confirmAccountNumber && accountNumber.length >= 9 && pennyDropStatus === 'verified';
    const kycDetailsValid = panNumber.length === 0 || isPanValid;
    return bankDetailsComplete && kycDetailsValid;
  }, [isIfscValid, bankName, branchName, accountNumber, confirmAccountNumber, pennyDropStatus, panNumber, isPanValid]);

  const inputClass = `w-full h-12 px-4 rounded-lg text-sm font-normal outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
      : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
  }`;

  return (
    <div className="px-6 pt-6 pb-32 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => setView('profile')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}
        >
          <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
        </button>
        <div className="flex-1">
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Bank Verification</h2>
          <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Secure payout gateway</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
          <Banknote className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      {saveSuccess && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-500">{saveSuccess}</p>
        </div>
      )}

      {saveError && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-medium text-red-500">{saveError}</p>
        </div>
      )}

      <form onSubmit={handleSaveDetails} className="space-y-6">
        {/* Bank Account Details */}
        <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <Building className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Bank Account Details</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>For secure payouts and transactions</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Building className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="IFSC Code (e.g., HDFC0000001)"
                className={`${inputClass} pl-11 ${ifscError ? (isDark ? 'border-red-500/50' : 'border-red-400') : ''}`}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                maxLength={11}
                required
              />
              {ifscLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />}
              {ifscCode.length === 11 && isIfscValid && !ifscLoading && !ifscError && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
              {ifscError && <AlertTriangle className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
            </div>
            {ifscError && <p className="text-red-500 text-xs">{ifscError}</p>}

            <input
              type="text"
              placeholder="Bank Name"
              className={`${inputClass} opacity-60 cursor-not-allowed`}
              value={bankName}
              readOnly
              disabled={true}
            />
            <input
              type="text"
              placeholder="Branch Name"
              className={`${inputClass} opacity-60 cursor-not-allowed`}
              value={branchName}
              readOnly
              disabled={true}
            />

            <div className="relative">
              <DollarSign className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Account Number"
                className={`${inputClass} pl-11`}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                required
                minLength={9}
              />
            </div>
            <div className="relative">
              <DollarSign className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Confirm Account Number"
                className={`${inputClass} pl-11`}
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
                required
                minLength={9}
              />
            </div>
            {accountNumber.length > 0 && confirmAccountNumber.length > 0 && accountNumber !== confirmAccountNumber && (
              <p className="text-red-500 text-xs">Account numbers do not match.</p>
            )}

            <div className="relative">
              <Briefcase className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                className={`${inputClass} pl-11`}
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as 'savings' | 'current' | 'other')}
                required
              >
                <option value="current">Current Account (Default)</option>
                <option value="savings">Savings Account</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <p className={`text-[10px] italic text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Account number is encrypted before being sent to the database.
          </p>

          <button
            type="button"
            onClick={handleVerifyAccount}
            disabled={isVerifyingAccount || !isIfscValid || !bankName || accountNumber !== confirmAccountNumber || accountNumber.length < 9}
            className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                pennyDropStatus === 'verified'
                  ? 'bg-emerald-600 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white'
            }`}
          >
            {isVerifyingAccount ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : pennyDropStatus === 'verified' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Fingerprint className="w-4 h-4" />
            )}
            <span>
              {pennyDropStatus === 'verified' ? 'Account Verified' : (isVerifyingAccount ? 'Initiating Penny Drop...' : 'Verify Account')}
            </span>
          </button>
          {pennyDropFeedback && (
            <p className={`text-xs text-center ${pennyDropStatus === 'failed' ? 'text-red-500' : 'text-emerald-500'}`}>{pennyDropFeedback}</p>
          )}
        </div>

        {/* KYC Details */}
        <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
              <UserIcon className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>KYC Details</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Additional compliance for merchants</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <UserIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="PAN Number"
                className={`${inputClass} pl-11 ${panNumber.length > 0 && !isPanValid ? (isDark ? 'border-red-500/50' : 'border-red-400') : ''}`}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                maxLength={10}
              />
              {panNumber.length > 0 && !isPanValid && <AlertTriangle className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />}
              {panNumber.length === 10 && isPanValid && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}
            </div>
            {panNumber.length > 0 && !isPanValid && <p className="text-red-500 text-xs">Invalid PAN format.</p>}

            <div className="relative">
              <Info className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <select
                className={`${inputClass} pl-11`}
                value={gstRegistrationType}
                onChange={(e) => setGstRegistrationType(e.target.value as 'Registered' | 'Unregistered' | 'Composition')}
                required
              >
                <option value="Unregistered">GST Registration Type</option>
                {GST_REGISTRATION_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving || !isFormValid}
          className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <Loader2 className="animate-spin w-4 h-4" />
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Save Bank & KYC Details</span>
            </>
          )}
        </button>
      </form>

      {/* Trust Badges */}
      <div className="text-center space-y-3">
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Your security is our priority</p>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-1.5 text-emerald-500">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-medium">SSL Secured</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-500">
            <Lock className="w-4 h-4" />
            <span className="text-xs font-medium">PCI-DSS Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
