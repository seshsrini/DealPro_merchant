import React from 'react';
import { TermsOfServiceSignup } from '../../TermsOfServiceSignup';
import { AppView } from '../../types';

interface StepTermsOfServiceProps {
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepTermsOfService: React.FC<StepTermsOfServiceProps> = ({ onNext, onBack, theme }) => {
  // Track whether terms were accepted to avoid the back-navigation
  // that TermsOfServiceSignup triggers after calling setTermsAccepted
  let accepted = false;

  const handleTermsAccepted = (val: boolean) => {
    if (val) {
      accepted = true;
      onNext();
    }
  };

  // Adapt TermsOfServiceSignup's navigation to wizard flow
  const handleSetView = (view: AppView) => {
    // When terms component calls setView('register') after accepting,
    // ignore it — onNext already handled navigation
    if (view === 'register' && !accepted) onBack();
  };

  return (
    <TermsOfServiceSignup
      setView={handleSetView}
      theme={theme}
      setTermsAccepted={handleTermsAccepted}
    />
  );
};
