import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const VIDEO_COUNT = 5;

interface UploadVideoLoaderProps {
  /** Current phase number (1-based). */
  step: number;
  /** Total number of phases (used to compute the progress bar fill). */
  totalSteps: number;
  /** Localized label for the current phase, e.g. "Uploading media...". */
  label: string;
  theme: 'light' | 'dark';
}

// Replaces the traditional spinner shown while a deal is publishing with a
// short looping video as a "good distraction" while the upload + banner bake
// + create-campaign roundtrip completes. The same video plays through the
// entire publish flow for one merchant — picked once on mount so it doesn't
// flicker between phases. Five variants ship with the app and are randomized
// per session.
//
// The video files live at /assets/videos/upload-loader-{1..5}.mp4 — Vite's
// public/ folder serves them at build time and Capacitor copies them into the
// native assets at sync time, so playback is local with no network roundtrip.
export const UploadVideoLoader: React.FC<UploadVideoLoaderProps> = ({
  step, totalSteps, label, theme,
}) => {
  const isDark = theme === 'dark';
  const [videoFailed, setVideoFailed] = useState(false);

  // Pick once per mount — same video plays through the whole publish flow.
  const videoNumber = useMemo(() => Math.floor(Math.random() * VIDEO_COUNT) + 1, []);
  const videoSrc = `/assets/videos/upload-loader-${videoNumber}.mp4`;

  const pct = Math.min(100, Math.max(0, (step / Math.max(1, totalSteps)) * 100));

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center px-8">
      <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="flex flex-col items-center">
          {/* Video — fixed-aspect portrait box, centered. */}
          <div className={`w-44 h-72 rounded-2xl overflow-hidden mb-4 flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            {videoFailed ? (
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            ) : (
              <video
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                onError={() => setVideoFailed(true)}
              />
            )}
          </div>

          {/* Progress bar — sits directly under the video. */}
          <div className={`w-full h-2 rounded-full overflow-hidden mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Step label — what's happening right now. */}
          <p className={`text-sm font-medium text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {label}
          </p>
          <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Step {step} of {totalSteps}
          </p>
        </div>
      </div>
    </div>
  );
};
