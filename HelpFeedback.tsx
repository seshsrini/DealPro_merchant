import React, { useState } from 'react';
import { AppView, User } from './types';
import { Send, Loader2, CheckCircle2, MessageSquareText } from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';

interface HelpFeedbackProps {
  user: User;
  setView: (view: AppView) => void;
  theme?: 'dark' | 'light';
}

const SUBJECT_OPTIONS = [
  'Issue with deal redemption',
  'Cannot find deals in my area',
  'Problem with QR code scanning',
  'Favorite deals not saving',
  'Location/GPS not working',
  'Deal information is incorrect',
  'App performance issues',
  'Account/Profile issues',
  'Merchant store not responding',
  'Feedback about the app',
  'Feature request',
  'Other'
];

export const HelpFeedback: React.FC<HelpFeedbackProps> = ({ user, setView, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  const [formData, setFormData] = useState({
    name: user.username || '',
    email: user.email || '',
    subject: SUBJECT_OPTIONS[0],
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.message.trim()) {
      setErrorMessage('Please enter your message');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // TODO: Implement actual API call to submit feedback
      // For now, just simulate submission
      await new Promise(resolve => setTimeout(resolve, 1500));

      console.log('[HelpFeedback] Feedback submitted:', {
        user_id: user.id,
        ...formData
      });

      setShowSuccess(true);
      setFormData(prev => ({ ...prev, message: '' })); // Clear message

      // Hide success message and go back after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setView('profile');
      }, 3000);
    } catch (err: any) {
      console.error('[HelpFeedback] Submission error:', err);
      setErrorMessage('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal">
      {/* Header */}
      <div className="mb-6">
        <h2 className={`text-3xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Help &<br />
          <span className="text-emerald-500">Support</span>
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">We're here to help</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            readOnly
            className={`w-full h-12 px-4 glass rounded-2xl ${isDark ? 'text-slate-400 bg-white/5' : 'text-slate-600 bg-slate-100'} text-sm font-medium outline-none border ${isDark ? 'border-white/5' : 'border-slate-200'} cursor-not-allowed`}
          />
        </div>

        {/* Email Field */}
        <div>
          <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            readOnly
            className={`w-full h-12 px-4 glass rounded-2xl ${isDark ? 'text-slate-400 bg-white/5' : 'text-slate-600 bg-slate-100'} text-sm font-medium outline-none border ${isDark ? 'border-white/5' : 'border-slate-200'} cursor-not-allowed`}
          />
        </div>

        {/* Subject Dropdown */}
        <div>
          <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Subject
          </label>
          <select
            value={formData.subject}
            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            className={`w-full h-12 px-4 glass rounded-2xl ${isDark ? 'text-white' : 'text-slate-900'} text-sm font-medium outline-none border ${isDark ? 'border-white/10 focus:border-emerald-500/50' : 'border-slate-300 focus:border-emerald-500'} transition-all`}
          >
            {SUBJECT_OPTIONS.map((option) => (
              <option key={option} value={option} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Message Field */}
        <div>
          <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Message
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            placeholder="Please describe your issue or feedback in detail..."
            rows={4}
            className={`w-full px-4 py-3 glass rounded-2xl ${isDark ? 'text-white' : 'text-slate-900'} text-sm font-medium outline-none border ${isDark ? 'border-white/10 focus:border-emerald-500/50' : 'border-slate-300 focus:border-emerald-500'} transition-all resize-none`}
            required
          />
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-xs font-bold text-red-400">{errorMessage}</p>
          </div>
        )}

        {/* Success Message */}
        {showSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 animate-reveal">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <p className="text-xs font-bold text-emerald-400">
              Thank you! Your feedback has been submitted successfully.
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || showSuccess}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>Submit Feedback</span>
            </>
          )}
        </button>
      </form>

      {/* Help Info Section */}
      <div className={`mt-6 p-4 glass rounded-2xl border ${isDark ? 'border-white/10' : 'border-slate-300'}`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <MessageSquareText className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className={`font-black text-xs uppercase tracking-wide mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Need Quick Help?
            </h3>
            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              We typically respond within 24 hours. For urgent issues, please include as much detail as possible in your message.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
