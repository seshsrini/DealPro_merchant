import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Pencil, User, Store, MapPin, ShieldCheck, ArrowRight } from 'lucide-react';
import { floatIn } from './floatIn';
import { useTranslation } from '../../contexts/LanguageContext';

// Matches WizardState from MerchantOnboarding.tsx
interface ReviewState {
  fullName: string;
  storeName: string;
  category: string;
  stores: Array<{
    store_name: string;
    street: string;
    pincode: string;
    locality: string;
    city: string;
    state: string;
    landmark: string;
    coords: { latitude: number; longitude: number } | null;
    is24hrs: boolean;
    shift1: string;
    shift2: string;
    store_category?: string;
  }>;
  businessType: '' | 'gstin' | 'udyam' | 'fssai' | 'trade_license' | 'none';
  gstinValue: string;
  panValue: string;
  udyamValue: string;
  fssaiValue: string;
  tradeLicenseValue: string;
}

interface StepReviewDetailsProps {
  state: ReviewState;
  onEditStep: (stepIndex: number, storeIndex?: number) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

// Mask sensitive values: show first N and last M chars
const maskValue = (value: string, showFirst: number, showLast: number): string => {
  if (!value || value.length <= showFirst + showLast) return value;
  return value.slice(0, showFirst) + '*'.repeat(value.length - showFirst - showLast) + value.slice(-showLast);
};

// Reusable review card
const ReviewCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  onEdit: () => void;
  children: React.ReactNode;
  isDark: boolean;
  style?: React.CSSProperties;
}> = ({ title, icon, onEdit, children, isDark, style }) => (
  <div
    style={style}
    className={`p-4 rounded-xl border ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    }`}
  >
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {title}
        </h3>
      </div>
      <button
        onClick={onEdit}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${
          isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'
        }`}
        aria-label={`Edit ${title}`}
      >
        <Pencil className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
      </button>
    </div>
    {children}
  </div>
);

export const StepReviewDetails: React.FC<StepReviewDetailsProps> = ({
  state, onEditStep, onNext, onBack, theme,
}) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const bizTypeLabel = (bt: string): string => (({
    gstin: t('ob_bt_gstin'),
    udyam: t('ob_bt_udyam'),
    fssai: t('ob_bt_fssai'),
    trade_license: t('ob_bt_trade'),
    none: t('ob_bt_none'),
  } as Record<string, string>)[bt] || t('ob_review_not_selected'));

  const valueClass = `text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`;
  const labelClass = `text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`;

  return (
    <div className="flex flex-col min-h-full px-6 pt-5">
      {/* Header */}
      <div style={floatIn(0, visible)} className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <ClipboardCheck className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {t('ob_review_title')}
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('ob_review_sub')}
          </p>
        </div>
      </div>

      {/* Scrollable review cards */}
      <div className="space-y-3 overflow-y-auto flex-1 pb-4">
        {/* Your Name → edits step 1 */}
        <ReviewCard
          title={t('ob_review_your_name')}
          icon={<User className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
          onEdit={() => onEditStep(1)}
          isDark={isDark}
          style={floatIn(100, visible)}
        >
          <p className={valueClass}>{state.fullName}</p>
        </ReviewCard>

        {/* Store Name → edits step 2 */}
        <ReviewCard
          title={t('ob_review_store_name')}
          icon={<Store className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
          onEdit={() => onEditStep(2)}
          isDark={isDark}
          style={floatIn(200, visible)}
        >
          <p className={valueClass}>{state.storeName}</p>
        </ReviewCard>

        {/* Stores → edits step 5 (Add More Stores) */}
        <ReviewCard
          title={(state.stores.length > 1 ? t('ob_review_stores_many') : t('ob_review_stores_one')).replace('{n}', String(state.stores.length))}
          icon={<MapPin className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
          onEdit={() => onEditStep(5)}
          isDark={isDark}
          style={floatIn(300, visible)}
        >
          <div className="space-y-2">
            {state.stores.map((s, i) => (
              <div key={i} className={`${i > 0 ? `pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}` : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {s.store_name || state.storeName || t('ob_store_fallback').replace('{n}', String(i + 1))}
                    </p>
                    <p className={labelClass}>
                      {[s.street, s.locality, s.city, s.state, s.pincode].filter(Boolean).join(', ')}
                    </p>
                    {s.landmark && <p className={labelClass}>{t('ob_review_near').replace('{landmark}', s.landmark)}</p>}
                    <p className={labelClass}>
                      {s.is24hrs ? t('ob_addr_open24') : `${s.shift1} - ${s.shift2}`}
                    </p>
                    {s.store_category && (
                      <p className="text-xs font-semibold text-amber-500 mt-0.5">{s.store_category}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onEditStep(4, i)}
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 mt-0.5 ${
                      isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                    aria-label={`Edit store ${i + 1}`}
                  >
                    <Pencil className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </ReviewCard>

        {/* Business Verification → edits step 6 */}
        <ReviewCard
          title={t('ob_review_biz')}
          icon={<ShieldCheck className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
          onEdit={() => onEditStep(6)}
          isDark={isDark}
          style={floatIn(400, visible)}
        >
          <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {bizTypeLabel(state.businessType)}
          </p>
          {state.businessType === 'gstin' && (
            <>
              <p className={valueClass}>GSTIN: <span className="font-bold">{maskValue(state.gstinValue, 2, 3)}</span></p>
              <p className={valueClass}>PAN: <span className="font-bold">{maskValue(state.panValue, 2, 2)}</span></p>
            </>
          )}
          {state.businessType === 'udyam' && (
            <p className={valueClass}>Udyam: <span className="font-bold">{maskValue(state.udyamValue, 6, 4)}</span></p>
          )}
          {state.businessType === 'fssai' && (
            <p className={valueClass}>FSSAI: <span className="font-bold">{maskValue(state.fssaiValue, 3, 3)}</span></p>
          )}
          {state.businessType === 'trade_license' && (
            <p className={valueClass}>License: <span className="font-bold">{maskValue(state.tradeLicenseValue, 2, 3)}</span></p>
          )}
        </ReviewCard>
      </div>

      {/* Navigation */}
      <div style={floatIn(600, visible)} className="pb-safe-bottom pt-4 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t('ob_back')}
        </button>
        <button
          onClick={onNext}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {t('ob_review_looks_good')} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
