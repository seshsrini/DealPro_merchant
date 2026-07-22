import React from 'react';
import { AppView } from './types';
import { LegalDocView } from './LegalDocView';
import { getLegalUi } from './contexts/legalContent';
import { useTranslation } from './contexts/LanguageContext';

interface PrivacyPolicySignupProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
  setPrivacyAccepted: (accepted: boolean) => void;
}

// Signup Privacy Policy (also wrapped by the onboarding wizard step). Behavior is
// unchanged: scroll-to-bottom gate, then accept → setPrivacyAccepted(true) +
// navigate to 'register'; close (X) → 'register'.
export const PrivacyPolicySignup: React.FC<PrivacyPolicySignupProps> = ({ setView, theme, setPrivacyAccepted }) => {
  const { locale } = useTranslation();
  const handleAgree = () => {
    setPrivacyAccepted(true);
    setView('register');
  };
  return (
    <LegalDocView
      kind="privacy"
      theme={theme}
      scrollGated
      onClose={() => setView('register')}
      onAgree={handleAgree}
      agreeLabel={getLegalUi(locale).agreeTerms}
    />
  );
};
