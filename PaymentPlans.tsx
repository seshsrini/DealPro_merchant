
import React, { useState, useEffect, useMemo } from 'react';
import { AppView, User } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { QRCanvas } from './components/QRCanvas';
import { paymentService } from './services/paymentService'; // Simulated payment service
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
}

// Dummy UPI IDs for demonstration
const UPI_APPS = [
  { id: 'phonepe', name: 'PhonePe', logo: 'https://cdn.iconscout.com/icon/free/png-256/phonepe-2139062-1801262.png', uriPrefix: 'phonepe://pay' },
  { id: 'gpay', name: 'Google Pay', logo: 'https://cdn.iconscout.com/icon/free/png-256/google-pay-2038769-1721590.png', uriPrefix: 'tez://upi/pay' },
  { id: 'paytm', name: 'Paytm', logo: 'https://cdn.iconscout.com/icon/free/png-256/paytm-226448.png', uriPrefix: 'paytmmp://pay' },
  // 'Other UPI App' will fall back to a generic UPI URI or prompt manual entry
];

// Helper to generate a unique transaction ID
const generateTransactionId = () => `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

export const PaymentPlans: React.FC<PaymentPlansProps> = ({ user, setView }) => {
  const { t } = useTranslation();
  const [paymentAmount, setPaymentAmount] = useState<number>(999.00); // Fixed dummy amount
  const [upiId, setUpiId] = useState<string>('dealpro@ybl'); // Dummy UPI ID
  const [transactionId, setTransactionId] = useState<string>(generateTransactionId());

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Re-generate transaction ID if component remounts or on retry
  useEffect(() => {
    if (!isProcessing && !paymentSuccess && !paymentError) {
      setTransactionId(generateTransactionId());
    }
  }, [isProcessing, paymentSuccess, paymentError]);

  // UPI QR Data generation
  const upiQrData = useMemo(() => {
    // Refer to UPI Linking Specification for URI format
    // upi://pay?pa=<payee_address>&pn=<payee_name>&mc=<merchant_code>&tid=<transaction_id>&tr=<transaction_ref_id>&am=<amount>&cu=<currency>&url=<transaction_url>
    const payeeAddress = upiId;
    const payeeName = encodeURIComponent('DealPro Services');
    const transactionRefId = transactionId; // Unique ID for tracking
    const amount = paymentAmount.toFixed(2);
    const currency = 'INR';

    return `upi://pay?pa=${payeeAddress}&pn=${payeeName}&tr=${transactionRefId}&am=${amount}&cu=${currency}`;
  }, [upiId, paymentAmount, transactionId]);

  const handleUpiPayment = async (appId: string) => {
    setIsProcessing(true);
    setPaymentError(null);
    setPaymentSuccess(false);

    try {
      // Construct UPI deep link
      let uri = upiQrData;
      if (appId === 'phonepe') {
        uri = `phonepe://pay?pa=${upiId}&pn=${encodeURIComponent('DealPro Services')}&mc=8999&tid=${transactionId}&tr=${transactionId}&am=${paymentAmount.toFixed(2)}&cu=INR`;
      } else if (appId === 'gpay') {
        uri = `tez://upi/pay?pa=${upiId}&pn=${encodeURIComponent('DealPro Services')}&mc=8999&tid=${transactionId}&tr=${transactionId}&am=${paymentAmount.toFixed(2)}&cu=INR`;
      } else if (appId === 'paytm') {
        uri = `paytmmp://pay?pa=${upiId}&pn=${encodeURIComponent('DealPro Services')}&mc=8999&tid=${transactionId}&tr=${transactionId}&am=${paymentAmount.toFixed(2)}&cu=INR`;
      }
      
      console.log('Attempting to open UPI URI:', uri);

      // Attempt to open the deep link
      window.location.href = uri;

      // Simulate a backend payment success after a short delay
      // In a real application, you would poll your backend for payment status
      await new Promise(resolve => setTimeout(resolve, 5000)); 
      
      // Simulate backend processing
      const backendResponse = await paymentService.processUpiPayment(paymentAmount, 'INR', user.id, transactionId);

      if (backendResponse.success) {
        setPaymentSuccess(true);
        setTimeout(() => setView('merchant_dashboard'), 3000); // Redirect on success
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
    <div className="px-6 pt-6 pb-32 animate-reveal space-y-8 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => setView('profile')} 
          className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-white/10 active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-6 h-6 text-slate-400" />
        </button>
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">
            Secure<br /><span className="text-emerald-500">Payments</span>
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">Gateway Protocol Active</p>
          </div>
        </div>
        <div className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-white/10">
          <CreditCard className="w-6 h-6 text-slate-400" />
        </div>
      </div>

      {paymentSuccess ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-emerald-500/20 bg-emerald-500/5 shadow-2xl animate-reveal">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">Payment Successful!</p>
          <p className="text-xs font-bold text-slate-400 px-10">Your transaction has been securely processed. Redirecting...</p>
        </div>
      ) : paymentError ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-rose-500/20 bg-rose-500/5 shadow-2xl animate-shake">
          <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">Payment Failed</p>
          <p className="text-xs font-bold text-slate-400 px-10">{paymentError} Please try again.</p>
          <button 
            onClick={() => { setPaymentError(null); setIsProcessing(false); setTransactionId(generateTransactionId()); }}
            className="btn-premium h-14 rounded-2xl mt-8 px-8 text-[10px] font-black uppercase tracking-widest"
          >
            Retry Payment
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass p-8 rounded-[3rem] border-white/10 bg-slate-900/40 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <p className="text-lg font-black uppercase text-slate-400 tracking-widest">Amount Due</p>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-8 h-8 text-white" />
                <span className="text-5xl font-black text-white tracking-tighter">{paymentAmount.toFixed(2)}</span>
              </div>
            </div>

            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">
              Choose your secure payment method
            </p>

            {isMobile && (
              <div className="space-y-4 animate-reveal">
                <h3 className="text-sm font-black uppercase tracking-tighter text-white text-center">Pay with UPI Apps</h3>
                <div className="grid grid-cols-3 gap-4">
                  {UPI_APPS.map(app => (
                    <button
                      key={app.id}
                      onClick={() => handleUpiPayment(app.id)}
                      disabled={isProcessing}
                      className="glass p-4 rounded-2xl flex flex-col items-center justify-center gap-2 border-white/10 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                      <img src={app.logo} alt={app.name} className="w-10 h-10 object-contain" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white">{app.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2 mt-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <Lock className="w-3 h-3" />
                  <span>Encrypted Transaction Node</span>
                </div>
              </div>
            )}

            <div className="space-y-4 animate-reveal border-t border-white/10 pt-6">
              <h3 className="text-sm font-black uppercase tracking-tighter text-white text-center">Scan to Pay (Any UPI App)</h3>
              <div className="flex items-center justify-center">
                <QRCanvas value={upiQrData} />
              </div>
              <div className="text-center text-slate-400 text-xs mt-4 leading-relaxed">
                <p>Scan this QR code using any UPI-enabled mobile application (e.g., Google Pay, PhonePe, Paytm, BHIM) to complete your payment.</p>
                <div className="flex items-center justify-center gap-2 mt-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <ScanLine className="w-3 h-3" />
                  <span>Transaction ID: {transactionId}</span>
                </div>
                <div className="flex items-center justify-center gap-2 mt-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Payee UPI ID: {upiId}</span>
                </div>
              </div>
            </div>

            {isProcessing && (
              <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 animate-pulse">Processing Secure Payment...</p>
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="text-center mt-8 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Your security is our priority.
            </p>
            <div className="flex items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-emerald-500">
                <ShieldCheck className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">SSL SECURED</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-500">
                <Lock className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-widest">PCI-DSS COMPLIANT</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
