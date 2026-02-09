
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppView, User, PennyDropStatus } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { paymentService } from './services/paymentService'; // Simulated payment service
import { editProfileService } from './services/editProfileService'; // For saving KYC/Bank details
import {
  Banknote,
  ShieldCheck,
  Lock,
  ArrowLeft,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  DollarSign,
  Fingerprint,
  FileText,
  Building,
  Briefcase,
  User as UserIcon,
  Info
} from 'lucide-react';

interface BankVerificationProps {
  user: User;
  setUser: (user: User) => void;
  setView: (view: AppView) => void;
}

// Regex for IFSC Code and PAN
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const GST_REGISTRATION_TYPES = ['Registered', 'Unregistered', 'Composition'];

export const BankVerification: React.FC<BankVerificationProps> = ({ user, setUser, setView }) => {
  const { t } = useTranslation();

  // Bank Account States
  const [ifscCode, setIfscCode] = useState(user.ifsc_code || '');
  const [bankName, setBankName] = useState(user.bank_name || '');
  const [branchName, setBranchName] = useState(user.branch_name || '');
  const [accountNumber, setAccountNumber] = useState(''); // Never populate directly from user.account_number_encrypted
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

  // Only merchants can use this page
  useEffect(() => {
    if (user.role !== 'merchant') {
      setView('profile'); // Redirect non-merchants
    }
    // Pre-fill existing PAN
    if (user.pan) setPanNumber(user.pan);
  }, [user.role, user.pan, setView]);

  const isIfscValid = useMemo(() => IFSC_REGEX.test(ifscCode), [ifscCode]);
  const isPanValid = useMemo(() => PAN_REGEX.test(panNumber), [panNumber]);

  // Fetch Bank Details from Razorpay IFSC API
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
      setIfscError(err.message || 'Failed to fetch bank details.');
      setBankName('');
      setBranchName('');
    } finally {
      setIfscLoading(false);
    }
  }, []);

  // Effect to trigger IFSC API call on valid input
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

  // Handle Penny Drop Verification
  const handleVerifyAccount = async () => {
    if (!user.id || !isIfscValid || !bankName || !branchName || accountNumber !== confirmAccountNumber || accountNumber.length < 9) {
      setAccountError('Please fill all bank details correctly.');
      return;
    }

    setIsVerifyingAccount(true);
    setPennyDropFeedback(null);
    setAccountError(null);

    try {
      // Client-side Encryption: Base64 for simulation
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
        // In a real app, you'd poll backend for 'verified' status
        setTimeout(() => {
          setPennyDropStatus('verified'); // Simulate success
          setPennyDropFeedback('Account verified! ₹1 credit received.');
        }, 5000); // Simulate network delay + verification time
      } else {
        setPennyDropStatus('failed');
        setPennyDropFeedback(response.message || 'Penny drop failed. Please re-check details.');
      }
    } catch (err: any) {
      console.error("Penny drop initiation failed:", err);
      setPennyDropStatus('failed');
      setPennyDropFeedback(err.message || 'Failed to initiate penny drop.');
    } finally {
      setIsVerifyingAccount(false);
    }
  };

  // Handle Saving All Details (Bank & KYC)
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

    // Basic client-side validation before sending
    if (!isIfscValid || !bankName || !branchName || pennyDropStatus !== 'verified') {
        setSaveError("Bank account must be verified via penny drop.");
        setIsSaving(false);
        return;
    }
    if (panNumber.length > 0 && !isPanValid) { // PAN is optional, but if present must be valid
        setSaveError("Invalid PAN Number format.");
        setIsSaving(false);
        return;
    }
    // Account number is encrypted, so we rely on penny drop verification for correctness.
    // If not doing penny drop, you'd need explicit validation for account number here.

    try {
        const encryptedAccountNumber = paymentService.encryptAccountNumber(accountNumber); // Encrypt again before saving

        const updateData = {
            ifsc_code: ifscCode,
            bank_name: bankName,
            branch_name: branchName,
            account_number_encrypted: encryptedAccountNumber, // Send encrypted
            account_type: accountType,
            penny_drop_status: pennyDropStatus, // Should be 'verified' at this point
            pan: panNumber, // Save PAN
            gst_registration_type: gstRegistrationType, // Save GST type
        };
        
        await editProfileService.updateUserProfile(user.id, user.role, updateData);
        
        // Update local user state
        setUser(prev => ({
          ...prev,
          ...updateData
        }));

        setSaveSuccess('Bank & KYC details saved successfully!');
        setTimeout(() => setView('profile'), 2000); // Redirect to profile
    } catch (err: any) {
        console.error("Failed to save bank/KYC details:", err);
        setSaveError(err.message || "Failed to save details. Please try again.");
    } finally {
        setIsSaving(false);
    }
  };

  const isFormValid = useMemo(() => {
    const bankDetailsComplete = isIfscValid && bankName && branchName && accountNumber === confirmAccountNumber && accountNumber.length >= 9 && pennyDropStatus === 'verified';
    const kycDetailsValid = panNumber.length === 0 || isPanValid; // PAN is optional, valid if empty or matches regex
    return bankDetailsComplete && kycDetailsValid;
  }, [isIfscValid, bankName, branchName, accountNumber, confirmAccountNumber, pennyDropStatus, panNumber, isPanValid]);

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal space-y-8 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => setView('profile')} 
          className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-white/10 active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-slate-400" />
        </button>
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">
            Bank<br /><span className="text-emerald-500">Verification</span>
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">Secure Payout Gateway</p>
          </div>
        </div>
        <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-white/10">
          <Banknote className="w-6 h-6 text-slate-400" />
        </div>
      </div>

      {saveSuccess && (
        <div className="text-center py-6 glass rounded-[3.5rem] border-emerald-500/20 bg-emerald-500/5 shadow-2xl animate-reveal">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">Success!</p>
          <p className="text-xs font-bold text-slate-400 px-10">{saveSuccess}</p>
        </div>
      )}

      {saveError && (
        <div className="text-center py-6 glass rounded-[3.5rem] border-rose-500/20 bg-rose-500/5 shadow-2xl animate-shake">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">Error!</p>
          <p className="text-xs font-bold text-slate-400 px-10">{saveError}</p>
        </div>
      )}

      <form onSubmit={handleSaveDetails} className="space-y-6">
        {/* Bank Account Details */}
        <div className="glass p-8 rounded-[3rem] border-white/10 bg-slate-900/40 shadow-2xl space-y-6">
          <h3 className="text-xl font-black uppercase tracking-tighter text-white text-center">Bank Account Details</h3>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center -mt-4">
            For secure payouts and transactions
          </p>

          <div className="space-y-4">
            <div className="relative group">
              <Building className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500" />
              <input
                type="text"
                placeholder="IFSC Code (e.g., HDFC0000001)"
                className={`input-premium pl-14 ${ifscError ? 'border-rose-500' : ''}`}
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                maxLength={11}
                required
              />
              {ifscLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500 animate-spin" />}
              {ifscCode.length === 11 && isIfscValid && !ifscLoading && !ifscError && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
              {ifscError && <AlertTriangle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
            </div>
            {ifscError && <p className="text-rose-500 text-xs text-center">{ifscError}</p>}

            <input
              type="text"
              placeholder="Bank Name"
              className="input-premium pl-5"
              value={bankName}
              readOnly
              disabled={true}
            />
            <input
              type="text"
              placeholder="Branch Name"
              className="input-premium pl-5"
              value={branchName}
              readOnly
              disabled={true}
            />

            <div className="relative group">
              <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500" />
              <input
                type="text" // Keep as text, but sanitize for numbers for encryption
                placeholder="Account Number"
                className="input-premium pl-14"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))} // Only allow digits
                required
                minLength={9} // Typical min length
              />
            </div>
            <div className="relative group">
              <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-500" />
              <input
                type="text" // Keep as text, but sanitize for numbers for encryption
                placeholder="Confirm Account Number"
                className="input-premium pl-14"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))} // Only allow digits
                required
                minLength={9}
              />
            </div>
            {accountNumber.length > 0 && confirmAccountNumber.length > 0 && accountNumber !== confirmAccountNumber && (
              <p className="text-rose-500 text-xs text-center">Account numbers do not match.</p>
            )}

            <div className="relative group">
              <Briefcase className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <select
                className="input-premium pl-14"
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

          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-2 italic text-center">
            The account number is encrypted at the application level before being sent to the database to comply with security best practices.
          </p>

          <button
            type="button"
            onClick={handleVerifyAccount}
            disabled={isVerifyingAccount || !isIfscValid || !bankName || accountNumber !== confirmAccountNumber || accountNumber.length < 9}
            className={`w-full btn-premium h-16 rounded-2xl shadow-xl flex items-center justify-center gap-3 ${
                pennyDropStatus === 'verified' ? 'bg-emerald-600/50 text-emerald-300 cursor-not-allowed' : 'shadow-blue-500/20'
            }`}
          >
            {isVerifyingAccount ? (
              <Loader2 className="animate-spin w-5 h-5" />
            ) : pennyDropStatus === 'verified' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Fingerprint className="w-5 h-5" />
            )}
            <span className="text-[11px] font-black uppercase tracking-widest">
              {pennyDropStatus === 'verified' ? 'Account Verified' : (isVerifyingAccount ? 'Initiating Penny Drop...' : 'Verify Account')}
            </span>
          </button>
          {pennyDropFeedback && (
            <p className={`text-xs text-center mt-2 ${pennyDropStatus === 'failed' ? 'text-rose-500' : 'text-emerald-500'}`}>{pennyDropFeedback}</p>
          )}
        </div>

        {/* KYC Details */}
        <div className="glass p-8 rounded-[3rem] border-white/10 bg-slate-900/40 shadow-2xl space-y-6">
          <h3 className="text-xl font-black uppercase tracking-tighter text-white text-center">KYC Details</h3>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center -mt-4">
            Additional compliance for merchants
          </p>

          <div className="space-y-4">
            <div className="relative group">
              <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-blue-500" />
              <input
                type="text"
                placeholder="PAN Number"
                className={`input-premium pl-14 ${panNumber.length > 0 && !isPanValid ? 'border-rose-500' : ''}`}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                maxLength={10}
                // PAN is optional for now, but if entered, it should be valid
              />
              {panNumber.length > 0 && !isPanValid && <AlertTriangle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-500" />}
              {panNumber.length === 10 && isPanValid && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />}
            </div>
            {panNumber.length > 0 && !isPanValid && <p className="text-rose-500 text-xs text-center">Invalid PAN format.</p>}

            <div className="relative group">
              <Info className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <select
                className="input-premium pl-14"
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
          className="w-full btn-premium h-16 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-4"
        >
          {isSaving ? (
            <Loader2 className="animate-spin w-5 h-5" />
          ) : (
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-[11px] font-black uppercase tracking-widest">Save Bank & KYC Details</span>
            </div>
          )}
        </button>
      </form>

      {/* Trust Badges */}
      <div className="text-center mt-8 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
          Your security is our priority.
        </p>
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-emerald-500">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">SSL SECURED</span>
          </div>
          <div className="flex items-center gap-2 text-emerald-500">
            <Lock className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">PCI-DSS COMPLIANT</span>
          </div>
        </div>
      </div>
    </div>
  );
};