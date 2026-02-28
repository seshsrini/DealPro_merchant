

import React, { useState, useEffect } from 'react';
import {
  Camera,
  Loader2,
  CheckCircle2,
  X,
  ShieldAlert
} from 'lucide-react';
import { addCampaignService } from './services/addCampaignService';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

interface QRscanProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  theme: 'light' | 'dark';
}

export const QRscan: React.FC<QRscanProps> = ({ isOpen, onClose, user, theme }) => {
  const isDark = theme === 'dark';
  const [isScanning, setIsScanning] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'unauthorized' | 'invalid' | 'ambiguous' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [moduleReady, setModuleReady] = useState(false);

  const platform = (window as any).Capacitor?.getPlatform() || 'web';

  // Install Google Barcode Scanner module on Android (must complete before scan)
  useEffect(() => {
    if (platform === 'android' && isOpen) {
      BarcodeScanner.installGoogleBarcodeScannerModule()
        .then(() => {
          console.log('[QRscan] Google Barcode Scanner module installed');
          setModuleReady(true);
        })
        .catch((err) => {
          console.error('[QRscan] Failed to install scanner module:', err);
          setModuleReady(false);
        });
    } else if (platform === 'ios') {
      setModuleReady(true); // iOS doesn't need module install
    }
  }, [platform, isOpen]);

  const startHardwareScan = async () => {
    console.log('[QRscan] Starting hardware scan, platform:', platform);

    if (platform === 'web') {
      alert("Camera scanning is available on the mobile app. Please use manual entry here.");
      return;
    }

    try {
      // Check permissions
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
        const confirmSettings = confirm("Camera access is blocked. Open device settings to allow?");
        if (confirmSettings) {
          await BarcodeScanner.openSettings();
        }
        return;
      }

      if (cameraStatus === 'granted') {
        console.log('[QRscan] Camera permission granted, opening scanner...');
        setIsScanning(true);

        // scan() opens the native Google Code Scanner UI — no hideBackground needed
        const { barcodes } = await BarcodeScanner.scan({
          formats: [BarcodeFormat.QrCode],
        });
        console.log('[QRscan] Scan completed, barcodes found:', barcodes.length);

        setIsScanning(false);

        if (barcodes.length > 0) {
          const value = barcodes[0].displayValue;
          console.log('[QRscan] Processing scanned value:', value);
          handleProcessScan(value);
        } else {
          console.log('[QRscan] No barcodes detected');
        }
      } else {
        console.error('[QRscan] Unexpected camera status:', cameraStatus);
        alert('Camera access not available. Please check your app permissions in device settings.');
      }
    } catch (e: any) {
      console.error('[QRscan] Hardware Scan Failed:', e?.message, e?.code);
      setIsScanning(false);

      // User cancelled the scanner — not an error
      if (e?.message?.includes('canceled') || e?.message?.includes('cancelled')) {
        console.log('[QRscan] User cancelled scan');
        return;
      }

      alert('Unable to scan. Please make sure Google Play Services is up to date and try again.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();

    // Enforce format: First must be Alphabet, rest must be Digits
    if (val.length > 0) {
      const firstChar = val.charAt(0);
      if (!/[A-Z]/.test(firstChar)) {
        return;
      }

      if (val.length > 1) {
        const rest = val.slice(1);
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

          const allowedKeys = ['campaign_id', 'merchant_id', 'user_id', 'timestamp'];
          const payloadKeys = Object.keys(payload);

          const hasUnexpectedKeys = payloadKeys.some(key => !allowedKeys.includes(key));
          if (hasUnexpectedKeys) {
            console.warn('[QRscan] Suspicious payload with unexpected keys:', payloadKeys);
            setScanResult('invalid');
            setErrorMessage("Invalid voucher format.");
            setIsProcessingScan(false);
            return;
          }

          if (payload.campaign_id && typeof payload.campaign_id !== 'string') {
            throw new Error('Invalid campaign_id type');
          }
          if (payload.merchant_id && typeof payload.merchant_id !== 'string') {
            throw new Error('Invalid merchant_id type');
          }

          if (payload.campaign_id && payload.merchant_id) {
            if (payload.merchant_id !== user.id) {
              setScanResult('unauthorized');
              setErrorMessage("This voucher belongs to a different merchant.");
              setIsProcessingScan(false);
              return;
            }
          }
          dataToVerify = payload;
        } catch (e) {
          console.error('[QRscan] JSON parsing failed:', e);
          dataToVerify = input;
        }
      }

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
        setErrorMessage(response.message || 'Verification failed');
      }
    } catch (e) {
      setScanResult('error');
      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsProcessingScan(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !isProcessingScan && !isScanning && onClose()}
      />

      {/* Mobile-constrained container */}
      <div className="max-w-md mx-auto w-full h-full relative flex items-center justify-center p-6">
        <div className={`w-full rounded-xl border overflow-hidden flex flex-col ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>

          {/* Header */}
          <div className={`flex items-center justify-between p-5 shrink-0 ${
            isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Camera className="w-4.5 h-4.5 text-blue-500" />
              </div>
              <div>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Verify Discount</h3>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Scan QR or enter code</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            {scanResult === 'success' ? (
              <div className="text-center py-6">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Verified</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Voucher successfully applied</p>
              </div>
            ) : scanResult === 'unauthorized' ? (
              <div className="text-center py-6 w-full">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                  <ShieldAlert className="w-7 h-7 text-red-500" />
                </div>
                <p className={`text-base font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>Unauthorized</p>
                <p className={`text-xs mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{errorMessage}</p>
                <button
                  onClick={() => { setScanResult(null); setScanInput(''); }}
                  className={`w-full h-12 rounded-xl text-sm font-medium border ${isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-6">
                {/* Scan Button */}
                <div className="relative w-full aspect-square max-w-[200px] shrink-0">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-blue-500 rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-blue-500 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-blue-500 rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-blue-500 rounded-br-2xl" />

                  <button
                    onClick={startHardwareScan}
                    disabled={isScanning}
                    className={`w-full h-full rounded-2xl relative overflow-hidden flex flex-col items-center justify-center transition-all active:scale-[0.98] ${
                      isDark ? 'bg-blue-500/5' : 'bg-blue-50/50'
                    }`}
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                        <p className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Opening camera...</p>
                      </>
                    ) : (
                      <>
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-2 ${isDark ? 'bg-blue-500/10' : 'bg-blue-100/50'}`}>
                          <Camera className="w-7 h-7 text-blue-500" />
                        </div>
                        <p className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Tap to Scan</p>
                      </>
                    )}
                  </button>
                </div>

                {/* Manual Input */}
                {!isScanning && (
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <div className={`h-px flex-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                      <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Or enter code manually</p>
                      <div className={`h-px flex-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                    </div>

                    <input
                      value={scanInput}
                      onChange={handleInputChange}
                      placeholder="Ex: A465765"
                      maxLength={7}
                      className={`w-full h-14 px-4 rounded-lg text-center text-base font-mono tracking-widest border outline-none transition-all ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-600 focus:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />

                    {(scanResult === 'invalid' || scanResult === 'ambiguous' || scanResult === 'error') && (
                      <p className={`text-xs font-medium text-center ${isDark ? 'text-red-400' : 'text-red-500'}`}>{errorMessage}</p>
                    )}

                    <button
                      onClick={() => handleProcessScan()}
                      disabled={scanInput.length < 7 || isProcessingScan}
                      className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
                    >
                      {isProcessingScan ? <Loader2 className="animate-spin w-5 h-5" /> : "Verify Discount"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
      `}</style>
    </div>
  );
};
