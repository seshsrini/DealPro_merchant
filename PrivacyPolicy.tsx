import React from 'react';
import { AppView } from './types';
import { LegalDocView } from './LegalDocView';
import { getLegalUi } from './contexts/legalContent';
import { useTranslation } from './contexts/LanguageContext';

interface PrivacyPolicyProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
}

// In-app Privacy Policy (opened from Profile). Content is localized + shared via
// <LegalDocView/>; navigation behavior (close → login) is unchanged.
export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ setView, theme }) => {
  const { locale } = useTranslation();
  return (
    <LegalDocView
      kind="privacy"
      theme={theme}
      onClose={() => setView('login')}
      onAgree={() => setView('login')}
      agreeLabel={getLegalUi(locale).understand}
    />
  );
};
