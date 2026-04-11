import React, { useState } from 'react';
import { AppView, User } from './types';
import { Send, Loader2, CheckCircle2, MessageSquareText } from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';

interface HelpFeedbackProps {
  user: User;
  setView: (view: AppView) => void;
  theme?: 'dark' | 'light';
}

const SUBJECT_KEYS = [
  'm_subj_redemption',
  'm_subj_no_deals',
  'm_subj_qr',
  'm_subj_favorites',
  'm_subj_gps',
  'm_subj_incorrect',
  'm_subj_performance',
  'm_subj_account',
  'm_subj_store',
  'm_subj_feedback',
  'm_subj_feature',
  'm_subj_other'
];

export const HelpFeedback: React.FC<HelpFeedbackProps> = ({ user, setView, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  const subjectOptions = SUBJECT_KEYS.map(key => ({ key, label: t(key) }));

  const [formData, setFormData] = useState({
    name: (user as any).full_name || (user as any).store_name || user.username || '',
    email: (user as any).email || '',
    subject: SUBJECT_KEYS[0],
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!formData.message.trim()) {
      setErrorMessage(t('m_enter_message'));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('[HelpFeedback] Feedback submitted:', {
        user_id: user.id,
        ...formData
      });

      setShowSuccess(true);
      setFormData(prev => ({ ...prev, message: '' }));

      setTimeout(() => {
        setShowSuccess(false);
        setView('profile');
      }, 3000);
    } catch (err: any) {
      console.error('[HelpFeedback] Submission error:', err);
      setErrorMessage(t('m_submit_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = `w-full h-12 px-4 rounded-lg text-sm font-normal outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
      : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
  }`;

  return (
    <div className="px-6 pt-6 pb-32">
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {t('m_help_support')}
        </h2>
        <p className={`text-sm font-medium mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('m_here_to_help')}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {t('m_name')}
          </label>
          <input
            type="text"
            value={formData.name}
            readOnly
            className={`${inputClass} opacity-60 cursor-not-allowed`}
          />
        </div>

        {/* Email Field — editable so replies can be sent */}
        <div>
          <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {t('m_email')}
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="your@email.com"
            className={inputClass}
          />
        </div>

        {/* Subject Dropdown */}
        <div>
          <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {t('m_subject')}
          </label>
          <select
            value={formData.subject}
            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            className={inputClass}
          >
            {subjectOptions.map((option) => (
              <option key={option.key} value={option.key} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Message Field */}
        <div>
          <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {t('m_message')}
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            placeholder={t('m_message_placeholder')}
            rows={4}
            className={`w-full px-4 py-3 rounded-lg text-sm font-normal outline-none transition-all resize-none ${
              isDark
                ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
                : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
            }`}
            required
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
            <p className="text-xs font-medium text-red-500">{errorMessage}</p>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className={`p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-xs font-medium text-emerald-500">
              {t('m_feedback_success')}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || showSuccess}
          className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t('m_sending')}</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{t('m_submit_feedback')}</span>
            </>
          )}
        </button>
      </form>

      {/* Help Info Section */}
      <div className={`mt-6 p-4 rounded-xl border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <MessageSquareText className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className={`font-semibold text-xs mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('m_quick_help')}
            </h3>
            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {t('m_quick_help_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
