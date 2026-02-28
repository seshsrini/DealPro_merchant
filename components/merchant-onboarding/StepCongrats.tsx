import React, { useState, useEffect } from 'react';
import { PartyPopper, Rocket, Store, Sparkles, ArrowRight } from 'lucide-react';
import { floatIn } from './floatIn';

interface StepCongratsProps {
  storeName: string;
  onGoToDashboard: () => void;
  theme: 'light' | 'dark';
}

export const StepCongrats: React.FC<StepCongratsProps> = ({ storeName, onGoToDashboard, theme }) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col min-h-full items-center justify-center px-8 text-center">
      {/* Celebration icon cluster */}
      <div style={floatIn(0, visible)} className="relative mb-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <PartyPopper className="w-10 h-10 text-emerald-500" />
        </div>
        <div
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center"
          style={floatIn(300, visible)}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
        </div>
        <div
          className="absolute -bottom-1 -left-3 w-7 h-7 rounded-full bg-purple-500/15 flex items-center justify-center"
          style={floatIn(400, visible)}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
        </div>
      </div>

      <h2
        style={floatIn(200, visible)}
        className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}
      >
        You're all set!
      </h2>

      <p
        style={floatIn(350, visible)}
        className={`text-sm mb-8 max-w-[280px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        <strong className={isDark ? 'text-white' : 'text-slate-800'}>{storeName}</strong> is ready to go.
        Start creating deals and reach customers in your area.
      </p>

      {/* What you can do now */}
      <div style={floatIn(500, visible)} className="w-full space-y-2.5 mb-8">
        {[
          { icon: Store, text: 'Create your first deal', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { icon: Rocket, text: 'Launch a Deal of the Day', color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { icon: Sparkles, text: 'Attract nearby customers', color: 'text-amber-500', bg: 'bg-amber-500/10' },
        ].map(({ icon: Icon, text, color, bg }, i) => (
          <div
            key={i}
            style={floatIn(600 + i * 80, visible)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
              isDark ? 'bg-slate-800/60' : 'bg-slate-50'
            }`}
          >
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {text}
            </span>
          </div>
        ))}
      </div>

      <div style={floatIn(900, visible)} className="w-full pb-6">
        <button
          onClick={onGoToDashboard}
          className="w-full h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Go to Dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
