import React from 'react';
import { Locale, AppView } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { Check, Globe } from 'lucide-react';

const LANGUAGES: { id: Locale; label: string; native: string }[] = [
  { id: 'en', label: 'English', native: 'English' },
  { id: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { id: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { id: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { id: 'te', label: 'Telugu', native: 'తెలుగు' },
  { id: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { id: 'bn', label: 'Bengali', native: 'বাংলা' },
  { id: 'mr', label: 'Marathi', native: 'मराठी' },
  { id: 'gu', label: 'Gujarati', native: 'ગુજરાતી' }
];

interface LanguageSelectionProps {
  setView: (view: AppView) => void;
  nextView: AppView;
}

export const LanguageSelection: React.FC<LanguageSelectionProps> = ({ setView, nextView }) => {
  const { locale, setLocale } = useTranslation();

  const handleSelect = (id: Locale) => {
    setLocale(id);
  };

  const handleContinue = () => {
    try { localStorage.setItem('hasCompletedLanguageSelection', 'true'); } catch (_) {}
    setView(nextView);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-5">
          <Globe className="w-6 h-6 text-slate-700" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">
          Choose your language
        </h2>
        <p className="text-sm text-slate-500">
          Select your preferred language for the app
        </p>
      </div>

      {/* Language Grid */}
      <div className="flex-1 px-6 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => handleSelect(lang.id)}
              className={`relative flex flex-col items-center justify-center h-20 rounded-xl border-2 transition-all active:scale-95 ${
                locale === lang.id
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
              }`}
            >
              {locale === lang.id && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                  <Check className="w-3 h-3 text-slate-900" />
                </div>
              )}
              <span className="text-base font-semibold">{lang.native}</span>
              {lang.id !== 'en' && (
                <span className={`text-[10px] mt-0.5 ${locale === lang.id ? 'text-slate-300' : 'text-slate-400'}`}>
                  {lang.label}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Continue Button */}
      <div className="shrink-0 px-6 py-6">
        <button
          onClick={handleContinue}
          className="w-full h-12 rounded-xl bg-slate-900 text-white font-semibold text-sm active:scale-[0.98] transition-all"
        >
          Continue
        </button>
      </div>
    </div>
  );
};
