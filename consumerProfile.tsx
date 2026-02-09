

import React, { useState } from 'react';
import { 
  User as UserIcon, 
  ShieldCheck, 
  ChevronRight, 
  MessageSquareText, 
  PenLine, 
  Heart, 
  Share2,
  Send,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck
} from 'lucide-react';
import { AppView } from './types';
import { userService } from './services/userService';
import { useTranslation } from './contexts/LanguageContext';
import { dealdetailsService } from './services/dealdetailsService';

const INVITE_COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "USA", flag: "🇺🇸" },
  { code: "+44", country: "UK", flag: "🇬🇧" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" }
];

interface ConsumerProfileProps {
  user: any;
  setUser: (user: any) => void;
  setView: (view: AppView) => void;
  onVerificationHubClick?: () => void;
  theme?: 'dark' | 'light';
}

export const ConsumerProfile: React.FC<ConsumerProfileProps> = ({ user, setUser, setView, onVerificationHubClick, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [inviteValue, setInviteValue] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  
  const [selectedCountry, setSelectedCountry] = useState(INVITE_COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const isPhoneInput = /^[0-9+]/.test(inviteValue);

  const handleManualInvite = async () => {
    if (!inviteValue) return;
    
    setIsInviting(true);
    setShowInviteSuccess(false);

    // userService.logActivity now calls an Edge Function
    // Fix: Added 'platform' property to satisfy ActivityLog interface
    await userService.logActivity({
      user_id: user.id,
      event_type: 'click',
      platform: 'mobile',
      metadata: { action: 'refer_friend', identifier_type: isPhoneInput ? 'phone' : 'email' }
    });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsInviting(false);
    setShowInviteSuccess(true);
    setInviteValue('');
    
    setTimeout(() => setShowInviteSuccess(false), 4000);
  };

  const handleHubClick = () => {
    if (onVerificationHubClick) {
      onVerificationHubClick();
    } else {
      setView('my_redemptions');
    }
  };

  return (
    <div className="px-8 pt-6 animate-reveal">
       <div className="flex flex-col items-center mb-12">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 flex items-center justify-center p-1.5 shadow-2xl shadow-yellow-500/30 mb-6 relative">
             <div className={`w-full h-full rounded-full ${isDark ? 'bg-slate-950' : 'bg-white'} flex items-center justify-center border-4 ${isDark ? 'border-slate-950/20' : 'border-white/20'} overflow-hidden`}>
                <UserIcon className="w-12 h-12 text-yellow-500" />
             </div>
             <button
               onClick={() => setView('edit_profile')}
               className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-yellow-600 border-2 border-slate-950 flex items-center justify-center shadow-lg active:scale-90 transition-all"
             >
                <PenLine className="w-4 h-4 text-white" />
             </button>
          </div>
          <h2 className={`text-3xl font-black uppercase tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.username}</h2>
          <div className="flex items-center gap-3 mt-3">
             <div className="flex items-center gap-1.5 px-3 py-1 glass rounded-lg border-white/5">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">{t('profile_elite_member')}</span>
             </div>
          </div>
       </div>

       <div className="space-y-4">
          <button onClick={handleHubClick} className="w-full glass p-5 rounded-[2rem] border-yellow-500/20 bg-yellow-500/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                   <ClipboardCheck className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                   <span className={`block font-black text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} uppercase`}>{t('profile_verif_hub')}</span>
                   <span className="block text-[8px] font-bold text-yellow-600 uppercase tracking-widest">{t('profile_verif_sub')}</span>
                </div>
             </div>
             <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-700' : 'text-slate-400'} group-hover:text-yellow-500 transition-all group-hover:translate-x-1`} />
          </button>

          <button onClick={() => setView('edit_profile')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                   <PenLine className="w-5 h-5 text-indigo-500" />
                </div>
                <span className="font-bold text-sm tracking-tight text-slate-200">{t('profile_edit')}</span>
             </div>
             <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
          </button>

          <button onClick={() => setView('favorites')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                   <Heart className="w-5 h-5 text-rose-500" />
                </div>
                <span className="font-bold text-sm tracking-tight text-slate-200">{t('profile_favs')}</span>
             </div>
             <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-rose-500 transition-all group-hover:translate-x-1" />
          </button>

          <button onClick={() => setView('help_feedback')} className="w-full glass p-5 rounded-[2rem] border-white/5 flex items-center justify-between group active:scale-[0.98] transition-all">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                   <MessageSquareText className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="font-bold text-sm tracking-tight text-slate-200">{t('profile_help')}</span>
             </div>
             <ChevronRight className="w-5 h-5 text-slate-700 group-hover:text-emerald-500 transition-all group-hover:translate-x-1" />
          </button>

          <div className="w-full glass p-6 rounded-[2.5rem] border-white/5 space-y-4 relative transition-all duration-500">
             <div className="flex items-center gap-5">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                   <Share2 className="w-5 h-5 text-amber-500" />
                </div>
                <span className="font-bold text-sm tracking-tight text-slate-200">{t('profile_invite_friend')}</span>
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
                              className="w-full text-left p-3 hover:bg-yellow-500/10 rounded-xl text-xs font-bold flex gap-3 items-center"
                            >
                              <span>{c.flag}</span> <span className="flex-1 text-slate-200">{c.country}</span> <span className="text-slate-500">{c.code}</span>
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

       <div className="mt-12 text-center pb-32">
          <p className="text-[9px] font-black uppercase tracking-[0.6em] text-slate-700">© 2026 DealPro. All Rights Reserved.</p>
       </div>
    </div>
  );
};