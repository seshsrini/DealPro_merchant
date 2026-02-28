import React from 'react';
import { AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'dealpro_placeholder_tooltip_dismissed';

interface PlaceholderTooltipProps {
  visible: boolean;
  onDismiss: () => void;
  theme: 'light' | 'dark';
}

/** Returns true if user has permanently dismissed the placeholder tooltip */
export const isPlaceholderTooltipDismissed = (): boolean =>
  localStorage.getItem(STORAGE_KEY) === 'true';

export const PlaceholderTooltip: React.FC<PlaceholderTooltipProps> = ({ visible, onDismiss, theme }) => {
  const isDark = theme === 'dark';

  if (!visible) return null;

  const handleDontShowAgain = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onDismiss();
  };

  return (
    <div className="relative mb-3 animate-[fadeScaleIn_0.2s_ease-out]">
      {/* Tooltip card */}
      <div
        className={`rounded-xl px-4 py-3 shadow-lg ${
          isDark ? 'bg-slate-700 border border-slate-600' : 'bg-white border border-slate-200 shadow-slate-200/60'
        }`}
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-2 mb-1.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Replace placeholder
          </h3>
        </div>

        {/* Message */}
        <p className={`text-xs leading-relaxed mb-2.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          Replace the <span className={`font-semibold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>&lt;...&gt;</span> text with your own before continuing.
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            className={`flex-1 h-8 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
              isDark
                ? 'bg-amber-500 text-slate-900'
                : 'bg-amber-500 text-white'
            }`}
          >
            Ok
          </button>
          <button
            onClick={handleDontShowAgain}
            className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
              isDark
                ? 'text-slate-400 border border-slate-600'
                : 'text-slate-500 border border-slate-200'
            }`}
          >
            Don't show again
          </button>
        </div>
      </div>

      {/* Arrow pointing down to the input below */}
      <div className="flex justify-center">
        <div
          className={`w-3 h-3 rotate-45 -mt-1.5 ${
            isDark ? 'bg-slate-700 border-r border-b border-slate-600' : 'bg-white border-r border-b border-slate-200'
          }`}
        />
      </div>
    </div>
  );
};
