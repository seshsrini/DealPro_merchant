import { PLAY_LISTING_CONSUMER, PLAY_LISTING_MERCHANT, playListingWithReferral } from './appLinks';

export const generateWhatsAppReferralLink = (
  phoneNumber: string, // Expects digits only (e.g., "919876543210")
  merchantName: string,
  referralCode: string
): string => {
  const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Ensure digits only

  const link = playListingWithReferral(PLAY_LISTING_MERCHANT, referralCode);
  const messageTemplate = `Hi! This is ${merchantName}. I am using DealFynd to grow my business. Join using my code ${referralCode} and get started here: ${link}`;
  const encodedMessage = encodeURIComponent(messageTemplate);

  return `https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`;
};

export const generateWhatsAppConsumerReferralLink = (
  userName: string,
  phoneNumber?: string // Optional phone number
): string => {
  const messageTemplate = `Hey! I'm using DealFynd to discover amazing local deals and save big! 🎉 Join me and start saving today: ${PLAY_LISTING_CONSUMER}

Shared by ${userName}`;
  const encodedMessage = encodeURIComponent(messageTemplate);

  // If phone number provided, try to use it, otherwise just open WhatsApp with message
  if (phoneNumber) {
    const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`;
  }

  // Without phone number, opens WhatsApp and lets user choose recipient
  return `https://wa.me/?text=${encodedMessage}`;
};
