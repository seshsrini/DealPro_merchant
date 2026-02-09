import React from 'react';
import { Locale, AppView } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { Languages, Sparkles, ArrowRight } from 'lucide-react';

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
}

export const LanguageSelection: React.FC<LanguageSelectionProps> = ({ setView }) => {
  const { locale, setLocale, t } = useTranslation();

  const handleSelect = (id: Locale) => {
    setLocale(id);
  };

  const handleProceed = () => {
    setView('login');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center p-8 animate-reveal overflow-hidden">
      {/* Background Decorative Element */}
      <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[50%] rounded-full blur-[120px] opacity-10 bg-gradient-to-br from-blue-600 to-indigo-600"></div>

      <div className="w-full max-w-sm glass p-8 rounded-[3.5rem] border-white/10 relative overflow-hidden shadow-2xl flex flex-col items-center min-h-[600px]">
        <div className="w-16 h-16 rounded-[1.25rem] bg-blue-500/10 flex items-center justify-center mb-8 border border-blue-500/20">
          <Languages className="w-8 h-8 text-blue-500" />
        </div>
        
        <h2 className="text-2xl font-black uppercase tracking-tighter text-white text-center leading-none mb-2">
          {t('lang_select_title')}
        </h2>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-12 leading-relaxed px-4">
          {t('lang_select_sub')}
        </p>

        <div className="grid grid-cols-3 gap-3 w-full mb-auto">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => handleSelect(lang.id)}
              className={`group flex flex-col items-center justify-center h-16 rounded-2xl border transition-all duration-300 active:scale-95 ${
                locale === lang.id 
                  ? 'bg-blue-600/30 border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.25)]' 
                  : 'glass border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <span className={`text-[11px] font-black uppercase tracking-tight transition-colors duration-300 ${
                locale === lang.id 
                  ? 'text-white' 
                  : 'text-slate-200 group-hover:text-white'
              }`}>
                {lang.native}
              </span>
            </button>
          ))}
        </div>

        {/* Minimalist Professional Navigation Arrow - Non-button appearance */}
        <div className="w-full flex justify-end pt-8 pr-2">
          <button 
            onClick={handleProceed}
            className="flex items-center gap-3 text-blue-500 hover:text-blue-400 active:scale-90 transition-all group"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Proceed</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-2 opacity-30">
        <Sparkles className="w-3 h-3 text-blue-500" />
        <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-500">Multilingual Hub v2.5</p>
      </div>
    </div>
  );
};