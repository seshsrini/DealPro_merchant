import React from 'react';
import { AppView } from './types';
import { LegalDocView } from './LegalDocView';
import { getLegalUi } from './contexts/legalContent';
import { useTranslation } from './contexts/LanguageContext';

interface TermsOfServiceSignupProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
  setTermsAccepted: (accepted: boolean) => void;
}

// Signup Terms of Service (also wrapped by the onboarding wizard step). Behavior
// is unchanged: scroll-to-bottom gate, then accept → setTermsAccepted(true) +
// navigate to 'register'; close (X) → 'register'.
export const TermsOfServiceSignup: React.FC<TermsOfServiceSignupProps> = ({ setView, theme, setTermsAccepted }) => {
  const { locale } = useTranslation();
  const handleAgree = () => {
    setTermsAccepted(true);
    setView('register');
  };
  return (
    <LegalDocView
      kind="terms"
      theme={theme}
      scrollGated
      onClose={() => setView('register')}
      onAgree={handleAgree}
      agreeLabel={getLegalUi(locale).agreeTerms}
    />
  );
};
