import React, { useState } from 'react';
import { ShieldAlert, Loader2, LogOut } from 'lucide-react';
import { User } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { StepBusinessVerification } from './merchant-onboarding/StepBusinessVerification';
import { merchantOnboardingService } from '../services/merchantOnboardingService';
import { encryptionService, auditLogger } from '../services/encryptionService';

type DocType = '' | 'gstin' | 'udyam' | 'fssai' | 'trade_license';

interface BusinessRegistrationRequiredProps {
  user: User;
  setUser: (u: User) => void;
  /** Called once the registration is saved — the app gate then routes onward. */
  onDone: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
}

/**
 * Shown to an onboarded merchant who has no business registration on file (they
 * signed up when "None / Unregistered" was still offered). Not skippable: the
 * app gate keeps them here, and the server refuses deals, until they add GSTIN,
 * Udyam, FSSAI or a Trade Licence. Reuses the signup Verification step, so the
 * same format, duplicate and GST-registry checks apply.
 */
export const BusinessRegistrationRequired: React.FC<BusinessRegistrationRequiredProps> = ({ user, setUser, onDone, onLogout, theme }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [businessType, setBusinessType] = useState<DocType>('');
  const [fields, setFields] = useState({ gstinValue: '', panValue: '', udyamValue: '', fssaiValue: '', tradeLicenseValue: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!businessType || saving) return;
    setSaving(true);
    setError(null);
    try {
      let gstin: string | null = null;
      let pan: string | null = null;
      if (businessType === 'gstin') {
        const g = encryptionService.encryptGST(fields.gstinValue);
        const p = encryptionService.encryptPAN(fields.panValue);
        if (!g.isValid) throw new Error(g.error || 'Invalid GSTIN');
        if (!p.isValid) throw new Error(p.error || 'Invalid PAN');
        gstin = g.encrypted;
        pan = p.encrypted;
        auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_ONBOARDING', 'GST');
        auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_ONBOARDING', 'PAN');
      }
      const saved = await merchantOnboardingService.setBusinessDocument({
        businessType,
        gstin,
        pan,
        udyamNo: businessType === 'udyam' ? fields.udyamValue.toUpperCase() : null,
        fssaiNo: businessType === 'fssai' ? fields.fssaiValue : null,
        tradeLicenseNo: businessType === 'trade_license' ? fields.tradeLicenseValue.toUpperCase() : null,
      });
      setUser({
        ...user,
        business_type: saved.business_type,
        gstin: saved.gstin ?? null,
        pan: saved.pan ?? null,
        udyam_no: saved.udyam_no ?? null,
        fssai_no: saved.fssai_no ?? null,
        trade_license_no: saved.trade_license_no ?? null,
      } as User);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('m_bizreg_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`min-h-full flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`mx-6 mt-5 p-4 rounded-xl border flex gap-3 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
        <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? 'text-amber-300' : 'text-amber-700'}`} />
        <div>
          <p className={`text-sm font-semibold ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>{t('m_bizreg_title')}</p>
          <p className={`text-xs leading-snug mt-1 ${isDark ? 'text-amber-200/80' : 'text-amber-800'}`}>{t('m_bizreg_desc')}</p>
        </div>
      </div>

      <div className="flex-1 relative">
        <StepBusinessVerification
          businessType={businessType}
          legalName={(user as any).legal_name || user.store_name || ''}
          gstinValue={fields.gstinValue}
          panValue={fields.panValue}
          udyamValue={fields.udyamValue}
          fssaiValue={fields.fssaiValue}
          tradeLicenseValue={fields.tradeLicenseValue}
          onChangeType={(v) => { setBusinessType(v as DocType); setError(null); }}
          onChangeField={(field, value) => setFields((f) => ({ ...f, [field]: value }))}
          onNext={save}
          theme={theme}
        />
        {saving && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 ${isDark ? 'bg-slate-950/80' : 'bg-slate-50/80'}`}>
            <Loader2 className="w-8 h-8 animate-spin text-slate-700" />
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('m_bizreg_saving')}</p>
          </div>
        )}
      </div>

      {error && <p className="mx-6 mb-2 text-xs text-red-500 text-center">{error}</p>}
      <button
        type="button"
        onClick={onLogout}
        className={`mx-auto mb-8 mt-2 flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
      >
        <LogOut className="w-3.5 h-3.5" />
        {t('m_bizreg_logout')}
      </button>
    </div>
  );
};
