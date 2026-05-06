import React from 'react';
import { X, Shield, Lock, Eye, Users, Database } from 'lucide-react';
import { AppView } from './types';

interface PrivacyPolicyProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ setView, theme }) => {
  const isDark = theme === 'dark';

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
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                  <Shield className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Privacy Policy
                  </h2>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Last Updated: February 20, 2026</p>
                </div>
              </div>
              <button
                onClick={() => setView('login')}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className={`flex-1 min-h-0 overflow-y-auto px-5 py-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            <div className="space-y-6">
              {/* Introduction */}
              <section>
                <p className="text-sm leading-relaxed">
                  Welcome to <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>DealPro</span>. We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services operated by <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Vedic Jaalam</span>.
                </p>
              </section>

              {/* 1. Information We Collect */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    1. Information We Collect
                  </h3>
                </div>

                <div className="space-y-3 ml-10">
                  <div>
                    <h4 className={`font-semibold text-sm mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.1 Personal Information:</h4>
                    <p className="text-sm leading-relaxed">Name, username, email, phone number, and encrypted passwords.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold text-sm mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.2 Merchant Information:</h4>
                    <p className="text-sm leading-relaxed">Business name, GST/PAN (encrypted), location, and bank details.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold text-sm mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.3 Location Information:</h4>
                    <p className="text-sm leading-relaxed">Precise GPS coordinates (to show deals near you) and IP addresses.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold text-sm mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.4 Content & Consent Data:</h4>
                    <p className="text-sm leading-relaxed">We collect and store Merchant Consent (True/False) and the Consent Timestamp (merch_consent_date) to comply with intellectual property laws.</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold text-sm mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.5 Usage Data:</h4>
                    <p className="text-sm leading-relaxed">App patterns, search queries, and deals viewed/redeemed.</p>
                  </div>
                </div>
              </section>

              {/* 2. How We Use Your Information */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                    <Eye className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    2. How We Use Your Information
                  </h3>
                </div>

                <div className="ml-10">
                  <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                    <li><span className="font-semibold">Service Provision:</span> To manage accounts and process deal redemptions.</li>
                    <li><span className="font-semibold">Smart Discovery:</span> To fetch relevant product data and specifications using third-party APIs (e.g., SerpApi) to simplify the deal-creation process for merchants.</li>
                    <li><span className="font-semibold">Image Optimization:</span> To process and serve high-quality images via third-party media providers (e.g., Cloudinary).</li>
                    <li><span className="font-semibold">Legal Compliance:</span> To maintain a record of merchant consent for product data and images used within the app.</li>
                  </ul>
                </div>
              </section>

              {/* 3. Data Sharing and Disclosure */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-500/10' : 'bg-slate-50'}`}>
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    3. Data Sharing and Disclosure
                  </h3>
                </div>

                <div className="ml-10">
                  <p className="text-sm leading-relaxed mb-3">We do not sell your personal data. We share information only in these cases:</p>
                  <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                    <li><span className="font-semibold">With Consumers/Merchants:</span> To facilitate deal redemptions.</li>
                    <li><span className="font-semibold">With Service Providers:</span>
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li><span className="font-semibold">Supabase:</span> Hosts our database, authentication, and server-side functions.</li>
                        <li><span className="font-semibold">SerpApi:</span> To perform product searches and metadata retrieval.</li>
                        <li><span className="font-semibold">Cloudinary:</span> To host and optimize merchant-uploaded or confirmed images.</li>
                        <li><span className="font-semibold">Google Gemini AI:</span> Powers image moderation, product extraction from photos, and locality-name transliteration into Indian languages.</li>
                        <li><span className="font-semibold">Firebase Cloud Messaging (Google):</span> Delivers push notifications about deals, redemptions, and account activity.</li>
                        <li><span className="font-semibold">OpenStreetMap &amp; Leaflet:</span> Powers in-app maps for store and deal locations.</li>
                        <li><span className="font-semibold">Google Maps:</span> Opens for turn-by-turn navigation when you tap a "Directions" button.</li>
                        <li><span className="font-semibold">Sentry:</span> Captures crash and error reports to help us fix bugs (no personal data is sent intentionally).</li>
                      </ul>
                    </li>
                    <li><span className="font-semibold">Legal Requirements:</span> When required by law or to protect our rights in intellectual property disputes.</li>
                  </ul>
                </div>
              </section>

              {/* 4. Data Security */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                    <Lock className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    4. Data Security
                  </h3>
                </div>

                <div className="ml-10">
                  <p className="text-sm leading-relaxed mb-3">We implement industry-standard security:</p>
                  <ul className="list-disc list-inside text-sm space-y-2 ml-4">
                    <li><span className="font-semibold">Encryption:</span> End-to-end encryption for GST, PAN, and passwords.</li>
                    <li><span className="font-semibold">Media Security:</span> We use secure, CDN-backed hosting for images to ensure your business assets are delivered safely.</li>
                    <li><span className="font-semibold">Consent Logging:</span> Your agreement to use specific product images is logged with an immutable timestamp in our PostgreSQL database for your protection.</li>
                  </ul>
                </div>
              </section>

              {/* 5. Your Rights and Choices */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                    <Shield className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    5. Your Rights and Choices
                  </h3>
                </div>

                <div className="ml-10 text-sm leading-relaxed space-y-3">
                  <p>You can access, correct, or delete your data at any time via the Profile section.</p>
                  <p><span className="font-semibold">Merchant Control:</span> Merchants may withdraw consent for specific product images by marking them "Inactive" or deleting the product row, which triggers a 30-day deletion cycle from our media cache (Cloudinary).</p>
                </div>
              </section>

              {/* 6. Children's Privacy */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    6. Children's Privacy
                  </h3>
                </div>

                <div className="text-sm leading-relaxed">
                  <p>DealPro is not intended for children under 13. We do not knowingly collect data from children.</p>
                </div>
              </section>

              {/* 7. Changes to This Policy */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    7. Changes to This Policy
                  </h3>
                </div>

                <div className="text-sm leading-relaxed">
                  <p>We may update this policy periodically. We will notify you of material changes via an in-app notification.</p>
                </div>
              </section>

              {/* 8. Contact Us */}
              <section>
                <div className="flex items-center gap-2.5 mb-3">
                  <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    8. Contact Us
                  </h3>
                </div>

                <div className="text-sm leading-relaxed space-y-2">
                  <div className={`mt-3 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>DealPro Privacy Team</p>
                    <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Email: privacy@vedicjaalam.com</p>
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Support: Help & Feedback section in the app.</p>
                  </div>
                </div>
              </section>

              {/* Acceptance */}
              <section className={`p-4 rounded-xl border ${isDark ? 'bg-blue-500/5 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  By using DealPro, you acknowledge that you have read, understood, and agree to be bound by this Privacy Policy.
                </p>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-5 py-4 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              onClick={() => setView('login')}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
