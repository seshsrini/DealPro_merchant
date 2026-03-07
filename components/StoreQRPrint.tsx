import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { AppView } from '../types';

interface StoreQRPrintProps {
  user: any;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
}

export const StoreQRPrint: React.FC<StoreQRPrintProps> = ({ user, setView, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const referralCode = user.consumer_referral_code || '------';
  const storeName = user.store_name || user.full_name || 'DealPro Merchant';

  useEffect(() => {
    if (canvasRef.current && referralCode !== '------') {
      QRCode.toCanvas(
        canvasRef.current,
        referralCode,
        {
          width: 220,
          margin: 2,
          color: { dark: '#0f172a', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        },
        (error) => {
          if (error) console.error('QR Generation Failed:', error);
        }
      );
    }
  }, [referralCode]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DealPro QR - ${storeName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 210mm;
            height: 297mm;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #fff;
          }
          body {
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .card {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
            padding: 30px 40px 40px;
            text-align: center;
            border: 4px solid #e2e8f0;
          }
          .logo-wrap {
            background: #fff;
            border-radius: 16px;
            padding: 12px 12px 0;
            margin-bottom: 24px;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
          }
          .logo { width: 160px; display: block; }
          .brand-text {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 1px;
            margin-top: -20px;
          }
          .brand-text .deal { color: #0f172a; }
          .brand-text .pro { color: #FACA1B; }
          .qr-wrap {
            background: #fff;
            border: 3px solid #e2e8f0;
            border-radius: 24px;
            padding: 16px;
            display: inline-block;
            margin-bottom: 24px;
          }
          .qr-wrap canvas { display: block; width: 130mm; height: 130mm; }
          .code {
            font-family: 'Courier New', monospace;
            font-size: 56px;
            font-weight: 900;
            letter-spacing: 12px;
            color: #0f172a;
            margin-bottom: 16px;
          }
          .store-name {
            font-size: 24px;
            font-weight: 700;
            color: #475569;
            margin-bottom: 20px;
          }
          .cta {
            font-size: 22px;
            color: #64748b;
            line-height: 1.6;
          }
          .cta strong { color: #0f172a; }
          .footer {
            margin-top: 40px;
            font-size: 14px;
            color: #94a3b8;
          }
          @media print {
            body { background: #fff; }
            .card { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo-wrap">
            <img src="${window.location.origin}/assets/logo.svg" class="logo" alt="DealPro" />
            <div class="brand-text"><span class="deal">Deal</span><span class="pro">Pro</span></div>
          </div>
          <div class="qr-wrap">
            <canvas id="print-qr"></canvas>
          </div>
          <div class="code">${referralCode}</div>
          <div class="store-name">${storeName}</div>
          <div class="cta">
            Scan this QR code to<br/>
            <strong>download DealPro app</strong><br/>
            and discover amazing local deals!
          </div>
          <div class="footer">www.dealpro.app</div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js"><\/script>
        <script>
          QRCode.toCanvas(
            document.getElementById('print-qr'),
            '${referralCode}',
            { width: 600, margin: 2, color: { dark: '#0f172a', light: '#ffffff' }, errorCorrectionLevel: 'H' },
            function() { setTimeout(function() { window.print(); }, 300); }
          );
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    // Create a composite canvas with logo, QR, and text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 400;
    const h = 520;
    canvas.width = w;
    canvas.height = h;

    // Solid white background (entire canvas, no transparency)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Rounded border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 20);
    ctx.stroke();

    // Logo — draw on white background (entire canvas is already white, so PNG transparency is fine)
    try {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';
      logo.src = '/assets/logo.png';
      await new Promise((resolve, reject) => {
        logo.onload = resolve;
        logo.onerror = reject;
      });
      const logoW = 120;
      const logoH = (logo.height / logo.width) * logoW;
      // Ensure white fill behind logo area
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((w - logoW) / 2 - 8, 16, logoW + 16, logoH + 16);
      ctx.drawImage(logo, (w - logoW) / 2, 24, logoW, logoH);
    } catch { /* logo load failed, skip */ }

    // QR code from existing canvas
    const qrSize = 220;
    const qrX = (w - qrSize) / 2;
    ctx.drawImage(canvasRef.current, qrX, 100, qrSize, qrSize);

    // Referral code
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 32px Courier New, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(referralCode, w / 2, 365);

    // Store name
    ctx.fillStyle = '#475569';
    ctx.font = '600 14px -apple-system, sans-serif';
    ctx.fillText(storeName, w / 2, 395);

    // CTA
    ctx.fillStyle = '#64748b';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText('Scan to download DealPro app', w / 2, 440);
    ctx.fillText('and discover amazing local deals!', w / 2, 460);

    // Download
    const link = document.createElement('a');
    link.download = `DealPro-QR-${referralCode}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className={`min-h-screen pb-32 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 pt-5 pb-4 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
        <button
          onClick={() => setView('profile')}
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
        >
          <ArrowLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-slate-900'}`} />
        </button>
        <h1 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Refer Consumers
        </h1>
      </div>

      <div className="px-5 mt-4 space-y-4">
        {/* Info text */}
        <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Print this QR code and display it at your store. When customers scan it and sign up on DealPro,
          they'll be linked to your store automatically.
        </p>

        {/* QR Card */}
        <div
          ref={printRef}
          className={`rounded-2xl border p-6 flex flex-col items-center ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Logo */}
          <div className="rounded-xl p-3 pb-0 mb-5 bg-white flex flex-col items-center" style={{ backgroundColor: '#ffffff' }}>
            <img
              src="/assets/logo.svg"
              alt="DealPro"
              className="w-24 h-auto"
              style={{ background: '#ffffff' }}
            />
            <p className="text-sm font-black" style={{ marginTop: '-14px' }}>
              <span className="text-slate-900">Deal</span>
              <span style={{ color: '#FACA1B' }}>Pro</span>
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 mb-4">
            <canvas ref={canvasRef} className="block" />
          </div>

          {/* Referral code displayed prominently */}
          <div className={`font-mono text-2xl font-extrabold tracking-[0.3em] mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {referralCode}
          </div>

          {/* Store name */}
          <p className={`text-xs font-semibold mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {storeName}
          </p>

          {/* CTA */}
          <p className={`text-[11px] text-center leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Scan this QR code to<br />
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>download DealPro app</span><br />
            and discover amazing local deals!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-blue-500 text-white text-sm font-semibold active:scale-[0.97] transition-all"
          >
            <Printer className="w-4 h-4" />
            Print QR
          </button>
          <button
            onClick={handleDownload}
            className={`flex items-center justify-center gap-2 h-12 rounded-xl text-sm font-semibold active:scale-[0.97] transition-all border ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-white'
                : 'bg-white border-slate-300 text-slate-900'
            }`}
          >
            <Download className="w-4 h-4" />
            Save Image
          </button>
        </div>

        {/* How it works */}
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-xs font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>How it works</h3>
          <div className="space-y-2.5">
            {[
              'Print and stick this QR code at your store entrance or billing counter',
              'Customers scan it with their phone camera',
              'They download the DealPro app and sign up',
              'You get credit for every consumer who joins through your QR code',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                  isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  {i + 1}
                </span>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
