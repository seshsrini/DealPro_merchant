
export const generateWhatsAppReferralLink = (
  phoneNumber: string, // Expects digits only (e.g., "919876543210")
  merchantName: string,
  referralCode: string
): string => {
  const cleanedPhoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // Ensure digits only

  const messageTemplate = `Hi! This is ${merchantName}. I am using DealPro to grow my business. Join using my code ${referralCode} and get started here: https://dealpro.app/signup?ref=${referralCode}`;
  const encodedMessage = encodeURIComponent(messageTemplate);

  return `https://wa.me/${cleanedPhoneNumber}?text=${encodedMessage}`;
};
