

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCanvasProps {
  value: string | object;
  theme?: 'light' | 'dark'; // Added theme prop
}

export const QRCanvas: React.FC<QRCanvasProps> = ({ value, theme = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = theme === 'dark';

  // Convert payload to string if it's an object
  const dataString = typeof value === 'object' ? JSON.stringify(value) : String(value);

  useEffect(() => {
    if (canvasRef.current && dataString) {
      QRCode.toCanvas(
        canvasRef.current,
        dataString,
        {
          width: 200, // Balanced size for the p-6 glass container
          margin: 1,
          color: {
            dark: isDark ? '#ffffff' : '#0f172a', // White QR in dark mode, Dark QR in light mode
            light: isDark ? '#0f172a' : '#ffffff', // Dark background in dark mode, White background in light mode
          },
          errorCorrectionLevel: 'M'
        },
        (error) => {
          if (error) console.error('QR Generation Protocol Failed:', error);
        }
      );
    }
  }, [dataString, isDark]); // Added isDark to dependencies

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="relative group p-4">
        {/* Animated outer frame */}
        <div className="absolute inset-0 border-2 border-blue-500/20 rounded-[2.5rem] animate-pulse"></div>
        
        <div className={`relative p-6 ${isDark ? 'bg-white' : 'bg-slate-950'} rounded-[2rem] shadow-2xl flex flex-col items-center overflow-hidden`}> {/* Dynamic background */}
          <canvas 
            ref={canvasRef} 
            className="max-w-full h-auto block" 
          />
          
          <div className={`mt-4 px-4 py-2 ${isDark ? 'bg-slate-950' : 'bg-white/90'} rounded-xl`}>
             <span className={`text-[8px] font-black tracking-[0.3em] ${isDark ? 'text-blue-500' : 'text-blue-700'} uppercase`}>ENCRYPTED DATA NODE</span>
          </div>
        </div>
      </div>
      <div className="text-center">
         <p className="text-[10px] text-slate-500 font-medium uppercase tracking-[0.2em]">Scan at merchant node</p>
      </div>
    </div>
  );
};