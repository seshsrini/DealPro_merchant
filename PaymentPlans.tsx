
import React, { useState, useEffect, useMemo } from 'react';
import { AppView, User } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { QRCanvas } from './components/QRCanvas';
import { paymentService } from './services/paymentService';
import {
  CreditCard,
  IndianRupee,
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Lock,
  ArrowLeft
} from 'lucide-react';

interface PaymentPlansProps {
  user: User;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
}

const UPI_APPS = [
  { id: 'phonepe', name: 'PhonePe', logo: 'https://cdn.iconscout.com/icon/free/png-256/phonepe-2139062-1801262.png', uriPrefix: 'phonepe://pay' },
  { id: 'gpay', name: 'Google Pay', logo: 'https://cdn.iconscout.com/icon/free/png-256/google-pay-2038769-1721590.png', uriPrefix: 'tez://upi/pay' },
  { id: 'paytm', name: 'Paytm', logo: 'https://cdn.iconscout.com/icon/free/png-256/paytm-226448.png', uriPrefix: 'paytmmp://pay' },
];

const generateTransactionId = () => `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

export const PaymentPlans: React.FC<PaymentPlansProps> = ({ user, setView, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [paymentAmount, setPaymentAmount] = useState<number>(999.00);
  const [upiId, setUpiId] = useState<string>('dealpro@ybl');
  const [transactionId, setTransactionId] = useState<string>(generateTransactionId());

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    if (!isProcessing && !paymentSuccess && !paymentError) {
      setTransactionId(generateTransactionId());
    }
  }, [isProcessing, paymentSuccess, paymentError]);

  const upiQrData = useMemo(() => {
    const payeeAddress = upiId;
    const payeeName = encodeURIComponent('DealPro Services');
    const transactionRefId = transactionId;
    const amount = paymentAmount.toFixed(2);
    const currency = 'INR';
    return `upi://pay?pa=${payeeAddress}&pn=${payeeName}&tr=${transactionRefId}&am=${amount}&cu=${currency}`;
  }, [upiId, paymentAmount, transactionId]);

  const handleUpiPayment = async (appId: string) => {
    setIsProcessing(true);
    setPaymentError(null);
    setPaymentSuccess(false);

    try {
      let uri = upiQrData;
      if (appId === 'phonepe') {
        uri = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent('DealPro Services')}&mc=8999&tid=${transactionId}&tr=${transactionId}&am=${paymentAmount.toFixed(2)}&cu=INR`;
      } else if (appId === 'gpay') {
        uri = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent('DealPro Services')}&mc=8999&tid=${transactionId}&tr=${transactionId}&am=${paymentAmount.toFixed(2)}&cu=INR`;
      } else if (appId === 'paytm') {
        uri = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent('DealPro Services')}&mc=8999&tid=${transactionId}&tr=${transactionId}&am=${paymentAmount.toFixed(2)}&cu=INR`;
      }

      console.log('Attempting to open UPI URI:', uri);
      window.location.href = uri;

      await new Promise(resolve => setTimeout(resolve, 5000));

      const backendResponse = await paymentService.processUpiPayment(paymentAmount, 'INR', user.id, transactionId);

      if (backendResponse.success) {
        setPaymentSuccess(true);
        setTimeout(() => setView('merchant_dashboard'), 3000);
      } else {
        setPaymentError(backendResponse.message || 'Payment processing failed on backend.');
      }

    } catch (err: any) {
      console.error('UPI Payment Initiation Error:', err);
      setPaymentError(err.message || 'Could not launch UPI app or payment failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isMobile = useMemo(() => {
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }, []);

  return (
    <div className="px-6 pt-6 pb-32 space-y-6 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => setView('profile')}
          className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}
        >
          <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
        </button>
        <div className="flex-1">
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Secure Payments</h2>
          <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Payment gateway</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
          <CreditCard className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      {paymentSuccess ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Payment Successful!</p>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Your transaction has been securely processed. Redirecting...</p>
        </div>
      ) : paymentError ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Payment Failed</p>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{paymentError} Please try again.</p>
          <button
            onClick={() => { setPaymentError(null); setIsProcessing(false); setTransactionId(generateTransactionId()); }}
            className="h-12 rounded-xl bg-slate-900 text-white text-sm font-medium px-8 active:scale-[0.98] transition-all"
          >
            Retry Payment
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className={`p-6 rounded-xl border space-y-6 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className={`flex items-center justify-between pb-4 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Amount Due</p>
              <div className="flex items-center gap-2">
                <IndianRupee className={`w-6 h-6 ${isDark ? 'text-white' : 'text-slate-900'}`} />
                <span className={`text-3xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{paymentAmount.toFixed(2)}</span>
              </div>
            </div>

            <p className={`text-xs text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Choose your secure payment method
            </p>

            {isMobile && (
              <div className="space-y-4">
                <h3 className={`text-sm font-semibold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Pay with UPI Apps</h3>
                <div className="grid grid-cols-3 gap-3">
                  {UPI_APPS.map(app => (
                    <button
                      key={app.id}
                      onClick={() => handleUpiPayment(app.id)}
                      disabled={isProcessing}
                      className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 border active:scale-[0.98] transition-all disabled:opacity-50 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <img src={app.logo} alt={app.name} className="w-10 h-10 object-contain" />
                      <span className={`text-[10px] font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{app.name}</span>
                    </button>
                  ))}
                </div>
                <div className={`flex items-center justify-center gap-2 mt-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <Lock className="w-3 h-3" />
                  <span>Encrypted transaction</span>
                </div>
              </div>
            )}

            <div className={`space-y-4 border-t pt-6 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <h3 className={`text-sm font-semibold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>Scan to Pay (Any UPI App)</h3>
              <div className="flex items-center justify-center">
                <QRCanvas value={upiQrData} />
              </div>
              <div className={`text-center text-xs mt-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <p>Scan this QR code using any UPI-enabled mobile application (e.g., Google Pay, PhonePe, Paytm, BHIM) to complete your payment.</p>
                <div className={`flex items-center justify-center gap-2 mt-4 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ScanLine className="w-3 h-3" />
                  <span>Transaction ID: {transactionId}</span>
                </div>
                <div className={`flex items-center justify-center gap-2 mt-2 text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  <ShieldCheck className="w-3 h-3" />
                  <span>Payee UPI ID: {upiId}</span>
                </div>
              </div>
            </div>

            {isProcessing && (
              <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Processing secure payment...</p>
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="text-center space-y-3">
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Your security is our priority</p>
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-medium">SSL Secured</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-500">
                <Lock className="w-4 h-4" />
                <span className="text-xs font-medium">PCI-DSS Compliant</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
