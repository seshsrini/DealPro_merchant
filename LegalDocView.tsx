import React, { useState, useRef } from 'react';
import { X, FileText, Scale, Shield, AlertCircle, CheckCircle, ChevronDown, Lock, Eye, Users, Database } from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';
import { getTerms, getPrivacy, getLegalUi, LegalDoc, LegalBlock, LegalItem } from './contexts/legalContent';

/**
 * Shared presentational renderer for the merchant Terms of Service and Privacy
 * Policy screens. It owns ALL layout, icons and colors; the localized text comes
 * from contexts/legalContent.ts keyed by the current app locale. The four public
 * components (in-app + signup for each doc) are thin wrappers around this so they
 * stay byte-for-byte in sync and follow the merchant's chosen language.
 *
 * Behavior is deliberately unchanged from the original hand-written screens:
 *  - `scrollGated` reproduces the signup "scroll to bottom before you can accept"
 *    gate; when false (in-app view) the button is always enabled.
 *  - `onClose` / `onAgree` are supplied by the wrapper so navigation and the
 *    setTermsAccepted / setPrivacyAccepted callbacks fire exactly as before.
 */

interface SectionIcon {
  Icon: React.ComponentType<{ className?: string }>;
  color: string; // text color class for the glyph
  bgLight: string;
  bgDark: string;
}

// Per-section decorative icons, matched to the original screens by section index.
// `null` = heading with no icon badge (as in the originals).
const TERMS_ICONS: (SectionIcon | null)[] = [
  { Icon: CheckCircle, color: 'text-blue-500', bgLight: 'bg-blue-50', bgDark: 'bg-blue-500/10' }, // 1 Acceptance
  null,                                                                                            // 2 Eligibility
  { Icon: Shield, color: 'text-emerald-500', bgLight: 'bg-emerald-50', bgDark: 'bg-emerald-500/10' }, // 3 Catalog
  { Icon: Scale, color: 'text-purple-500', bgLight: 'bg-purple-50', bgDark: 'bg-purple-500/10' }, // 4 IP
  null,                                                                                            // 5 Responsibilities
  { Icon: AlertCircle, color: 'text-red-500', bgLight: 'bg-red-50', bgDark: 'bg-red-500/10' },     // 6 Disclaimers
  null, null, null, null,                                                                          // 7-10
];

const PRIVACY_ICONS: (SectionIcon | null)[] = [
  { Icon: Database, color: 'text-blue-500', bgLight: 'bg-blue-50', bgDark: 'bg-blue-500/10' },     // 1 Collect
  { Icon: Eye, color: 'text-emerald-500', bgLight: 'bg-emerald-50', bgDark: 'bg-emerald-500/10' }, // 2 Use
  { Icon: Users, color: 'text-slate-600', bgLight: 'bg-slate-50', bgDark: 'bg-slate-500/10' },     // 3 Sharing
  { Icon: Lock, color: 'text-red-500', bgLight: 'bg-red-50', bgDark: 'bg-red-500/10' },            // 4 Security
  { Icon: Shield, color: 'text-purple-500', bgLight: 'bg-purple-50', bgDark: 'bg-purple-500/10' }, // 5 Rights
  null, null, null,                                                                                // 6-8
];

interface LegalDocViewProps {
  kind: 'terms' | 'privacy';
  theme: 'light' | 'dark';
  onClose: () => void;
  onAgree: () => void;
  scrollGated?: boolean;
  agreeLabel: string;      // enabled-state button label
}

// Split "Label: rest" so the label renders in semibold (list items). Only the
// first colon splits; items without a colon render plain (unchanged behavior).
const boldPrefix = (text: string, isDark: boolean): React.ReactNode => {
  const idx = text.indexOf(':');
  if (idx <= 0 || idx > 40) return text;
  const label = text.slice(0, idx + 1);
  const rest = text.slice(idx + 1);
  return (<><span className="font-semibold">{label}</span>{rest}</>);
};

export const LegalDocView: React.FC<LegalDocViewProps> = ({ kind, theme, onClose, onAgree, scrollGated = false, agreeLabel }) => {
  const isDark = theme === 'dark';
  const { locale } = useTranslation();
  const ui = getLegalUi(locale);
  const doc: LegalDoc = kind === 'terms' ? getTerms(locale) : getPrivacy(locale);
  const icons = kind === 'terms' ? TERMS_ICONS : PRIVACY_ICONS;
  const title = kind === 'terms' ? ui.termsTitle : ui.privacyTitle;

  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 10 && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const HeaderIcon = kind === 'terms' ? FileText : Shield;
  const headerIconColor = kind === 'terms' ? 'text-slate-600' : 'text-blue-500';
  const headerIconBg = kind === 'terms'
    ? (isDark ? 'bg-slate-500/10' : 'bg-slate-50')
    : (isDark ? 'bg-blue-500/10' : 'bg-blue-50');

  const renderBlock = (block: LegalBlock, key: number): React.ReactNode => {
    if ('p' in block) {
      // Contact card: any paragraph carrying an email renders in a bordered card,
      // splitting a leading "Title — details" into a bold title + detail lines.
      if (block.p.includes('@')) {
        const [head, ...restParts] = block.p.split(' — ');
        const rest = restParts.join(' — ');
        const details = rest.split('. ').filter(Boolean);
        return (
          <div key={key} className={`mt-3 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{head}</p>
            {details.map((d, i) => (
              <p key={i} className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{d}</p>
            ))}
          </div>
        );
      }
      return (
        <p key={key} className={`text-sm leading-relaxed ${block.bold ? 'font-semibold' : ''}`}>{block.p}</p>
      );
    }
    if ('sub' in block) {
      return (
        <div key={key}>
          <h4 className={`font-semibold text-sm mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>{block.sub}</h4>
          <p className="text-sm leading-relaxed">{block.text}</p>
        </div>
      );
    }
    // list
    return (
      <ul key={key} className="list-disc list-inside text-sm space-y-2 ml-4">
        {block.ul.map((item: LegalItem, i: number) => {
          if (typeof item === 'string') {
            return <li key={i}>{boldPrefix(item, isDark)}</li>;
          }
          return (
            <li key={i}>
              {boldPrefix(item.text, isDark)}
              <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                {item.sub.map((s, j) => <li key={j}>{boldPrefix(s, isDark)}</li>)}
              </ul>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50">
      <div className="max-w-md mx-auto w-full h-full relative">
        <div className={`absolute inset-0 flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          {/* Header */}
          <div className={`shrink-0 px-5 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${headerIconBg}`}>
                  <HeaderIcon className={`w-5 h-5 ${headerIconColor}`} />
                </div>
                <div>
                  <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{ui.lastUpdated}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scroll hint (signup gate only) */}
          {scrollGated && !hasScrolledToBottom && (
            <div className={`shrink-0 px-5 py-2 flex items-center justify-center gap-2 border-b ${isDark ? 'bg-slate-500/5 border-slate-500/10' : 'bg-slate-50 border-slate-200'}`}>
              <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`} />
              <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{ui.scrollHint}</p>
            </div>
          )}

          {/* Content */}
          <div
            onScroll={scrollGated ? handleScroll : undefined}
            className={`flex-1 min-h-0 overflow-y-auto px-5 py-5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
          >
            <div className="space-y-6">
              {/* Translation disclaimer — English is the binding version. Hidden for en. */}
              {locale !== 'en' && (
                <section className={`p-3 rounded-xl border ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{ui.disclaimer}</p>
                </section>
              )}

              {/* Intro */}
              <section>
                <p className="text-sm leading-relaxed">{doc.intro}</p>
              </section>

              {/* Sections */}
              {doc.sections.map((section, idx) => {
                const icon = icons[idx];
                const bodyIndent = icon ? 'ml-10' : '';
                return (
                  <section key={idx}>
                    <div className="flex items-center gap-2.5 mb-3">
                      {icon && (
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isDark ? icon.bgDark : icon.bgLight}`}>
                          <icon.Icon className={`w-3.5 h-3.5 ${icon.color}`} />
                        </div>
                      )}
                      <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{section.heading}</h3>
                    </div>
                    <div className={`${bodyIndent} text-sm leading-relaxed space-y-3`}>
                      {section.blocks.map((b, i) => renderBlock(b, i))}
                    </div>
                  </section>
                );
              })}

              {/* Acceptance */}
              <section className={`p-4 rounded-xl border ${isDark ? 'bg-slate-500/5 border-slate-500/20' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{doc.acceptance}</p>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-5 py-4 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <button
              onClick={onAgree}
              disabled={scrollGated && !hasScrolledToBottom}
              className={`w-full h-12 rounded-xl text-sm font-medium transition-all ${
                scrollGated && !hasScrolledToBottom
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 text-white active:scale-[0.98]'
              }`}
            >
              {scrollGated && !hasScrolledToBottom ? ui.scrollToContinue : agreeLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
