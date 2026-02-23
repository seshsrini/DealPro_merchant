
export type Locale = 'en' | 'kn' | 'hi' | 'ta' | 'te' | 'ml' | 'bn' | 'mr' | 'gu';

export type AppView = 'splash' | 'welcome' | 'language_selection' | 'login' | 'onboarding' | 'preferences' | 'home' | 'detail' | 'deals_of_day' | 'favorites' | 'profile' | 'merchant_dashboard' | 'merchant_analytics' | 'merchant_deals' | 'merchant_deal_of_day' | 'forgot_password' | 'register' | 'edit_profile' | 'deals' | 'help_feedback' | 'merchant_subscriptions' | 'redemption_survey' | 'campaign_survey' | 'my_redemptions' | 'verify_email' | 'verify_phone' | 'payment_plans' | 'bank_verification' | 'store_search' | 'dealadmin_dashboard' | 'dealadmin_review_deals' | 'dealadmin_edit_deal' | 'dealadmin_analytics' | 'dealadmin_banners' | 'privacy_policy' | 'terms_of_service' | 'privacy_policy_signup' | 'terms_of_service_signup' | 'notifications' | 'merchant_catalogue' | 'merchant_notifications' | 'merchant_ai_insights';

export interface LocalizedNames {
  en: string;
  hi: string;
  kn: string;
  ta: string;
  te: string;
  ml: string;
  bn: string;
  mr: string;
  gu: string;
}

export interface DBState {
  id: number;
  names: LocalizedNames;
  display_name?: string; // Computed for UI
}

export interface DBCity {
  id: number;
  state_id: number;
  names: LocalizedNames;
  display_name?: string; // Computed for UI
}

export interface DBLocality {
  id: number;
  city_id: number;
  pincode: string;
  names: LocalizedNames;
  display_name?: string; // Computed for UI
}

export interface StructuredLocality {
  id: string;
  names: LocalizedNames;
}

export interface MerchantStore {
  id?: string;
  merchant_id: string;
  store_name: string; // Added here
  address: string;
  city: string;
  state: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  store_hrs?: string;
  localized_shop_name?: Record<string, string>; // Added localized_shop_name here
}

export interface MerchantSearchStore {
  id: string;
  store_name: string;
  address: string;
  city: string;
  state: string;
}

export interface SubscriptionTier {
  id: number;
  tier_key: string;
  tier_name: string;
  description: string | null;
  currency: string;
  subscription_fee: number;
  billing_frequency: string;
  trial_period_days: number;
  is_active: boolean;
  features: Record<string, boolean>; // JSONB for features
  created_at: string;
  updated_at: string;
  max_campaigns_per_month: number;
  max_dotd_per_month: number;
  is_multi_store: boolean;
}

export interface Deal {
  // Updated property names to match snake_case from Edge Function
  campaign_id: string; // Changed from 'id' to 'campaign_id'
  merchantId: string;
  shopName: string; // Still used for internal logic/fallback
  thumbnail: string;
  details: string; // Still used for internal logic/fallback
  deal_heading: string; // Changed from 'dealHeading'
  offerValue: string;
  category: string;
  location: string;
  latitude: number | null; // Changed to allow null
  longitude: number | null; // Changed to allow null
  discountCode: string;
  longDescription: string;
  localized_description?: Record<string, string>;
  localized_heading?: Record<string, string>; 
  localized_offer?: Record<string, string>;   
  localized_shop_name?: Record<string, string>; 
  rating: number;
  status?: string;
  comments?: string; // Deal Admin feedback for review
  address?: string; // Still used for internal logic/fallback
  landmark?: string;
  storeHrs?: string;
  start_date?: string; // Changed from 'startDate'
  end_date?: string;   // Changed from 'endDate'
  daysLeft?: number;
  isDealOfTheDay?: boolean;
  is_deal_of_the_day?: boolean; // Database field name (snake_case)
  city?: string; // Still used for internal logic/fallback
  state?: string; // Still used for internal logic/fallback
  
  store_id?: string;
  image_name?: string;

  // Added to reflect the joined structure from get-by-status Edge Function
  merchant_stores?: {
    store_name?: string;
    city?: string;
    address?: string;
    state?: string;
    landmark?: string;
    latitude?: number;
    longitude?: number;
    store_hrs?: string;
  };
}

export interface UserPreferences {
  useNearby: boolean;
  location: string;
  searchRadius?: number;
}

export type PennyDropStatus = 'not_initiated' | 'initiated' | 'verified' | 'failed';

export interface User {
  id: string; 
  username: string;
  isLoggedIn: boolean;
  role: 'consumer' | 'merchant' | 'dealadmin'; // Role now includes 'dealadmin'
  preferences?: UserPreferences;
  email?: string;
  phone?: string;
  full_name?: string; // Changed from fullName to full_name to match DB
  socialHandle?: string;
  // Merchant-specific fields, now optional for all users
  store_name?: string;
  category?: string;
  gstin?: string; // Existing
  pan?: string; // Existing
  my_referral_code?: string; // New field from user_profiles table
  access_token?: string; // Add these to align with App.tsx state
  refresh_token?: string; // Add these to align with App.tsx state
  onboarding_complete?: boolean; // New flag for onboarding status

  // NEW: Bank and KYC fields for merchants
  ifsc_code?: string;
  bank_name?: string;
  branch_name?: string;
  account_number_encrypted?: string; // Explicitly encrypted
  account_type?: 'savings' | 'current' | 'other';
  penny_drop_status?: PennyDropStatus;
  gst_registration_type?: 'Registered' | 'Unregistered' | 'Composition';

  // NEW: Subscription fields for merchants
  hasActiveSubscription?: boolean; // Whether merchant has an active subscription
  subscription_status?: string; // active, cancelled, expired, etc.
  current_tier_id?: number; // Current subscription tier ID
}

export interface ActivityLog {
  user_id: string;
  event_type: 'login' | 'click' | 'view' | 'redeem' | 'refer_friend' | 'refer_partner'; // Added 'redeem', 'refer_friend', 'refer_partner'
  merchant_id?: string;
  campaign_id?: string;
  platform: string;
  metadata?: any;
}

export interface CampaignInteraction {
  id?: string;
  interaction_id?: string;
  consumer_id: string;
  merchant_id: string;
  campaign_id: string;
  platform: string;
  is_redeemed?: boolean;
  redeemed_at?: string;
  atstore_yet?: string;
  claim_no?: string;
  campaign_details?: {
    shop_name: string;
    deal_heading: string;
    offer_value: string;
    image_url: string;
    long_description: string;
    endDate?: string;
    localized_heading?: Record<string, string>;
    localized_offer?: Record<string, string>;
    localized_shop_name?: Record<string, string>;
  };
}
// Added pincode and isPincodeSearching to StoreLocation interface
export interface StoreLocation {
  store_name: string; // Added store_name here
  street: string;
  pincode: string;
  locality: string; // Added locality field
  state: string;
  city: string;
  landmark: string;
  coords: { latitude: number, longitude: number } | null;
  isGeocoding: boolean;
  shift1: string;
  shift2: string;
  is24hrs: boolean;
  isPincodeSearching: boolean; // Added for loading state
}