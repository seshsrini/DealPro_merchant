

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Loader2,
  CheckCircle2,
  X,
  ShieldAlert
} from 'lucide-react';
import { addCampaignService } from './services/addCampaignService'; // For verifying claims
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

interface QRscanProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  theme: 'light' | 'dark';
}

export const QRscan: React.FC<QRscanProps> = ({ isOpen, onClose, user, theme }) => {
  const [isHardwareActive, setIsHardwareActive] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'unauthorized' | 'invalid' | 'ambiguous' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const platform = (window as any).Capacitor?.getPlatform() || 'web';

  // INITIALIZE GOOGLE MODULE (ANDROID)
  useEffect(() => {
    if (platform === 'android' && isOpen) {
      BarcodeScanner.installGoogleBarcodeScannerModule().catch(console.error);
    }
  }, [platform, isOpen]);

  // HANDLE UI TRANSPARENCY WHEN SCANNING
  // Note: For native scanning, the WebView background must be transparent.
  useEffect(() => {
    if (isHardwareActive) {
      document.body.classList.add('barcode-scanner-active');
    } else {
      document.body.classList.remove('barcode-scanner-active');
    }
    return () => document.body.classList.remove('barcode-scanner-active');
  }, [isHardwareActive]);

  const startHardwareScan = async () => {
    console.log('[QRscan] Starting hardware scan, platform:', platform);

    if (platform === 'web') {
      alert("Hardware scanning is only available on native builds. Optical sensors are simulated via manual input in the browser environment.");
      return;
    }

    try {
      console.log('[QRscan] Checking camera permissions...');
      const status = await BarcodeScanner.checkPermissions();
      console.log('[QRscan] Permission status:', status);
      let cameraStatus = status.camera;

      if (cameraStatus === 'prompt' || cameraStatus === 'prompt-with-rationale') {
        console.log('[QRscan] Requesting camera permissions...');
        const request = await BarcodeScanner.requestPermissions();
        console.log('[QRscan] Permission request result:', request);
        cameraStatus = request.camera;
      }

      if (cameraStatus === 'denied') {
        console.warn('[QRscan] Camera permission denied');
        const confirmSettings = confirm("Camera access is blocked. Authorize sensor in device settings?");
        if (confirmSettings) {
          await BarcodeScanner.openSettings();
        }
        return;
      }

      if (cameraStatus === 'granted') {
        console.log('[QRscan] Camera permission granted, initializing scanner...');
        setIsHardwareActive(true);

        console.log('[QRscan] Hiding background...');
        await BarcodeScanner.hideBackground();
        console.log('[QRscan] Background hidden, starting scan...');

        const { barcodes } = await BarcodeScanner.scan({
          formats: [BarcodeFormat.QrCode],
        });
        console.log('[QRscan] Scan completed, barcodes found:', barcodes.length);

        console.log('[QRscan] Showing background...');
        setIsHardwareActive(false);
        await BarcodeScanner.showBackground();
        console.log('[QRscan] Background shown');

        if (barcodes.length > 0) {
          const value = barcodes[0].displayValue;
          console.log('[QRscan] Processing scanned value:', value);
          handleProcessScan(value);
        } else {
          console.log('[QRscan] No barcodes detected');
        }
      } else {
        console.error('[QRscan] Unexpected camera status:', cameraStatus);
      }
    } catch (e: any) {
      console.error('[QRscan] Hardware Scan Failed:', {
        error: e,
        message: e?.message,
        code: e?.code,
        stack: e?.stack
      });
      setIsHardwareActive(false);

      // Attempt to recover UI state
      try {
        console.log('[QRscan] Attempting to restore background...');
        await BarcodeScanner.showBackground();
        console.log('[QRscan] Background restored');
      } catch (recoveryError) {
        console.error('[QRscan] Failed to restore background:', recoveryError);
      }

      document.body.classList.remove('barcode-scanner-active');
      alert(`Optical sensor uplink failed: ${e?.message || 'Unknown error'}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();

    // Enforce format: First must be Alphabet, rest must be Digits
    if (val.length > 0) {
      const firstChar = val.charAt(0);
      if (!/[A-Z]/.test(firstChar)) {
        // If first char isn't a letter, ignore the change
        return;
      }

      if (val.length > 1) {
        const rest = val.slice(1);
        // Only keep numbers in the rest of the string
        const numbersOnly = rest.replace(/\D/g, '');
        val = firstChar + numbersOnly;
      }
    }

    // Max length 7 (1 Alphabet + 6 Digits)
    setScanInput(val.slice(0, 7));
  };

  const handleProcessScan = async (valueToProcess?: string) => {
    const input = (valueToProcess || scanInput).trim();
    if (!input) return;

    setIsProcessingScan(true);
    setScanResult(null);
    setErrorMessage('');

    try {
      let dataToVerify: any = input;

      // Enhanced JSON validation to prevent injection attacks
      if (input.startsWith('{')) {
        try {
          const payload = JSON.parse(input);

          // Validate payload structure - only allow expected properties
          const allowedKeys = ['campaign_id', 'merchant_id', 'user_id', 'timestamp'];
          const payloadKeys = Object.keys(payload);

          // Check for unexpected properties (potential injection)
          const hasUnexpectedKeys = payloadKeys.some(key => !allowedKeys.includes(key));
          if (hasUnexpectedKeys) {
            console.warn('[QRscan] Suspicious payload with unexpected keys:', payloadKeys);
            setScanResult('invalid');
            setErrorMessage("Invalid voucher format detected.");
            setIsProcessingScan(false);
            return;
          }

          // Validate data types
          if (payload.campaign_id && typeof payload.campaign_id !== 'string') {
            throw new Error('Invalid campaign_id type');
          }
          if (payload.merchant_id && typeof payload.merchant_id !== 'string') {
            throw new Error('Invalid merchant_id type');
          }

          // Check merchant authorization
          if (payload.campaign_id && payload.merchant_id) {
            if (payload.merchant_id !== user.id) {
              setScanResult('unauthorized');
              setErrorMessage("Voucher originates from a different merchant node.");
              setIsProcessingScan(false);
              return;
            }
          }
          dataToVerify = payload;
        } catch (e) {
          console.error('[QRscan] JSON parsing failed:', e);
          // If JSON parsing fails, treat as plain text input
          dataToVerify = input;
        }
      }

      // Fix: response now guaranteed to have error property if success is false
      const response = await addCampaignService.verifyClaimScan(dataToVerify, user.id);

      if (response.success) {
        setScanResult('success');
        setTimeout(() => {
          onClose();
          setScanResult(null);
          setScanInput('');
        }, 2000);
      } else {
        setScanResult(response.error === 'UNAUTHORIZED' ? 'unauthorized' : 'invalid');
        setErrorMessage(response.message || 'Verification Failed');
      }
    } catch (e) {
      setScanResult('error');
      setErrorMessage('Grid protocol error.');
    } finally {
      setIsProcessingScan(false);
    }
  };

  if (!isOpen) return null;

  return (
    // Outer container: fixed, takes full screen, no centering flexbox here
    <div className="fixed inset-0 z-[500] p-6">
       {/* Backdrop */}
       <div
         className={`absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-500 ${isHardwareActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
         onClick={() => !isProcessingScan && !isHardwareActive && onClose()}
       ></div>

       {/* Modal Popup Card: positioned absolutely within fixed parent, centered with transform */}
       <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm glass rounded-[3.5rem] border transition-all duration-500 flex flex-col shadow-[0_40px_100px_rgba(0,0,0,0.8)] ring-1 ring-white/10 ${
         isHardwareActive
           ? 'bg-transparent border-transparent h-full max-w-none rounded-none inset-0 translate-x-0 translate-y-0' // Full-screen for hardware scan
           : 'bg-slate-900/95 border-white/10 p-8'
       }`}>

          {/* Condensed Header */}
          <div className="flex justify-between items-center mb-8 shrink-0 scanner-ui-overlay">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Camera className="w-4 h-4 text-blue-500" />
               </div>
               <h3 className="text-base font-black uppercase tracking-tighter text-white leading-tight">DealPro Discount Verify</h3>
             </div>
             <button
               onClick={() => {
                 if (isHardwareActive) {
                   BarcodeScanner.showBackground();
                   setIsHardwareActive(false);
                 }
                 onClose();
               }}
               className="w-10 h-10 glass rounded-full flex items-center justify-center border-white/10 active:scale-90 transition-transform"
             >
               <X className="w-5 h-5 text-white" />
             </button>
          </div>

          {/* Main Interaction Hub */}
          <div className="flex-1 flex flex-col items-center justify-center scanner-ui-overlay">
             {scanResult === 'success' ? (
               <div className="text-center animate-reveal py-10">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_50px_rgba(16,185,129,0.3)] border border-emerald-500/30">
                     <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <p className="text-white font-black uppercase tracking-[0.3em] text-sm">Protocol Verified</p>
                  <p className="text-emerald-500/60 font-bold uppercase tracking-widest text-[9px] mt-2">Voucher successfully applied</p>
               </div>
             ) : scanResult === 'unauthorized' ? (
               <div className="text-center animate-reveal space-y-6 py-8">
                  <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto border border-rose-500/30">
                     <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
                  </div>
                  <div>
                     <h4 className="text-rose-500 font-black uppercase tracking-widest text-xs mb-2">Unauthorized Source</h4>
                     <p className="text-slate-400 text-[10px] leading-relaxed px-4">{errorMessage}</p>
                  </div>
                  <button
                    onClick={() => {setScanResult(null); setScanInput('');}}
                    className="w-full h-14 glass rounded-2xl border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest active:scale-95"
                  >
                    Reset Link
                  </button>
               </div>
             ) : (
               <div className="w-full flex flex-col items-center gap-8">
                 {/* Viewfinder Target */}
                 <div className={`relative w-full aspect-square max-w-[240px] shrink-0 transition-opacity duration-300 ${isHardwareActive ? 'opacity-100' : 'opacity-100'}`}>
                   <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl"></div>
                   <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl"></div>
                   <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl"></div>
                   <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-blue-500 rounded-br-3xl"></div>

                   <button
                     onClick={startHardwareScan}
                     disabled={isHardwareActive}
                     className={`w-full h-full rounded-3xl relative overflow-hidden flex flex-col items-center justify-center transition-all ${isHardwareActive ? 'bg-transparent' : 'bg-blue-500/5 group'}`}
                   >
                      {!isHardwareActive && (
                        <>
                          <div className="absolute inset-0 bg-blue-500/5 animate-pulse group-active:scale-95"></div>
                          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center mb-3">
                             <Camera className="w-8 h-8 text-blue-500" />
                          </div>
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Optical Sync</p>
                        </>
                      )}
                      {/* Scanning Animation Line */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,1)] animate-[scan_3s_infinite] z-20"></div>
                   </button>
                 </div>

                 {/* Manual Input Hub */}
                 {!isHardwareActive && (
                   <div className="w-full animate-reveal space-y-4">
                     <div className="flex items-center gap-2 px-2">
                       <div className="h-px flex-1 bg-white/10"></div>
                       <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-600">Manual Entry</p>
                       <div className="h-px flex-1 bg-white/10"></div>
                     </div>

                     <div className="space-y-4">
                       <div className="relative">
                         <input
                           value={scanInput}
                           onChange={handleInputChange}
                           placeholder="Ex: A465765"
                           maxLength={7}
                           className="input-premium text-center text-sm font-mono uppercase tracking-[0.2em] border-white/5 h-16 bg-white/[0.03] rounded-2xl focus:border-blue-500/50"
                         />
                       </div>

                       {(scanResult === 'invalid' || scanResult === 'ambiguous' || scanResult === 'error') && (
                         <p className="text-rose-500 text-[9px] font-black uppercase tracking-widest text-center animate-shake">{errorMessage}</p>
                       )}

                       <button
                         onClick={() => handleProcessScan()}
                         disabled={scanInput.length < 7 || isProcessingScan}
                         className="w-full btn-premium h-16 rounded-2xl shadow-2xl shadow-blue-500/10 text-[11px] uppercase tracking-[0.3em] active:scale-[0.98]"
                       >
                         {isProcessingScan ? <Loader2 className="animate-spin w-5 h-5" /> : "Authorize Discount"}
                       </button>
                     </div>
                   </div>
                 )}
               </div>
             )}
          </div>

          <div className="mt-8 text-center scanner-ui-overlay shrink-0">
             <p className="text-[7px] font-black text-slate-700 uppercase tracking-[0.6em]">Secure Ledger Instance: {user.id.slice(0, 10)}</p>
          </div>
       </div>

       <style>{`
         @keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
         .scanner-ui-overlay { position: relative; z-index: 10; }
       `}</style>
    </div>
  );
};