import React, { useState, useRef } from 'react';
import { X, Shield, Lock, Eye, Users, Database, Bell, MapPin } from 'lucide-react';
import { AppView } from './types';

interface PrivacyPolicySignupProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
  setPrivacyAccepted: (accepted: boolean) => void;
}

export const PrivacyPolicySignup: React.FC<PrivacyPolicySignupProps> = ({ setView, theme, setPrivacyAccepted }) => {
  const isDark = theme === 'dark';
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 10; // 10px threshold
    if (isAtBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAgree = () => {
    setPrivacyAccepted(true);
    setView('register');
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4 animate-reveal">
      <div className={`w-full max-w-4xl max-h-[90vh] rounded-[2rem] overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900/95 border border-white/10' : 'bg-white border border-slate-200'}`}>
        {/* Header */}
        <div className={`sticky top-0 z-10 px-8 py-6 border-b backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h2 className={`text-2xl font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Privacy Policy
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">Last Updated: February 2026</p>
              </div>
            </div>
            <button
              onClick={() => setView('register')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className={`px-8 py-6 overflow-y-auto max-h-[calc(90vh-180px)] ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
        >
          <div className="space-y-8">
            {/* Scroll Indicator */}
            {!hasScrolledToBottom && (
              <div className={`sticky top-0 -mt-6 -mx-8 px-8 py-2 ${isDark ? 'bg-blue-500/10 border-b border-blue-500/20' : 'bg-blue-50 border-b border-blue-200'} text-xs font-semibold text-blue-600 text-center animate-pulse`}>
                ⬇️ Please scroll down to read the complete privacy policy
              </div>
            )}

            {/* Introduction */}
            <section>
              <p className="text-sm leading-relaxed">
                Welcome to <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>DealPro</span>. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.
              </p>
              <p className="text-sm leading-relaxed mt-3">
                By using DealPro, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
              </p>
            </section>

            {/* 1. Information We Collect */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Database className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  1. Information We Collect
                </h3>
              </div>

              <div className="space-y-4 ml-11">
                <div>
                  <h4 className={`font-bold text-sm mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.1 Personal Information</h4>
                  <p className="text-sm leading-relaxed">When you register for DealPro, we collect:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2 ml-4">
                    <li>Full name and username</li>
                    <li>Email address</li>
                    <li>Phone number (with country code)</li>
                    <li>Password (encrypted and securely stored)</li>
                    <li>Language preference</li>
                    <li>Profile information and preferences</li>
                  </ul>
                </div>

                <div>
                  <h4 className={`font-bold text-sm mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.2 Merchant Information</h4>
                  <p className="text-sm leading-relaxed">If you register as a merchant, we additionally collect:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2 ml-4">
                    <li>Business/Store name</li>
                    <li>GST number (encrypted)</li>
                    <li>PAN number (encrypted)</li>
                    <li>Business category</li>
                    <li>Store location(s) and addresses</li>
                    <li>Business operating hours</li>
                    <li>Store images and descriptions</li>
                    <li>Bank account details for transactions</li>
                  </ul>
                </div>

                <div>
                  <h4 className={`font-bold text-sm mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.3 Location Information</h4>
                  <p className="text-sm leading-relaxed">We collect location data to provide location-based services:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2 ml-4">
                    <li>GPS coordinates (latitude and longitude)</li>
                    <li>City, state, and locality information</li>
                    <li>Pincode/ZIP code</li>
                    <li>IP address-based location</li>
                  </ul>
                </div>

                <div>
                  <h4 className={`font-bold text-sm mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.4 Usage and Device Information</h4>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>Device type, model, and operating system</li>
                    <li>App usage patterns and preferences</li>
                    <li>Deals viewed, saved, and redeemed</li>
                    <li>Search queries and browsing history within the app</li>
                    <li>Crash reports and performance data</li>
                    <li>Biometric data (if you enable biometric authentication, stored locally on your device only)</li>
                  </ul>
                </div>

                <div>
                  <h4 className={`font-bold text-sm mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.5 Communications</h4>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>Feedback and support messages</li>
                    <li>Ratings and reviews</li>
                    <li>Communication with merchants or support team</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 2. How We Use Your Information */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Eye className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  2. How We Use Your Information
                </h3>
              </div>

              <div className="ml-11">
                <p className="text-sm leading-relaxed mb-3">We use the collected information for the following purposes:</p>
                <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                  <li><span className="font-semibold">Service Provision:</span> To create and manage your account, process deals and redemptions, and provide customer support</li>
                  <li><span className="font-semibold">Personalization:</span> To show you relevant deals based on your location, preferences, and browsing history</li>
                  <li><span className="font-semibold">Location Services:</span> To find nearby stores and deals within your selected search radius</li>
                  <li><span className="font-semibold">Merchant Services:</span> To verify merchant identities, process subscriptions, and provide analytics dashboards</li>
                  <li><span className="font-semibold">Communication:</span> To send you important updates, deal notifications, and promotional offers (you can opt out anytime)</li>
                  <li><span className="font-semibold">Security:</span> To detect and prevent fraud, abuse, and security incidents</li>
                  <li><span className="font-semibold">Analytics:</span> To analyze app usage, improve our services, and develop new features</li>
                  <li><span className="font-semibold">Legal Compliance:</span> To comply with applicable laws and regulations, including GST verification</li>
                </ul>
              </div>
            </section>

            {/* 3. Data Sharing and Disclosure */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  3. Data Sharing and Disclosure
                </h3>
              </div>

              <div className="ml-11">
                <p className="text-sm leading-relaxed mb-3">We may share your information in the following circumstances:</p>
                <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                  <li><span className="font-semibold">With Merchants:</span> When you redeem a deal, we share necessary information (name, phone number, redemption details) with the merchant to fulfill the transaction</li>
                  <li><span className="font-semibold">Service Providers:</span> With third-party service providers who perform services on our behalf (hosting, analytics, payment processing, customer support)</li>
                  <li><span className="font-semibold">Business Transfers:</span> In connection with a merger, acquisition, or sale of assets</li>
                  <li><span className="font-semibold">Legal Requirements:</span> When required by law, court order, or government request</li>
                  <li><span className="font-semibold">Protection:</span> To protect the rights, property, or safety of DealPro, our users, or others</li>
                  <li><span className="font-semibold">With Your Consent:</span> When you explicitly consent to sharing your information</li>
                </ul>
                <p className="text-sm leading-relaxed mt-3 font-semibold">
                  We do NOT sell your personal information to third parties for marketing purposes.
                </p>
              </div>
            </section>

            {/* 4. Data Security */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-red-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  4. Data Security
                </h3>
              </div>

              <div className="ml-11">
                <p className="text-sm leading-relaxed mb-3">We implement industry-standard security measures to protect your data:</p>
                <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                  <li>End-to-end encryption for sensitive data (GST, PAN, passwords)</li>
                  <li>Secure HTTPS connections for all data transmission</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Biometric authentication stored locally on your device only</li>
                  <li>Automated backup and disaster recovery systems</li>
                </ul>
                <p className="text-sm leading-relaxed mt-3">
                  However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                </p>
              </div>
            </section>

            {/* 5. Your Rights and Choices */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-purple-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  5. Your Rights and Choices
                </h3>
              </div>

              <div className="ml-11">
                <p className="text-sm leading-relaxed mb-3">You have the following rights regarding your personal information:</p>
                <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                  <li><span className="font-semibold">Access:</span> Request a copy of your personal data we hold</li>
                  <li><span className="font-semibold">Correction:</span> Update or correct inaccurate information through your profile settings</li>
                  <li><span className="font-semibold">Deletion:</span> Request deletion of your account and associated data</li>
                  <li><span className="font-semibold">Data Portability:</span> Request your data in a portable format</li>
                  <li><span className="font-semibold">Opt-Out:</span> Disable notifications, marketing communications, or location tracking</li>
                  <li><span className="font-semibold">Withdraw Consent:</span> Revoke permissions for biometric authentication or location access</li>
                </ul>
                <p className="text-sm leading-relaxed mt-3">
                  To exercise these rights, contact us through the Help & Feedback section in the app or email us at privacy@vedicjaalam.com
                </p>
              </div>
            </section>

            {/* 6. Location Data */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  6. Location Data
                </h3>
              </div>

              <div className="ml-11 text-sm leading-relaxed space-y-2">
                <p>DealPro uses your location to show nearby deals and stores. You can control location access through your device settings. If you disable location services, some features may not be available.</p>
                <p>We use both GPS and network-based location services. Location data is only collected when you actively use the app.</p>
              </div>
            </section>

            {/* 7. Cookies and Tracking */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-yellow-500" />
                </div>
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  7. Cookies and Tracking Technologies
                </h3>
              </div>

              <div className="ml-11 text-sm leading-relaxed space-y-2">
                <p>We use cookies, local storage, and similar technologies to:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Remember your preferences and settings</li>
                  <li>Maintain your login session</li>
                  <li>Analyze app performance and usage patterns</li>
                  <li>Provide personalized content and recommendations</li>
                </ul>
              </div>
            </section>

            {/* 8. Children's Privacy */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  8. Children's Privacy
                </h3>
              </div>

              <div className="text-sm leading-relaxed space-y-2">
                <p>DealPro is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected data from a child under 13, we will take steps to delete such information.</p>
              </div>
            </section>

            {/* 9. Data Retention */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  9. Data Retention
                </h3>
              </div>

              <div className="text-sm leading-relaxed space-y-2">
                <p>We retain your personal information for as long as necessary to provide our services and comply with legal obligations. When you delete your account, we will delete or anonymize your personal data within 30 days, except where we are required to retain it for legal, regulatory, or security purposes.</p>
              </div>
            </section>

            {/* 10. International Data Transfers */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  10. International Data Transfers
                </h3>
              </div>

              <div className="text-sm leading-relaxed space-y-2">
                <p>Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy and applicable laws.</p>
              </div>
            </section>

            {/* 11. Changes to Privacy Policy */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  11. Changes to This Privacy Policy
                </h3>
              </div>

              <div className="text-sm leading-relaxed space-y-2">
                <p>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last Updated" date. Your continued use of DealPro after changes are posted constitutes acceptance of the updated policy.</p>
              </div>
            </section>

            {/* 12. Contact Us */}
            <section className="pb-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  12. Contact Us
                </h3>
              </div>

              <div className="text-sm leading-relaxed space-y-2">
                <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
                <div className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                  <p className="font-semibold">DealPro Privacy Team</p>
                  <p className="mt-1">Email: privacy@vedicjaalam.com</p>
                  <p>Support: Use Help & Feedback section in the app</p>
                  <p className="mt-2 text-xs text-slate-500">We will respond to your inquiry within 7 business days.</p>
                </div>
              </div>
            </section>

            {/* Acceptance */}
            <section className={`p-4 rounded-xl border-2 ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
              <p className="text-sm font-semibold text-blue-500">
                By using DealPro, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 px-8 py-4 border-t backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
          <button
            onClick={handleAgree}
            disabled={!hasScrolledToBottom}
            className={`w-full h-12 rounded-xl text-white font-black text-sm uppercase tracking-wider shadow-lg transition-all ${
              hasScrolledToBottom
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 active:scale-95 cursor-pointer'
                : 'bg-slate-600 opacity-50 cursor-not-allowed'
            }`}
          >
            {hasScrolledToBottom ? 'I Understand & Agree' : 'Scroll to Bottom to Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
