
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

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-reveal">
      <div className="w-full max-w-xs glass rounded-[2rem] p-5 border border-yellow-500/20 bg-slate-900/95 shadow-2xl">
        {/* Icon + close */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center border border-yellow-500/20">
            <Bell className="w-5 h-5 text-yellow-500" />
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center active:scale-90 transition-transform"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Title */}
        <h2 className="text-base font-black uppercase tracking-tight text-white leading-tight mb-1.5">
          Don't Miss a Deal! 🔔
        </h2>

        {/* Body */}
        <p className="text-xs text-slate-400 leading-relaxed mb-4">
          Get real-time alerts when shops in your locality post new offers. Most deals are limited-time only!
        </p>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 active:scale-95 transition-transform"
          >
            Later
          </button>
          <button
            onClick={onAllow}
            className="flex-1 btn-premium rounded-xl text-[10px] font-black uppercase tracking-widest text-black py-1.5"
          >
            Notify Me
          </button>
        </div>
      </div>
    </div>
  );
};
