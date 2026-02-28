
import React from 'react';
import { AppView } from './types';
import {
  Zap,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

interface MerchantDealOfDayProps {
  user: any;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
}

export const MerchantDealOfDay: React.FC<MerchantDealOfDayProps> = ({ user, setView, theme = 'light' }) => {
  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen px-5 pb-32 pt-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setView('merchant_dashboard')} className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-[0.95] transition-all ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-700'}`} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Deal of the Day
              </h1>
              <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Feature your best offer</p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-yellow-500/5 border-yellow-500/10' : 'bg-yellow-50 border-yellow-100'}`}>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>Deal of the Day Benefits</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Your campaign will be prominently featured to consumers searching for today's best deals!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create New DOTD Button */}
      <button
        onClick={() => setView('dotd_wizard')}
        className="relative overflow-hidden rounded-2xl p-5 w-full text-left bg-yellow-500 border-2 border-yellow-400 transition-all active:translate-y-0.5 active:shadow-none shadow-lg shadow-yellow-500/30 mb-4"
      >
        <div className="absolute top-3 right-3">
          <ArrowRight className="w-5 h-5 text-white/70" />
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Create Deal of the Day
            </h3>
            <p className="text-xs text-white/80">
              Step-by-step in under a minute
            </p>
          </div>
        </div>
      </button>
    </div>
  );
};
