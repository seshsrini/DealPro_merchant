
import React, { useState, useEffect, useCallback } from 'react';
import { AppView, User } from '../types';
import { supabase } from '../services/supabaseClient';
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  Users,
  Gift,
  Trophy,
  TrendingUp,
  Loader2,
} from 'lucide-react';

interface ReferralTrackerProps {
  user: User;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
}

export const ReferralTracker: React.FC<ReferralTrackerProps> = ({ user, setView, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referralCount, setReferralCount] = useState(0);
  const threshold = 5; // 5 qualified referrals = 1 free month (matches the engine)
  const [totalAllTime, setTotalAllTime] = useState(0);
  const [rewardsEarned, setRewardsEarned] = useState(0);
  const [referralCode, setReferralCode] = useState(
    (user as any).merchant_referral_code || (user as any).my_referral_code || ''
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Always fetch the code fresh from DB if not on user object
      if (!referralCode && user.id) {
        const { data: profile } = await supabase
          .from('merchant_profiles')
          .select('merchant_referral_code')
          .eq('id', user.id)
          .single();

        if (profile?.merchant_referral_code) {
          setReferralCode(profile.merchant_referral_code);
        } else {
          // Generate and save one as last resort
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
          }
          const { error: updateErr } = await supabase
            .from('merchant_profiles')
            .update({ merchant_referral_code: code })
            .eq('id', user.id);
          if (!updateErr) {
            setReferralCode(code);
          }
        }
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      // Fetch this month's qualified referrals, all-time count, and rewards.
      // Threshold is fixed at 5 (matches the refund engine) — no app_configs read.
      const [monthRes, allTimeRes, rewardsRes] = await Promise.all([
        supabase
          .from('merchant_referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', user.id)
          .eq('status', 'qualified')
          .gte('qualified_at', monthStart)
          .lt('qualified_at', monthEnd),
        supabase
          .from('merchant_referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_id', user.id)
          .eq('status', 'qualified'),
        supabase
          .from('merchant_rewards_log')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', user.id),
      ]);

      setReferralCount(monthRes.count || 0);
      setTotalAllTime(allTimeRes.count || 0);
      setRewardsEarned(rewardsRes.count || 0);
    } catch (err) {
      console.error('[ReferralTracker] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Cumulative model with carryover: progress is toward the NEXT free month, and
  // available credits = floor(all-time referrals / threshold) − months granted.
  const cycleProgress = threshold > 0 ? totalAllTime % threshold : 0;
  const remaining = threshold - cycleProgress; // referrals to the next free month
  const availableCredits = Math.max(0, Math.floor(totalAllTime / Math.max(1, threshold)) - rewardsEarned);
  const progressPct = Math.min(100, (cycleProgress / threshold) * 100);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = referralCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`px-6 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView('profile')} className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-900'}`} />
        </button>
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Referral Progress</h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Refer merchants · earn free months</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading...</p>
        </div>
      ) : (
        <div className="space-y-5">

          {/* Referral Code Card */}
          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
            <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your Permanent Referral Code</p>
            <div className="flex items-center gap-3">
              <div className={`flex-1 px-4 py-3 rounded-xl font-mono text-xl font-bold tracking-widest text-center ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
                {referralCode}
              </div>
              <button
                onClick={handleCopy}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}
              >
                {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
            <p className={`text-[10px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Share this code with other merchants to invite them to DealPro
            </p>
          </div>

          {/* Progress Card */}
          <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Goal banner */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-white" />
                <span className="text-white text-xs font-bold tracking-wide uppercase">Next Free Month</span>
              </div>
              <span className="text-white/90 text-xs font-semibold">
                {cycleProgress} / {threshold} referrals
              </span>
            </div>

            <div className="p-4 space-y-4">
              {/* Progress bar */}
              <div>
                <div className={`w-full h-4 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>0</span>
                  <span className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{threshold}</span>
                </div>
              </div>

              {/* Message */}
              {availableCredits > 0 ? (
                <div className={`rounded-xl p-3 flex items-start gap-3 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>
                      {availableCredits} free month{availableCredits !== 1 ? 's' : ''} ready 🎁
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-emerald-300/70' : 'text-emerald-700'}`}>
                      We&apos;ll refund {availableCredits !== 1 ? 'them' : 'it'} to your payment method on your next bill. Referrals carry over — keep going!
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`rounded-xl p-3 flex items-start gap-3 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                  <Gift className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className={`text-sm font-semibold ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                      {remaining} more referral{remaining !== 1 ? 's' : ''} for a free month
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-amber-300/70' : 'text-amber-700'}`}>
                      Every {threshold} qualified referrals = 1 free month. Unused referrals carry over.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`rounded-xl p-3 text-center border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
              <Users className={`w-5 h-5 mx-auto mb-1.5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
              <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{referralCount}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>This Month</p>
            </div>
            <div className={`rounded-xl p-3 text-center border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
              <TrendingUp className={`w-5 h-5 mx-auto mb-1.5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
              <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{totalAllTime}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>All Time</p>
            </div>
            <div className={`rounded-xl p-3 text-center border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
              <Gift className={`w-5 h-5 mx-auto mb-1.5 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
              <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{rewardsEarned}</p>
              <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Free Months</p>
            </div>
          </div>

          {/* How it works */}
          <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>How it works</h3>
            <div className="space-y-3">
              {[
                { step: '1', text: 'Share your referral code with other merchants' },
                { step: '2', text: 'They enter your code during their DealPro signup' },
                { step: '3', text: `Every ${threshold} qualified referrals = 1 free month — unused referrals carry over` },
                { step: '4', text: 'We refund that month’s charge to your payment method' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                    {item.step}
                  </div>
                  <p className={`text-xs leading-relaxed pt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
