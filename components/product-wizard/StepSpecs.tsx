import React, { useEffect, useState } from 'react';
import { ClipboardList, Loader2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { getSchemaForCategory, CategorySchema } from '../../data/formSchema';
import { addCampaignService } from '../../services/addCampaignService';

interface StepSpecsProps {
  schemaId: string;
  specs: Record<string, string>;
  onSpecChange: (key: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepSpecs: React.FC<StepSpecsProps> = ({
  schemaId, specs, onSpecChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  const schema: CategorySchema = getSchemaForCategory(schemaId);
  const fields = schema.fields.filter(f => f.key !== 'brand'); // brand is handled in name step
  const hasNoFields = fields.length === 0;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auto-advance if no category-specific fields
  useEffect(() => {
    if (hasNoFields) onNext();
  }, [hasNoFields]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleContinue = async () => {
    // Profanity check on text specs
    const specsText = Object.values(specs).filter(Boolean).join(' ');
    if (!specsText.trim()) {
      onNext();
      return;
    }
    setChecking(true);
    setModerationError(null);
    try {
      const result = await addCampaignService.moderateContent('', '', specsText);
      if (result.flagged) {
        setModerationError(result.reason || 'Content contains inappropriate language. Please revise.');
        setChecking(false);
        return;
      }
      onNext();
    } catch {
      onNext();
    } finally {
      setChecking(false);
    }
  };

  const inputClass = `w-full h-11 px-4 rounded-xl text-sm font-medium outline-none transition-all border ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-500'
  }`;

  if (hasNoFields) return null;

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
        <ClipboardList className="w-8 h-8 text-emerald-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Product specifications
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Fill in {schema.label} details. All fields are optional.
      </p>

      <div style={floatIn(300, visible)} className="space-y-4 flex-1 overflow-y-auto pb-4">
        {fields.map(field => {
          const val = specs[field.key] ?? '';

          if (field.type === 'select') {
            const options = field.options ?? [];
            const supportsOther = options.includes('Other');
            // "Other" is active when the stored value is literally 'Other' (just
            // picked, nothing typed yet) OR a custom string the merchant typed —
            // which by definition isn't one of the preset options. Storing the typed
            // text in the SAME key keeps the data clean: the product ends up with
            // material="Titanium" rather than a separate "_other" companion field.
            const isOther = supportsOther && val !== '' && !options.filter(o => o !== 'Other').includes(val);
            return (
              <div key={field.key}>
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {field.label}
                </label>
                <select
                  value={isOther ? 'Other' : val}
                  onChange={e => onSpecChange(field.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Select --</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {isOther && (
                  <input
                    type="text"
                    value={val === 'Other' ? '' : val}
                    // Falling back to 'Other' when cleared keeps this box on screen
                    // instead of collapsing the select back to "-- Select --".
                    onChange={e => onSpecChange(field.key, e.target.value || 'Other')}
                    placeholder={`Enter ${field.label.toLowerCase()} (max 25 characters)`}
                    maxLength={25}
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>
            );
          }

          if (field.type === 'boolean') {
            return (
              <div key={field.key} className="flex items-center justify-between py-1">
                <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {field.label}
                </label>
                <button
                  onClick={() => onSpecChange(field.key, val === 'true' ? 'false' : 'true')}
                  className={`w-12 h-6 rounded-full transition-all ${val === 'true' ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${val === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          }

          if (field.type === 'textarea') {
            return (
              <div key={field.key}>
                <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {field.label}
                </label>
                <textarea
                  rows={3}
                  placeholder={field.placeholder}
                  value={val}
                  onChange={e => onSpecChange(field.key, e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl text-sm outline-none border resize-none ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            );
          }

          return (
            <div key={field.key}>
              <label className={`block text-xs font-semibold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {field.label}{field.unit ? ` (${field.unit})` : ''}
              </label>
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                placeholder={field.placeholder}
                value={val}
                onChange={e => onSpecChange(field.key, e.target.value)}
                className={inputClass}
              />
            </div>
          );
        })}

        {moderationError && (
          <div className={`p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{moderationError}</p>
          </div>
        )}
      </div>

      <div style={floatIn(400, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={checking}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
        </button>
      </div>
    </div>
  );
};
