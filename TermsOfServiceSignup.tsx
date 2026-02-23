import React, { useState, useRef } from 'react';
import { X, FileText, Scale, Shield, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';
import { AppView } from './types';

interface TermsOfServiceSignupProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
  setTermsAccepted: (accepted: boolean) => void;
}

export const TermsOfServiceSignup: React.FC<TermsOfServiceSignupProps> = ({ setView, theme, setTermsAccepted }) => {
  const isDark = theme === 'dark';
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 10;
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAgree = () => {
    setTermsAccepted(true);
    setView('register');
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50">
      <div className="max-w-md mx-auto w-full h-full relative">
        <div
          className={`absolute inset-0 flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}
        >
          {/* Header */}
          <div className={`shrink-0 px-5 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                  <FileText className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Terms of Service
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Last Updated: February 20, 2026</p>
                </div>
              </div>
              <button
                onClick={() => setView('register')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scroll Indicator */}
          {!hasScrolledToBottom && (
            <div className={`shrink-0 px-5 py-2 flex items-center justify-center gap-2 border-b ${isDark ? 'bg-amber-500/5 border-amber-500/10' : 'bg-amber-50 border-amber-100'}`}>
              <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
              <p className={`text-xs font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                Please scroll down to read all terms before accepting
              </p>
            </div>
          )}

          {/* Content */}
          <div
            ref={contentRef}
            onScroll={handleScroll}
            className={`flex-1 min-h-0 overflow-y-auto px-5 py-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            <div className="space-y-6">
              {/* Introduction */}
              <section>
                <p className="text-sm leading-relaxed">
                  Welcome to <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>DealPro</span>. These Terms of Service ("Terms") govern your access to and use of our mobile application and services operated by <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Vedic Jaalam</span> ("we," "us," or "our"). By creating an account or using DealPro, you agree to be bound by these Terms.
                </p>
              </section>

              {/* 1. Acceptance of Terms */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    1. Acceptance of Terms
                  </h3>
                </div>
                <div className="ml-10 text-sm leading-relaxed space-y-2">
                  <p>By accessing or using DealPro, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using DealPro on behalf of a business, you represent that you have the authority to bind that entity to these Terms.</p>
                </div>
              </section>

              {/* 2. Eligibility */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    2. Eligibility
                  </h3>
                </div>
                <div className="text-sm leading-relaxed space-y-2">
                  <p>You must be at least 13 years old to use DealPro. Merchants must be legally authorized to operate a business in their jurisdiction and provide valid GST and PAN information. False or fraudulent information will result in immediate account termination.</p>
                </div>
              </section>

              {/* 3. Merchant Catalog & "Suggested" Content */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    3. Merchant Catalog & "Suggested" Content
                  </h3>
                </div>
                <div className="ml-10 text-sm leading-relaxed space-y-3">
                  <div>
                    <h4 className={`font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>3.1 Automated Suggestions</h4>
                    <p>DealPro provides a "Product Catalog" tool that may suggest product names, technical specifications, and preview images sourced from third-party search engines (e.g., SerpApi). This data is provided "AS IS" for convenience only.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>3.2 Merchant Verification</h4>
                    <p>The Merchant is strictly required to verify the accuracy of all "Suggested Content." By saving or publishing a deal, the Merchant adopts the suggested data as their own and assumes full responsibility for its accuracy and legality.</p>
                  </div>
                </div>
              </section>

              {/* 4. Intellectual Property & Image Liability */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                    <Scale className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    4. Intellectual Property & Image Liability
                  </h3>
                </div>
                <div className="ml-10 text-sm leading-relaxed space-y-3">
                  <div>
                    <h4 className={`font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>4.1 Ownership of Images</h4>
                    <p>Merchants are prohibited from uploading or confirming images for which they do not hold the necessary copyrights or licenses.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>4.2 Liability for Infringement</h4>
                    <p>The liability for any copyright or trademark infringement related to product images lies solely with the Merchant. DealPro does not claim ownership of merchant-uploaded or confirmed content.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>4.3 License Grant</h4>
                    <p>By posting content on DealPro, you grant us a worldwide, royalty-free license to use, reproduce, and display that content specifically to provide and promote the DealPro service.</p>
                  </div>
                </div>
              </section>

              {/* 5. User Responsibilities */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    5. User Responsibilities
                  </h3>
                </div>
                <div className="text-sm leading-relaxed space-y-2">
                  <p>You agree NOT to:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Post false, misleading, or fraudulent deals</li>
                    <li>Infringe upon the intellectual property rights of any third party</li>
                    <li>Use automated systems (bots, scrapers) to access the service</li>
                    <li>Post content that is offensive, illegal, or harmful</li>
                  </ul>
                </div>
              </section>

              {/* 6. Disclaimers and Limitation of Liability */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    6. Disclaimers and Limitation of Liability
                  </h3>
                </div>
                <div className="ml-10 text-sm leading-relaxed space-y-3">
                  <p className="font-semibold">DEALPRO IS PROVIDED "AS IS."</p>
                  <p>We do not guarantee the availability of deals or the accuracy of merchant-provided content.</p>
                  <div>
                    <h4 className={`font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>No Liability for Infringement</h4>
                    <p>DealPro acts as a neutral platform (Host). We are not liable for any intellectual property disputes arising from merchant content.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Total Liability</h4>
                    <p>To the maximum extent permitted by law, DealPro's liability shall not exceed the amount paid by you to us in the past 12 months.</p>
                  </div>
                </div>
              </section>

              {/* 7. Indemnification */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    7. Indemnification
                  </h3>
                </div>
                <div className="text-sm leading-relaxed space-y-2">
                  <p>You agree to indemnify, defend, and hold harmless DealPro and its officers from any claims, damages, or expenses (including legal fees) arising from:</p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li>Your violation of these Terms</li>
                    <li>Any claim that your product images or descriptions infringe upon the copyrights or trademarks of a third party</li>
                  </ul>
                </div>
              </section>

              {/* 8. Copyright Takedown Policy (DMCA) */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    8. Copyright Takedown Policy (DMCA)
                  </h3>
                </div>
                <div className="text-sm leading-relaxed space-y-2">
                  <p>If you believe that any content on DealPro infringes upon your copyright, please notify our Copyright Agent at <span className="font-semibold text-amber-500">legal@vedicjaalam.com</span>. We will respond to valid "Takedown Notices" by removing the infringing material immediately.</p>
                </div>
              </section>

              {/* 9. Dispute Resolution */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    9. Dispute Resolution
                  </h3>
                </div>
                <div className="text-sm leading-relaxed space-y-2">
                  <p>Any disputes shall be resolved through binding arbitration in Bangalore, Karnataka, in accordance with the laws of India.</p>
                </div>
              </section>

              {/* 10. Contact Us */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    10. Contact Us
                  </h3>
                </div>
                <div className="text-sm leading-relaxed space-y-2">
                  <p>For legal inquiries, contact:</p>
                  <div className={`mt-3 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DealPro Legal Team</p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email: legal@vedicjaalam.com</p>
                  </div>
                </div>
              </section>

              {/* Acceptance */}
              <section className={`p-4 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  By using DealPro, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
                </p>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-5 py-4 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              onClick={handleAgree}
              disabled={!hasScrolledToBottom}
              className={`w-full h-12 rounded-xl text-sm font-medium transition-all ${
                hasScrolledToBottom
                  ? 'bg-slate-900 text-white active:scale-[0.98]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {hasScrolledToBottom ? 'I Agree to Terms' : 'Scroll to Bottom to Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
