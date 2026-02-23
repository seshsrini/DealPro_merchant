

import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCanvasProps {
  value: string | object;
  theme?: 'light' | 'dark';
}

export const QRCanvas: React.FC<QRCanvasProps> = ({ value, theme = 'dark' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = theme === 'dark';

  const dataString = typeof value === 'object' ? JSON.stringify(value) : String(value);

  useEffect(() => {
    if (canvasRef.current && dataString) {
      QRCode.toCanvas(
        canvasRef.current,
        dataString,
        {
          width: 200,
          margin: 1,
          color: {
            dark: isDark ? '#ffffff' : '#0f172a',
            light: isDark ? '#0f172a' : '#ffffff',
          },
          errorCorrectionLevel: 'M'
        },
        (error) => {
          if (error) console.error('QR Generation Failed:', error);
        }
      );
    }
  }, [dataString, isDark]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className={`p-4 ${isDark ? 'bg-white' : 'bg-slate-950'} rounded-xl flex flex-col items-center`}>
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto block"
        />
        <div className={`mt-3 px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-950' : 'bg-white/90'}`}>
           <span className={`text-[9px] font-medium ${isDark ? 'text-blue-500' : 'text-blue-700'}`}>Encrypted Data</span>
        </div>
      </div>
      <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Scan at merchant location</p>
    </div>
  );
};
