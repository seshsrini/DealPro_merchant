
import { useEffect } from 'react';
import { driver, type DriveStep } from 'driver.js';

interface FeatureTourProps {
  userId: string;
  theme: 'light' | 'dark';
}

const TOUR_STEPS: DriveStep[] = [
  {
    element: '#tour-store-info',
    popover: {
      title: 'Your Store',
      description: 'This is your store dashboard — your command centre for managing deals, tracking performance, and growing your business.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-campaign-usage',
    popover: {
      title: 'Campaign Usage',
      description: 'Track how many campaigns and Deal of the Day slots you\'ve used this month. Upgrade your plan anytime to get more.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-new-deal',
    popover: {
      title: 'Create a New Deal',
      description: 'Tap here to create a new deal campaign. Add a catchy title, offer value, description, and an image to attract customers.',
      side: 'top',
      align: 'start',
    },
  },
  {
    element: '#tour-scan-verify',
    popover: {
      title: 'Scan & Verify',
      description: 'When a customer shows their coupon QR code, tap here to scan and verify it instantly. Quick and secure redemption!',
      side: 'top',
      align: 'end',
    },
  },
  {
    element: '#tour-festival-banner',
    popover: {
      title: 'Festival Deals',
      description: 'Stay ahead of upcoming festivals! Create special seasonal deals to boost your sales during peak shopping periods.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#tour-nav-campaigns',
    popover: {
      title: 'My Campaigns',
      description: 'View, edit, and manage all your deal campaigns. Track their status — under review, active, or expired.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#tour-nav-catalogue',
    popover: {
      title: 'My Catalogue',
      description: 'Build your product catalogue to showcase your best offerings. Customers can browse your catalogue from the consumer app.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#tour-nav-dotd',
    popover: {
      title: 'Deal of the Day',
      description: 'Feature your best deal as the "Deal of the Day" for maximum visibility. This gets prime placement on the consumer app!',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#tour-nav-intel',
    popover: {
      title: 'Intel & Analytics',
      description: 'See how your deals are performing — views, claims, redemptions, and revenue insights. Make data-driven decisions.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#tour-nav-hub',
    popover: {
      title: 'Your Hub',
      description: 'Manage your profile, subscription plan, store locations, and app settings from here. You\'re all set — let\'s create your first deal!',
      side: 'top',
      align: 'center',
    },
  },
];

const TOUR_STORAGE_KEY = (userId: string) => `dealpro_tour_completed_${userId}`;

export const FeatureTour: React.FC<FeatureTourProps> = ({ userId, theme }) => {

  useEffect(() => {
    const tourKey = TOUR_STORAGE_KEY(userId);
    const hasCompleted = localStorage.getItem(tourKey);
    console.log('[FeatureTour] Effect running. tourKey:', tourKey, 'hasCompleted:', hasCompleted);

    if (hasCompleted === 'true') {
      console.log('[FeatureTour] Tour already completed, skipping');
      return;
    }

    let driverObj: ReturnType<typeof driver> | null = null;

    // Wait for DOM to settle after render
    const timer = setTimeout(() => {
      // Filter steps to only include elements that exist in the DOM
      const availableSteps = TOUR_STEPS.filter(step => {
        if (!step.element) return true;
        const exists = document.querySelector(step.element as string) !== null;
        console.log('[FeatureTour] Step', step.element, exists ? 'FOUND' : 'MISSING');
        return exists;
      });

      console.log('[FeatureTour] Available steps:', availableSteps.length, '/', TOUR_STEPS.length);

      if (availableSteps.length === 0) {
        console.warn('[FeatureTour] No tour elements found in DOM');
        return;
      }

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
            console.log('[FeatureTour] Tour completed, saving to localStorage');
            localStorage.setItem(tourKey, 'true');
            driverObj?.destroy();
          },
        });

        console.log('[FeatureTour] Launching tour...');
        driverObj.drive();
      } catch (err) {
        console.error('[FeatureTour] Error starting tour:', err);
      }
    }, 1500);

    // Cleanup: destroy tour and clear timer on unmount
    return () => {
      clearTimeout(timer);
      if (driverObj) {
        try { driverObj.destroy(); } catch (_) { /* already destroyed */ }
      }
    };
  }, [userId, theme]);

  return null;
};

export const resetFeatureTour = (userId: string) => {
  localStorage.removeItem(TOUR_STORAGE_KEY(userId));
};
