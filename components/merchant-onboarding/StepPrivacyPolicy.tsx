import React from 'react';
import { PrivacyPolicySignup } from '../../PrivacyPolicySignup';
import { AppView } from '../../types';

interface StepPrivacyPolicyProps {
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepPrivacyPolicy: React.FC<StepPrivacyPolicyProps> = ({ onNext, onBack, theme }) => {
  let accepted = false;

  const handlePrivacyAccepted = (val: boolean) => {
    if (val) {
      accepted = true;
      onNext();
    }
  };

  // Adapt PrivacyPolicySignup's navigation to wizard flow
  const handleSetView = (view: AppView) => {
    // Ignore setView('register') after accepting — onNext already handled navigation
    if (view === 'register' && !accepted) onBack();
  };

  return (
    <PrivacyPolicySignup
      setView={handleSetView}
      theme={theme}
      setPrivacyAccepted={handlePrivacyAccepted}
    />
  );
};
