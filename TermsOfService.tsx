import React from 'react';
import { AppView } from './types';
import { LegalDocView } from './LegalDocView';
import { getLegalUi } from './contexts/legalContent';
import { useTranslation } from './contexts/LanguageContext';

interface TermsOfServiceProps {
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
}

// In-app Terms of Service (opened from Profile). Content is localized + shared
// via <LegalDocView/>; navigation behavior (close → login) is unchanged.
export const TermsOfService: React.FC<TermsOfServiceProps> = ({ setView, theme }) => {
  const { locale } = useTranslation();
  return (
    <LegalDocView
      kind="terms"
      theme={theme}
      onClose={() => setView('login')}
      onAgree={() => setView('login')}
      agreeLabel={getLegalUi(locale).iAgree}
    />
  );
};
