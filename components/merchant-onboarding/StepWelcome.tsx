import React, { useState, useEffect } from 'react';
import { Sparkles, User, Store, MapPin, ShieldCheck, FileText, CreditCard, ArrowRight } from 'lucide-react';
import { floatIn } from './floatIn';

interface StepWelcomeProps {
  onNext: () => void;
  theme: 'light' | 'dark';
}

const STEPS_PREVIEW = [
  { icon: User, label: 'Your name', color: 'text-blue-500' },
  { icon: Store, label: 'Store details', color: 'text-emerald-500' },
  { icon: MapPin, label: 'Store address', color: 'text-purple-500' },
  { icon: ShieldCheck, label: 'Business verification', color: 'text-amber-500' },
  { icon: FileText, label: 'Terms & privacy', color: 'text-slate-500' },
  { icon: CreditCard, label: 'Choose a plan', color: 'text-pink-500' },
];

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onNext, theme }) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div
        style={floatIn(0, visible)}
        className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4"
      >
        <Sparkles className="w-7 h-7 text-amber-500" />
      </div>

      <h2
        style={floatIn(100, visible)}
        className={`text-2xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}
      >
        Welcome to DealPro!
      </h2>
      <p
        style={floatIn(200, visible)}
        className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        Before you can start creating deals and reaching customers, we need a few details to set up your merchant account.
      </p>

      <div className="space-y-2 mb-4">
        {STEPS_PREVIEW.map(({ icon: Icon, label, color }, i) => (
          <div
            key={i}
            style={floatIn(300 + i * 80, visible)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
              isDark ? 'bg-slate-800/60' : 'bg-slate-50'
            }`}
          >
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <p
        style={floatIn(800, visible)}
        className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
      >
        Takes about 3–5 minutes. Your progress is saved automatically.
      </p>

      <div style={floatIn(900, visible)} className="mt-auto pb-safe-bottom">
        <button
          onClick={onNext}
          className="w-full h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Let's get started <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
