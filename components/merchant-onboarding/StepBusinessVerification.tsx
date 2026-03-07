import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { userService } from '../../services/userService';
import { floatIn } from './floatIn';

// Validation regex — same as memberJoin.tsx
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[A-Z0-9]{1}$/;
const PAN_REGEX = /^[A-Z]{3}[CFPB][A-Z][0-9]{4}[A-Z]$/;
const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/i;
const FSSAI_REGEX = /^[0-9]{14}$/;
const TRADE_LICENSE_REGEX = /^[A-Z]{2}[A-Z0-9\/\-]{3,20}$/i;

const isGstValid = (v: string) => GST_REGEX.test(v);
const isPanValid = (v: string) => PAN_REGEX.test(v);
const isUdyamValid = (v: string) => UDYAM_REGEX.test(v.toUpperCase());
const isFssaiValid = (v: string) => FSSAI_REGEX.test(v);
const isTradeLicenseValid = (v: string) => TRADE_LICENSE_REGEX.test(v.toUpperCase());

type BusinessType = '' | 'gstin' | 'udyam' | 'fssai' | 'trade_license' | 'none';

interface StepBusinessVerificationProps {
  businessType: BusinessType;
  gstinValue: string;
  panValue: string;
  udyamValue: string;
  fssaiValue: string;
  tradeLicenseValue: string;
  onChangeType: (type: BusinessType) => void;
  onChangeField: (field: string, value: string) => void;
  onNext: () => void;
  onBack?: () => void;
  theme: 'light' | 'dark';
}

export const StepBusinessVerification: React.FC<StepBusinessVerificationProps> = ({
  businessType, gstinValue, panValue, udyamValue, fssaiValue, tradeLicenseValue,
  onChangeType, onChangeField, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Duplicate checking state
  const [gstinTaken, setGstinTaken] = useState<boolean | null>(null);
  const [panTaken, setPanTaken] = useState<boolean | null>(null);
  const [udyamTaken, setUdyamTaken] = useState<boolean | null>(null);
  const [fssaiTaken, setFssaiTaken] = useState<boolean | null>(null);
  const [tradeLicenseTaken, setTradeLicenseTaken] = useState<boolean | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);

  const inputClass = `w-full h-12 px-4 rounded-xl text-sm font-medium outline-none transition-all border ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
  }`;
  const labelClass = `text-xs font-semibold mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`;

  // Debounced duplicate check
  const checkDuplicate = (field: 'gstin' | 'pan' | 'udyam_no' | 'fssai_no' | 'trade_license_no', value: string, setTaken: (v: boolean | null) => void) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setChecking(field);
    setTaken(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const isTaken = await userService.validateMerchantField(field, value);
        setTaken(isTaken);
      } catch {
        setTaken(null);
      } finally {
        setChecking(null);
      }
    }, 500) as unknown as number;
  };

  const handleGstinChange = (v: string) => {
    const upper = v.toUpperCase().slice(0, 15);
    onChangeField('gstinValue', upper);
    if (isGstValid(upper)) {
      checkDuplicate('gstin', upper, setGstinTaken);
    } else {
      setGstinTaken(null);
    }
  };

  const handlePanChange = (v: string) => {
    const upper = v.toUpperCase().slice(0, 10);
    onChangeField('panValue', upper);
    if (isPanValid(upper)) {
      checkDuplicate('pan', upper, setPanTaken);
    } else {
      setPanTaken(null);
    }
  };

  const handleUdyamChange = (v: string) => {
    const upper = v.toUpperCase();
    onChangeField('udyamValue', upper);
    if (isUdyamValid(upper)) {
      checkDuplicate('udyam_no', upper, setUdyamTaken);
    } else {
      setUdyamTaken(null);
    }
  };

  const handleFssaiChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 14);
    onChangeField('fssaiValue', digits);
    if (isFssaiValid(digits)) {
      checkDuplicate('fssai_no', digits, setFssaiTaken);
    } else {
      setFssaiTaken(null);
    }
  };

  const handleTradeLicenseChange = (v: string) => {
    const upper = v.toUpperCase();
    onChangeField('tradeLicenseValue', upper);
    if (isTradeLicenseValid(upper)) {
      checkDuplicate('trade_license_no', upper, setTradeLicenseTaken);
    } else {
      setTradeLicenseTaken(null);
    }
  };

  const StatusIcon = ({ taken, checking: isChecking, fieldName }: { taken: boolean | null; checking: boolean; fieldName: string }) => {
    if (isChecking) return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    if (taken === true) return <ShieldAlert className="w-4 h-4 text-red-500" />;
    if (taken === false) return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    return null;
  };

  // Validation
  const isValid = (() => {
    if (!businessType) return false;
    if (businessType === 'none') return true;
    if (businessType === 'gstin') {
      return isGstValid(gstinValue) && gstinTaken === false && isPanValid(panValue) && panTaken === false;
    }
    if (businessType === 'udyam') return isUdyamValid(udyamValue) && udyamTaken === false;
    if (businessType === 'fssai') return isFssaiValid(fssaiValue) && fssaiTaken === false;
    if (businessType === 'trade_license') return isTradeLicenseValid(tradeLicenseValue) && tradeLicenseTaken === false;
    return false;
  })();

  const BUSINESS_TYPES = [
    { key: 'gstin' as BusinessType, label: 'GSTIN + PAN', desc: 'GST registered business' },
    { key: 'udyam' as BusinessType, label: 'Udyam (MSME)', desc: 'Micro/Small/Medium enterprise' },
    { key: 'fssai' as BusinessType, label: 'FSSAI', desc: 'Food license' },
    { key: 'trade_license' as BusinessType, label: 'Trade License', desc: 'Shop & establishment' },
    { key: 'none' as BusinessType, label: 'None / Unregistered', desc: 'No formal registration yet' },
  ];

  return (
    <div className="flex flex-col min-h-full px-6 pt-5">
      <div style={floatIn(0, visible)} className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
          <ShieldCheck className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Business verification
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Select your business registration type
          </p>
        </div>
      </div>

      {/* Type selector */}
      <div style={floatIn(150, visible)} className="grid grid-cols-2 gap-2 mb-6">
        {BUSINESS_TYPES.map((bt) => (
          <button
            key={bt.key}
            onClick={() => onChangeType(bt.key)}
            className={`p-3 rounded-xl border text-left transition-all active:scale-[0.97] ${
              businessType === bt.key
                ? 'bg-slate-500/10 border-slate-900 text-slate-700'
                : isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <p className="text-sm font-semibold">{bt.label}</p>
            <p className={`text-xs mt-0.5 ${businessType === bt.key ? 'text-slate-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{bt.desc}</p>
          </button>
        ))}
      </div>

      {/* Conditional fields */}
      <div style={floatIn(300, visible)} className="space-y-4 pb-4">
        {businessType === 'gstin' && (
          <>
            <div>
              <label className={labelClass}>GSTIN Number</label>
              <div className="relative">
                <input value={gstinValue} onChange={(e) => handleGstinChange(e.target.value)} placeholder="27AAAPA1234A1Z5" className={inputClass} maxLength={15} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <StatusIcon taken={gstinTaken} checking={checking === 'gstin'} fieldName="gstin" />
                </div>
              </div>
              {gstinValue && !isGstValid(gstinValue) && <p className="text-xs text-red-500 mt-1">Invalid GSTIN format</p>}
              {gstinTaken === true && <p className="text-xs text-red-500 mt-1">This GSTIN is already registered</p>}
            </div>
            <div>
              <label className={labelClass}>PAN Number</label>
              <div className="relative">
                <input value={panValue} onChange={(e) => handlePanChange(e.target.value)} placeholder="AFZPK7190K" className={inputClass} maxLength={10} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <StatusIcon taken={panTaken} checking={checking === 'pan'} fieldName="pan" />
                </div>
              </div>
              {panValue && !isPanValid(panValue) && <p className="text-xs text-red-500 mt-1">Invalid PAN format (allowed: C, F, P, B types)</p>}
              {panTaken === true && <p className="text-xs text-red-500 mt-1">This PAN is already registered</p>}
            </div>
          </>
        )}

        {businessType === 'udyam' && (
          <div>
            <label className={labelClass}>Udyam Registration Number</label>
            <div className="relative">
              <input value={udyamValue} onChange={(e) => handleUdyamChange(e.target.value)} placeholder="UDYAM-KA-01-0000001" className={inputClass} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <StatusIcon taken={udyamTaken} checking={checking === 'udyam_no'} fieldName="udyam" />
              </div>
            </div>
            {udyamValue && !isUdyamValid(udyamValue) && <p className="text-xs text-red-500 mt-1">Format: UDYAM-XX-00-0000000</p>}
            {udyamTaken === true && <p className="text-xs text-red-500 mt-1">This Udyam number is already registered</p>}
          </div>
        )}

        {businessType === 'fssai' && (
          <div>
            <label className={labelClass}>FSSAI License Number</label>
            <div className="relative">
              <input value={fssaiValue} onChange={(e) => handleFssaiChange(e.target.value)} placeholder="14-digit license number" inputMode="numeric" className={inputClass} maxLength={14} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <StatusIcon taken={fssaiTaken} checking={checking === 'fssai_no'} fieldName="fssai" />
              </div>
            </div>
            {fssaiValue && !isFssaiValid(fssaiValue) && <p className="text-xs text-red-500 mt-1">Must be exactly 14 digits</p>}
            {fssaiTaken === true && <p className="text-xs text-red-500 mt-1">This FSSAI number is already registered</p>}
          </div>
        )}

        {businessType === 'trade_license' && (
          <div>
            <label className={labelClass}>Trade License Number</label>
            <div className="relative">
              <input value={tradeLicenseValue} onChange={(e) => handleTradeLicenseChange(e.target.value)} placeholder="KA/2024/123456" className={inputClass} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <StatusIcon taken={tradeLicenseTaken} checking={checking === 'trade_license_no'} fieldName="trade_license" />
              </div>
            </div>
            {tradeLicenseValue && !isTradeLicenseValid(tradeLicenseValue) && <p className="text-xs text-red-500 mt-1">Format: XX/YYYY/NNNNNN</p>}
            {tradeLicenseTaken === true && <p className="text-xs text-red-500 mt-1">This trade license is already registered</p>}
          </div>
        )}
      </div>

      <div style={floatIn(400, visible)} className="mt-auto pb-8 pt-4 flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Back
          </button>
        )}
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
