import React from 'react';
import { X, FileText, Scale, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { AppView } from './types';

interface TermsOfServiceProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ setView, theme }) => {
  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-reveal">
      <div className={`w-full max-w-4xl max-h-[90vh] rounded-[2rem] overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900/95 border border-white/10' : 'bg-white border border-slate-200'}`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 px-8 py-6 border-b backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className={`text-2xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Terms of Service
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Last Updated: February 2026</p>
              </div>
            </div>
            <button
              onClick={() => setView('login')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`px-8 py-6 overflow-y-auto max-h-[calc(90vh-100px)] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          <div className="space-y-8">
            {/* Introduction */}
            <section>
              <p className="text-sm leading-relaxed">
                Welcome to <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>DealPro</span>. These Terms of Service ("Terms") govern your access to and use of our mobile application and services. By creating an account or using DealPro, you agree to be bound by these Terms.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                Please read these Terms carefully before using our services. If you do not agree to these Terms, you may not access or use DealPro.
              </p>
            </section>

            {/* 1. Acceptance of Terms */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  1. Acceptance of Terms
                </h3>
              </div>
              <div className="ml-11 text-sm leading-relaxed space-y-2">
                <p>By accessing or using DealPro, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using DealPro on behalf of a business or organization, you represent that you have the authority to bind that entity to these Terms.</p>
              </div>
            </section>

            {/* 2. Eligibility */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  2. Eligibility
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>You must be at least 13 years old to use DealPro. If you are under 18, you must have permission from a parent or guardian to use our services. Merchants must be legally authorized to operate a business in their jurisdiction.</p>
              </div>
            </section>

            {/* 3. User Accounts */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  3. User Accounts
                </h3>
              </div>
              <div className="ml-11 text-sm leading-relaxed space-y-3">
                <div>
                  <h4 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>3.1 Account Registration</h4>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>You must provide accurate, current, and complete information during registration</li>
                    <li>You are responsible for maintaining the confidentiality of your password</li>
                    <li>You must notify us immediately of any unauthorized use of your account</li>
                    <li>One person or entity may not maintain more than one account</li>
                  </ul>
                </div>
                <div>
                  <h4 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>3.2 Merchant Accounts</h4>
                  <p>Merchants must provide valid GST and PAN information. False or fraudulent information may result in immediate account termination and legal action.</p>
                </div>
                <div>
                  <h4 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>3.3 Account Termination</h4>
                  <p>We reserve the right to suspend or terminate your account at any time for violation of these Terms or for any other reason at our sole discretion.</p>
                </div>
              </div>
            </section>

            {/* 4. User Responsibilities */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Scale className="w-4 h-4 text-purple-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  4. User Responsibilities
                </h3>
              </div>
              <div className="ml-11 text-sm leading-relaxed space-y-2">
                <p>You agree NOT to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Impersonate any person or entity or misrepresent your affiliation</li>
                  <li>Use automated systems (bots, scrapers) to access the service</li>
                  <li>Attempt to gain unauthorized access to any part of the service</li>
                  <li>Interfere with or disrupt the service or servers</li>
                  <li>Upload viruses, malware, or malicious code</li>
                  <li>Harass, abuse, or harm other users</li>
                  <li>Post false, misleading, or fraudulent content</li>
                  <li>Use the service for any illegal or unauthorized purpose</li>
                  <li>Attempt to manipulate deals, ratings, or reviews</li>
                </ul>
              </div>
            </section>

            {/* 5. Deals and Redemptions */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  5. Deals and Redemptions
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-3">
                <div>
                  <h4 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>5.1 Consumer Responsibilities</h4>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Deals are subject to availability and merchant terms</li>
                    <li>You must redeem deals within the specified validity period</li>
                    <li>One redemption per deal unless otherwise specified</li>
                    <li>DealPro is not responsible for merchant disputes or unfulfilled deals</li>
                  </ul>
                </div>
                <div>
                  <h4 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>5.2 Merchant Responsibilities</h4>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Merchants must honor all valid deal redemptions</li>
                    <li>Deal information must be accurate and up-to-date</li>
                    <li>Merchants must comply with all applicable laws and regulations</li>
                    <li>Merchants are responsible for their own tax obligations</li>
                    <li>False or misleading deals may result in account termination</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 6. Subscriptions and Payments */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  6. Subscriptions and Payments
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>Merchants may be required to subscribe to a paid plan to access certain features:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Subscription fees are charged in advance on a recurring basis</li>
                  <li>You authorize us to charge your payment method automatically</li>
                  <li>Fees are non-refundable except as required by law</li>
                  <li>We may change subscription prices with 30 days notice</li>
                  <li>You may cancel your subscription at any time</li>
                  <li>Cancellation takes effect at the end of the current billing period</li>
                </ul>
              </div>
            </section>

            {/* 7. Intellectual Property */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  7. Intellectual Property
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>All content, features, and functionality of DealPro are owned by us or our licensors and are protected by copyright, trademark, and other intellectual property laws.</p>
                <p>You are granted a limited, non-exclusive, non-transferable license to use DealPro for personal or business purposes. You may not:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Copy, modify, or create derivative works</li>
                  <li>Reverse engineer or decompile the application</li>
                  <li>Remove or alter any proprietary notices</li>
                  <li>Use DealPro branding without permission</li>
                </ul>
              </div>
            </section>

            {/* 8. User Content */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  8. User-Generated Content
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>By posting content (reviews, ratings, photos, etc.) on DealPro, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and display that content in connection with our services.</p>
                <p>You represent that you own or have permission to use all content you post. We reserve the right to remove any content that violates these Terms or is otherwise objectionable.</p>
              </div>
            </section>

            {/* 9. Disclaimers */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  9. Disclaimers and Limitations
                </h3>
              </div>
              <div className="ml-11 text-sm leading-relaxed space-y-2">
                <p className="font-semibold">DEALPRO IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</p>
                <p>We do not guarantee that:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>The service will be uninterrupted, secure, or error-free</li>
                  <li>All deals will be available or honored by merchants</li>
                  <li>The service will meet your specific requirements</li>
                  <li>Any errors or defects will be corrected</li>
                </ul>
                <p className="mt-3">DealPro acts as a platform connecting consumers and merchants. We are not responsible for:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>The quality, safety, or legality of deals or products</li>
                  <li>Merchant performance or conduct</li>
                  <li>Disputes between users and merchants</li>
                  <li>Loss or damage resulting from use of the service</li>
                </ul>
              </div>
            </section>

            {/* 10. Limitation of Liability */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  10. Limitation of Liability
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p className="font-semibold">TO THE MAXIMUM EXTENT PERMITTED BY LAW, DEALPRO SHALL NOT BE LIABLE FOR:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Indirect, incidental, special, or consequential damages</li>
                  <li>Loss of profits, data, or business opportunities</li>
                  <li>Any damages exceeding the amount you paid us in the past 12 months</li>
                </ul>
              </div>
            </section>

            {/* 11. Indemnification */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  11. Indemnification
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>You agree to indemnify and hold harmless DealPro, its affiliates, and their respective officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising from:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any applicable laws or regulations</li>
                  <li>Your infringement of third-party rights</li>
                  <li>Your use of DealPro services</li>
                </ul>
              </div>
            </section>

            {/* 12. Dispute Resolution */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  12. Dispute Resolution
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>Any disputes arising from these Terms or your use of DealPro shall be resolved through binding arbitration in accordance with the laws of India. The arbitration shall take place in Bangalore, Karnataka.</p>
                <p>You waive any right to participate in class action lawsuits or class-wide arbitration.</p>
              </div>
            </section>

            {/* 13. Governing Law */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  13. Governing Law
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>These Terms shall be governed by and construed in accordance with the laws of India, without regard to conflict of law principles.</p>
              </div>
            </section>

            {/* 14. Changes to Terms */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  14. Changes to These Terms
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms in the app and updating the "Last Updated" date.</p>
                <p>Your continued use of DealPro after changes are posted constitutes acceptance of the modified Terms.</p>
              </div>
            </section>

            {/* 15. Severability */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  15. Severability
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect.</p>
              </div>
            </section>

            {/* 16. Contact Information */}
            <section className="pb-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  16. Contact Us
                </h3>
              </div>
              <div className="text-sm leading-relaxed space-y-2">
                <p>If you have questions about these Terms, please contact us:</p>
                <div className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                  <p className="font-semibold">DealPro Legal Team</p>
                  <p className="mt-1">Email: legal@vedicjaalam.com</p>
                  <p>Support: Use Help & Feedback section in the app</p>
                </div>
              </div>
            </section>

            {/* Acceptance */}
            <section className={`p-4 rounded-xl border-2 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
              <p className="text-sm font-semibold text-amber-500">
                By using DealPro, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 px-8 py-4 border-t backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <button
            onClick={() => setView('login')}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black text-sm uppercase tracking-wider shadow-lg active:scale-95 transition-all"
          >
            I Agree to Terms
          </button>
        </div>
      </div>
    </div>
  );
};
