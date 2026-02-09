
import React, { useState, useMemo } from 'react';
import { 
  User as UserIcon, 
  Store, 
  ShieldCheck, 
  ChevronRight, 
  PenLine, 
  BarChart3,
  HelpCircle,
  Share2,
  Send,
  Loader2,
  CheckCircle2,
  ChevronDown,
  CreditCard, // Added CreditCard icon for subscriptions
  Zap,
  Banknote, // Added Banknote for Bank Verification
} from 'lucide-react';
import { AppView } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { generateWhatsAppReferralLink } from './utils/referralUtils'; 
import { userService } from './services/userService';
import { MreferralService } from './services/MreferralService';

const INVITE_COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+44", country: "UK", "flag": "🇬🇧" },
  { code: "+971", country: "UAE", "flag": "🇦🇪" },
  { code: "+61", country: "Australia", "flag": "🇦🇺" },
  { code: "+65", country: "Singapore", "flag": "🇸🇬" }
];

interface MerchantProfileProps {
  user: any;
  setUser: (user: any) => void;
  setView: (view: AppView) => void;
}

export const MerchantProfile: React.FC<MerchantProfileProps> = ({ user, setUser, setView }) => {
  const { t } = useTranslation();
  const [inviteValue, setInviteValue] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  
  const [selectedCountry, setSelectedCountry] = useState(INVITE_COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  
  const isDark = (document.body.classList.contains('light-mode') === false);

  const isPhoneInput = useMemo(() => /^[0-9+]/.test(inviteValue) || !inviteValue.includes('@'), [inviteValue]);
  
  // Use user's referral code if available, otherwise generate a client-side dummy one
  const merchantReferralCode = useMemo(() => {
    return user.my_referral_code || `DUMMY-REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }, [user.my_referral_code]);

  const handleManualInvite = async () => {
    if (!inviteValue) return;
    
    setIsInviting(true);
    setShowInviteSuccess(false);

    await userService.logActivity({
      user_id: user.id,
      event_type: 'click',
      platform: 'mobile',
      metadata: { action: 'refer_partner', identifier_type: isPhoneInput ? 'phone' : 'email', referral_code_used: merchantReferralCode }
    });

    try {
      const referrerId = user.id;
      // Use the resolved referral code (real or dummy)
      const referralCode = merchantReferralCode; 

      let inviteePhoneNumber: string | null = null;
      let inviteeEmail: string | null = null;

      if (isPhoneInput) {
        inviteePhoneNumber = `${selectedCountry.code}${inviteValue.replace(/[^0-9]/g, '')}`; // Clean phone number
        const cleanedPhoneNumberForWhatsApp = inviteePhoneNumber.replace(/[^0-9]/g, '');

        // Call MreferralService to log the phone invite
        await MreferralService.onInviteSent(
          referrerId,
          referralCode,
          inviteePhoneNumber,
          null // No email for phone invite
        );

        const whatsappLink = generateWhatsAppReferralLink(
          cleanedPhoneNumberForWhatsApp,
          user.store_name || user.username,
          referralCode
        );
        window.open(whatsappLink, '_blank');

      } else { // It's an email
        inviteeEmail = inviteValue;
        // Call MreferralService to log the email invite
        await MreferralService.onInviteSent(
          referrerId,
          referralCode,
          null, // No phone for email invite
          inviteeEmail
        );
      }

      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay for server response/UX
      
      setIsInviting(false);
      setShowInviteSuccess(true);
      setInviteValue('');
      
      setTimeout(() => setShowInviteSuccess(false), 4000);

    } catch (err: any) {
      console.error("Failed to log invite or send WhatsApp:", err);
      alert(err.message || "Failed to send invite. Please try again.");
      setIsInviting(false);
      setShowInviteSuccess(false);
    }
  };

  return (
    <div className="px-8 pt-6 animate-reveal pb-32">
       <div className="flex flex-col items-center mb-12">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center p-1.5 shadow-2xl shadow-blue-500/30 mb-6 relative">
             <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center border-4 border-slate-950/20 overflow-hidden text-blue-500">
                <Store className="w-12 h-12" />
             </div>
             <button 
               onClick={() => setView('edit_profile')}
               className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 border-2 border-slate-950 flex items-center justify-center shadow-lg active:scale-90 transition-all"
             >
                <PenLine className="w-4 h-4 text-white" />
             </button>
          </div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.store_name || user.username}</h2>
          <div className="flex items-center gap-3 mt-3">
             <div className="flex items-center gap-1.5 px-3 py-1 glass rounded-lg border-white/5">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{t('profile_verified_merchant')}</span>
             </div>
          </div>
       </div>

       <div className="space-y-4">
          <button onClick={() => setView('edit_profile')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                   <PenLine className="w-5 h-5 text-indigo-500" />
                </div>
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t('profile_edit_store')}</span>
             </div>
             <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-700' : 'text-slate-600'} group-hover:text-indigo-500 transition-all group-hover:translate-x-1`} />
          </button>

          <button onClick={() => setView('merchant_dashboard')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                   <BarChart3 className="w-5 h-5 text-blue-500" />
                </div>
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t('profile_console')}</span>
             </div>
             <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-700' : 'text-slate-600'} group-hover:text-blue-500 transition-all group-hover:translate-x-1`} />
          </button>

          {/* NEW: My Subscriptions Button */}
          <button onClick={() => setView('merchant_subscriptions')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                   <CreditCard className="w-5 h-5 text-purple-500" />
                </div>
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t('profile_subscriptions')}</span>
             </div>
             <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-700' : 'text-slate-600'} group-hover:text-purple-500 transition-all group-hover:translate-x-1`} />
          </button>

          {/* NEW: Bank Verification Button */}
          <button onClick={() => setView('bank_verification')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                   <Banknote className="w-5 h-5 text-emerald-500" />
                </div>
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t('profile_bank_verification')}</span>
             </div>
             <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-700' : 'text-slate-600'} group-hover:text-emerald-500 transition-all group-hover:translate-x-1`} />
          </button>

          <button onClick={() => setView('payment_plans')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                   <CreditCard className="w-5 h-5 text-red-500" />
                </div>
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t('profile_payments')}</span>
             </div>
             <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-700' : 'text-slate-600'} group-hover:text-red-500 transition-all group-hover:translate-x-1`} />
          </button>

          <button onClick={() => setView('help_feedback')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                   <HelpCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t('profile_support_hub')}</span>
             </div>
             <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-700' : 'text-slate-600'} group-hover:text-emerald-500 transition-all group-hover:translate-x-1`} />
          </button>

          <div className={`w-full glass p-6 rounded-[2.5rem] border-white/5 space-y-4 relative transition-all duration-500`}>
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                   <Share2 className="w-5 h-5 text-amber-500" />
                </div>
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{t('profile_invite_partner')}</span>
             </div>
             
             {/* Referral code context - always display, either real or dummy */}
             <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                <Zap className="w-4 h-4 text-blue-500" />
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                  Your Referral Code: <span className="font-mono text-white">{merchantReferralCode}</span>
                </p>
             </div>

             <div className="flex gap-2">
                {isPhoneInput && (
                  <div className={`relative animate-reveal ${showCountryPicker ? 'z-[1000]' : ''}`}>
                    <button 
                      type="button" 
                      onClick={() => setShowCountryPicker(!showCountryPicker)} 
                      className="h-14 w-20 glass rounded-2xl border-white/10 flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <span className="text-lg">{selectedCountry.flag}</span>
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    </button>
                    {showCountryPicker && (
                      <div className="absolute top-full left-0 mt-2 w-48 glass rounded-2xl p-2 z-[999] shadow-2xl animate-reveal border-white/10">
                        <div className="max-h-48 overflow-y-auto hide-scrollbar">
                          {INVITE_COUNTRY_CODES.map(c => (
                            <button 
                              key={c.code} 
                              type="button" 
                              onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); }} 
                              className="w-full text-left p-3 hover:bg-blue-500/10 rounded-xl text-xs font-bold flex gap-3 items-center"
                            >
                              <span>{c.flag}</span> <span className={`${isDark ? 'text-slate-200' : 'text-slate-900'} flex-1`}>{c.country}</span> <span className={`${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{c.code}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="relative flex-1 group">
                   <input 
                     value={inviteValue} 
                     onChange={(e) => setInviteValue(e.target.value)}
                     placeholder={t('profile_invite_placeholder')} 
                     className="input-premium h-14 text-xs pl-5 pr-14 focus:border-amber-500/50" 
                   />
                   <button 
                     onClick={handleManualInvite}
                     disabled={!inviteValue || isInviting} 
                     className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg active:scale-90 transition-all disabled:opacity-30 disabled:grayscale"
                   >
                      {isInviting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                   </button>
                </div>
             </div>

             {showInviteSuccess && (
               <div className="flex items-center gap-2 px-2 animate-reveal">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    {t('profile_invite_success')}
                  </p>
               </div>
             )}
          </div>
       </div>

       <div className="mt-12 text-center">
          <p className={`text-[9px] font-black uppercase tracking-[0.6em] ${isDark ? 'text-slate-700' : 'text-slate-600'}`}>© 2026 DealPro Merchant. Grid Secure.</p>
       </div>
    </div>
  );
};
