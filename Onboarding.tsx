import React, { useState, useRef } from 'react';
import { AppView, User } from './types'; 
import { useTranslation } from './contexts/LanguageContext';
import { 
  MapPin, 
  Zap, 
  Clock, 
  ChevronRight, 
  ArrowRight,
  ChevronLeft
} from 'lucide-react';

interface OnboardingProps {
  setView: (view: AppView) => void;
  user: User; 
  setUser: (user: User) => void; 
}

const ONBOARDING_CONFIG = [
  { id: 1, icon: MapPin, color: "from-blue-500 to-indigo-600", glow: "shadow-blue-500/10" },
  { id: 2, icon: Zap, color: "from-amber-400 to-orange-500", glow: "shadow-amber-500/10" },
  { id: 3, icon: Clock, color: "from-emerald-400 to-teal-500", glow: "shadow-emerald-500/10" }
];

export const Onboarding: React.FC<OnboardingProps> = ({ setView, user, setUser }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const nextStep = async () => {
    if (step < ONBOARDING_CONFIG.length - 1) {
      setStep(step + 1);
    } else {
      console.log(`[Onboarding] Finalizing for user: ${user.id}`);
      
      // Navigate immediately for best UX
      setView('preferences');

      // Update local state
      setUser({ ...user, onboarding_complete: true });
      
      // Removed editProfileService.updateUserProfile background call to follow request
    }
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextStep();
      else prevStep();
    }
    touchStartX.current = null;
  };

  const currentConfig = ONBOARDING_CONFIG[step];
  const Icon = currentConfig.icon;

  return (
    <div 
      className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-0 select-none overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="w-[90vw] h-[90dvh] bg-slate-950/95 rounded-[3rem] border border-white/10 flex flex-col items-center justify-between p-10 relative overflow-hidden shadow-2xl animate-reveal">
        <div className={`absolute top-[-30%] right-[-20%] w-[150%] h-[60%] rounded-full blur-[140px] opacity-10 transition-all duration-1000 bg-gradient-to-br ${currentConfig.color}`}></div>
        
        <div className="w-full flex items-center justify-center z-10 mb-4">
          <div className="flex gap-1.5">
            {ONBOARDING_CONFIG.map((_, i) => (
              <div key={i} className={`h-[3px] rounded-full transition-all duration-700 ${i === step ? 'w-10 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'w-2 bg-white/10'}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center w-full z-10 py-6 overflow-hidden">
          <div className="relative w-32 h-32 md:w-40 md:h-40 shrink-0 mb-10 group">
             <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 bg-white/[0.02] backdrop-blur-xl flex items-center justify-center shadow-inner">
                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-gradient-to-br ${currentConfig.color} p-0.5 shadow-2xl ${currentConfig.glow}`}>
                   <div className="w-full h-full rounded-[1.4rem] bg-slate-950 flex items-center justify-center border border-white/10">
                      <Icon className="w-8 h-8 md:w-10 md:h-10 text-white" strokeWidth={1.5} />
                   </div>
                </div>
             </div>
          </div>

          <div key={step} className="space-y-4 animate-reveal px-2 flex flex-col items-center">
             <div className="px-3 py-1 rounded-full border border-white/5 bg-white/5 mb-2">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400">{t(`onboarding_${step + 1}_tag`)}</span>
             </div>
             <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-white uppercase leading-none px-4">{t(`onboarding_${step + 1}_headline`)}</h2>
             <p className="text-slate-400 text-sm md:text-base leading-relaxed mt-4 max-w-[280px] opacity-80">{t(`onboarding_${step + 1}_sub`)}</p>
          </div>
        </div>

        <div className="w-full flex items-center justify-between z-10 pt-8">
          {step > 0 ? (
            <button onClick={prevStep} className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-500 active:scale-90"><ChevronLeft className="w-6 h-6" /></button>
          ) : <div className="w-14" />}
          <button onClick={nextStep} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-2xl ${step === ONBOARDING_CONFIG.length - 1 ? 'bg-blue-600 text-white' : 'bg-white/[0.05] border border-white/10 text-white'}`}>
            {step === ONBOARDING_CONFIG.length - 1 ? <ArrowRight className="w-8 h-8" /> : <ChevronRight className="w-8 h-8" />}
          </button>
        </div>
      </div>
    </div>
  );
};