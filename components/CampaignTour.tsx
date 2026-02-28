
import React, { useEffect } from 'react';
import { driver, type DriveStep } from 'driver.js';

interface CampaignTourProps {
  userId: string;
  theme: 'light' | 'dark';
}

const TOUR_STEPS: DriveStep[] = [
  {
    element: '#ctour-usage',
    popover: {
      title: 'Campaign Usage',
      description: 'See how many campaigns and Deal of the Day slots you\'ve used this month. When you hit the limit, upgrade your plan.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#ctour-new-deal',
    popover: {
      title: 'Create a New Deal',
      description: 'Tap here to create a new campaign step by step. Upload an image, write a headline, set your offer, and publish!',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#ctour-modify-deal',
    popover: {
      title: 'Modify Existing Deal',
      description: 'Want to update a live campaign? Tap here to scroll to your deals list, then tap Edit on any deal.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#ctour-tabs',
    popover: {
      title: 'Campaign Status',
      description: 'Track your campaigns here — Live (currently active) and Expired (past deals). Tap any deal\'s Edit button to modify it.',
      side: 'top',
      align: 'center',
    },
  },
];

const TOUR_STORAGE_KEY = (userId: string) => `dealpro_campaign_tour_v2_${userId}`;

export const CampaignTour: React.FC<CampaignTourProps> = ({ userId, theme }) => {

  useEffect(() => {
    const tourKey = TOUR_STORAGE_KEY(userId);
    const hasCompleted = localStorage.getItem(tourKey);

    if (hasCompleted === 'true') return;

    let driverObj: ReturnType<typeof driver> | null = null;

    const timer = setTimeout(() => {
      const availableSteps = TOUR_STEPS.filter(step => {
        if (!step.element) return true;
        return document.querySelector(step.element as string) !== null;
      });

      if (availableSteps.length === 0) return;

      const isDark = theme === 'dark';

      try {
        driverObj = driver({
          showProgress: true,
          showButtons: ['next', 'previous'],
          steps: availableSteps,
          popoverClass: isDark ? 'dealpro-tour-dark' : 'dealpro-tour-light',
          overlayColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.6)',
          stagePadding: 8,
          stageRadius: 12,
          animate: true,
          allowClose: true,
          nextBtnText: 'Next',
          prevBtnText: 'Back',
          doneBtnText: 'Got It!',
          progressText: '{{current}} of {{total}}',
          onDestroyStarted: () => {
            localStorage.setItem(tourKey, 'true');
            driverObj?.destroy();
          },
        });

        driverObj.drive();
      } catch (err) {
        console.error('[CampaignTour] Error starting tour:', err);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (driverObj) {
        try { driverObj.destroy(); } catch (_) { /* already destroyed */ }
      }
    };
  }, [userId, theme]);

  return null;
};

export const resetCampaignTour = (userId: string) => {
  localStorage.removeItem(TOUR_STORAGE_KEY(userId));
};
