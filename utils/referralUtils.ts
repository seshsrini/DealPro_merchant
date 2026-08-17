
export const generateWhatsAppReferralLink = (
  phoneNumber: string, // Expects digits only (e.g., "919876543210")
  merchantName: string,
  referralCode: string
): string => {
  const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Ensure digits only

  const messageTemplate = `Hi! This is ${merchantName}. I am using Sreshta to grow my business. Join using my code ${referralCode} and get started here: https://dealpro.app/signup?ref=${referralCode}`;
  const encodedMessage = encodeURIComponent(messageTemplate);

  return `https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`;
};

export const generateWhatsAppConsumerReferralLink = (
  userName: string,
  phoneNumber?: string // Optional phone number
): string => {
  const messageTemplate = `Hey! I'm using Sreshta to discover amazing local deals and save big! 🎉 Join me and start saving today: https://dealpro.app/signup

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
