
import React from 'react';
import { Bell, X } from 'lucide-react';

interface PushNotificationPromptModalProps {
  isOpen: boolean;
  theme: 'light' | 'dark';
  onAllow: () => void;
  onDismiss: () => void;
}

export const PushNotificationPromptModal: React.FC<PushNotificationPromptModalProps> = ({
  isOpen,
  theme,
  onAllow,
  onDismiss,
}) => {
  if (!isOpen) return null;
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-6">
      <div className={`w-full max-w-xs rounded-2xl p-5 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
        {/* Icon + close */}
        <div className="flex items-center justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
            <Bell className="w-5 h-5 text-amber-500" />
          </div>
          <button
            onClick={onDismiss}
            className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}
          >
            <X className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </button>
        </div>

        {/* Title */}
        <h2 className={`text-sm font-semibold leading-tight mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Don't Miss a Deal!
        </h2>

        {/* Body */}
        <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Get real-time alerts when shops in your locality post new offers. Most deals are limited-time only!
        </p>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className={`flex-1 h-10 rounded-xl text-xs font-medium active:scale-[0.98] transition-all ${
              isDark ? 'text-slate-400 bg-slate-700' : 'text-slate-600 bg-slate-100'
            }`}
          >
            Later
          </button>
          <button
            onClick={onAllow}
            className="flex-1 h-10 rounded-xl bg-slate-900 text-white text-xs font-medium active:scale-[0.98] transition-all"
          >
            Notify Me
          </button>
        </div>
      </div>
    </div>
  );
};
