import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

const VIDEO_COUNT = 5;

interface DealsLoaderProps {
  theme?: 'light' | 'dark';
  label?: string;
}

// Inline loading animation shown while the merchant's deals are being fetched.
// Reuses the upload-loader videos that ship with the app (one is picked at
// random per mount); falls back to a spinner if the video can't play.
export const DealsLoader: React.FC<DealsLoaderProps> = ({ theme = 'dark', label }) => {
  const isDark = theme === 'dark';
  const [videoFailed, setVideoFailed] = useState(false);

  const videoNumber = useMemo(() => Math.floor(Math.random() * VIDEO_COUNT) + 1, []);
  const videoSrc = `/assets/videos/upload-loader-${videoNumber}.mp4`;

  return (
    <div className={`rounded-2xl p-6 flex flex-col items-center border ${
      isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
    }`}>
      <div className={`w-40 h-52 rounded-2xl overflow-hidden mb-4 flex items-center justify-center ${
        isDark ? 'bg-slate-800' : 'bg-slate-100'
      }`}>
        {videoFailed ? (
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
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
      <p className={`text-sm font-medium text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {label || 'Loading your deals…'}
      </p>
    </div>
  );
};
