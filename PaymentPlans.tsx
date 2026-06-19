
import React, { useState, useEffect, useCallback } from 'react';
import { AppView, User } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { paymentService, MerchantPayment, MerchantPaymentSummary } from './services/paymentService';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface PaymentPlansProps {
  user: User;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
}

const inr = (n: number, currency = 'INR') => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(n);
  } catch {
    return `₹${Number(n || 0).toFixed(2)}`;
  }
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

// Realistic preview data so the merchant can see how the screen looks once their
// Razorpay subscription charges start flowing in. Clearly marked as a sample.
function buildSampleData(): { payments: MerchantPayment[]; summary: MerchantPaymentSummary } {
  const now = new Date();
  const month = (back: number) => {
    const d = new Date(now);
    d.setMonth(now.getMonth() - back);
    d.setDate(19);
    return d.toISOString();
  };
  const codes = ['pay_T3Tzo8GulUSIff', 'pay_T2Rk9mP1aXbQ7d', 'pay_SzL4hN8vY2wErC', 'pay_Sx0GqD6tU9oP3a', 'pay_RpM7bV2kJ4nZ1s', 'pay_Qn8cW5xH3gL0tB'];
  const rows: MerchantPayment[] = [];
  // Most recent 3 cycles on Platinum (₹399), older 3 on Basic (₹199), with one failed retry.
  const plan = [399, 399, 399, 199, 199, 199];
  for (let i = 0; i < 6; i++) {
    const failed = i === 2; // one failed cycle for realism
    rows.push({
      id: 1000 - i,
      transaction_id: failed ? null : codes[i],
      order_id: `order_sample_${i}`,
      amount_base: plan[i],
      amount_total: plan[i],
      currency: 'INR',
      payment_method: i % 2 === 0 ? 'upi' : 'card',
      payment_status: failed ? 'failed' : 'captured',
      failure_reason: failed ? 'Bank declined the auto-debit' : null,
      created_at: month(i),
    });
  }
  const captured = rows.filter((r) => r.payment_status === 'captured');
  return {
    payments: rows,
    summary: {
      total_count: rows.length,
      captured_count: captured.length,
      total_paid: captured.reduce((s, r) => s + Number(r.amount_total || 0), 0),
      currency: 'INR',
      last_payment_at: rows[0].created_at,
      window_months: 12,
    },
  };
}

export const PaymentPlans: React.FC<PaymentPlansProps> = ({ user, setView, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<MerchantPayment[]>([]);
  const [summary, setSummary] = useState<MerchantPaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSample(false);
    const res = await paymentService.getMerchantPayments();
    if (res.error) setError(res.error);
    setPayments(res.payments);
    setSummary(res.summary);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showSample = () => {
    const s = buildSampleData();
    setPayments(s.payments);
    setSummary(s.summary);
    setError(null);
    setSample(true);
  };

  const statusPill = (status: string | null) => {
    if (status === 'captured') return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Paid', cls: 'text-emerald-600 bg-emerald-500/10' };
    if (status === 'failed') return { icon: <XCircle className="w-3.5 h-3.5" />, label: 'Failed', cls: 'text-red-600 bg-red-500/10' };
    return { icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending', cls: 'text-amber-600 bg-amber-500/10' };
  };

  const card = isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200';
  const sub = isDark ? 'text-slate-400' : 'text-slate-600';
  const head = isDark ? 'text-white' : 'text-slate-900';

  return (
    <div className="px-6 pt-6 pb-32 space-y-5 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-1">
        <button
          onClick={() => setView('profile')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}
        >
          <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
        </button>
        <div className="flex-1">
          <h2 className={`text-xl font-semibold ${head}`}>Payments &amp; Invoices</h2>
          <p className={`text-xs font-medium ${sub}`}>Subscription billing · last 12 months</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
          <Receipt className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      {sample && (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${isDark ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="flex-1">Sample data — for preview only. This is how your billing history will look.</span>
          <button onClick={load} className="font-semibold underline underline-offset-2">Show mine</button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className={`text-xs ${sub}`}>Loading your payment activity…</p>
        </div>
      ) : payments.length > 0 ? (
        <>
          {/* Summary */}
          {summary && (
            <div className={`rounded-2xl border p-5 ${card}`}>
              <p className={`text-xs ${sub}`}>Total paid (last {summary.window_months} months)</p>
              <p className={`text-3xl font-bold mt-1 ${head}`}>{inr(summary.total_paid, summary.currency)}</p>
              <div className="flex items-center gap-4 mt-3 text-xs">
                <span className={sub}><span className="font-semibold text-emerald-500">{summary.captured_count}</span> successful</span>
                {summary.total_count - summary.captured_count > 0 && (
                  <span className={sub}><span className="font-semibold text-red-500">{summary.total_count - summary.captured_count}</span> unsuccessful</span>
                )}
                {summary.last_payment_at && <span className={sub}>Last: {fmtDate(summary.last_payment_at)}</span>}
              </div>
            </div>
          )}

          {/* List */}
          <div className="space-y-2.5">
            {payments.map((p) => {
              const pill = statusPill(p.payment_status);
              return (
                <div key={p.id} className={`rounded-xl border p-4 ${card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CreditCard className={`w-4 h-4 ${sub}`} />
                        <p className={`text-base font-bold ${head}`}>{inr(Number(p.amount_total || 0), p.currency || 'INR')}</p>
                      </div>
                      <p className={`text-[11px] mt-1 ${sub}`}>{fmtDate(p.created_at)}{p.payment_method ? ` · ${p.payment_method.toUpperCase()}` : ''}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill.cls}`}>
                      {pill.icon}{pill.label}
                    </span>
                  </div>

                  {/* Razorpay confirmation code */}
                  {p.transaction_id ? (
                    <div className={`mt-3 pt-3 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      <p className={`text-[10px] uppercase tracking-wide ${sub}`}>Razorpay confirmation</p>
                      <p className={`text-xs font-mono mt-0.5 ${head}`}>{p.transaction_id}</p>
                    </div>
                  ) : p.payment_status === 'failed' && p.failure_reason ? (
                    <div className={`mt-3 pt-3 border-t text-[11px] text-red-500 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {p.failure_reason}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <p className={`text-[11px] text-center ${sub}`}>Amounts are GST-inclusive. A tax invoice for each payment is available on request.</p>
        </>
      ) : (
        /* Graceful empty / error state */
        <div className={`rounded-2xl border p-8 text-center ${card}`}>
          <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${isDark ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
            <Receipt className={`w-7 h-7 ${sub}`} />
          </div>
          <p className={`text-base font-semibold mt-4 ${head}`}>{error ? 'Couldn’t load payments' : 'No payments yet'}</p>
          <p className={`text-sm mt-1 ${sub}`}>
            {error
              ? error
              : 'Your subscription charges will appear here — each with its Razorpay confirmation code and date.'}
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {error && (
              <button onClick={load} className="h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all">
                Try again
              </button>
            )}
            <button
              onClick={showSample}
              className={`h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${isDark ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}
            >
              <Sparkles className="w-4 h-4" />
              Show sample data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
