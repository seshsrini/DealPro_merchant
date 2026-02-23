-- Schema dump: DEV → QA
-- Generated: 2026-02-17T16:18:40.101Z

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- SEQUENCES (must exist before tables with SERIAL columns)
CREATE SEQUENCE IF NOT EXISTS public.campaign_interactions_interaction_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.cities_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.localities_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_audit_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_bank_details_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_invites_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_payments_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_referrals_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_subscriptions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_usage_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.states_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.store_categories_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.subscription_audit_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.subscription_tiers_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.user_activity_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;

-- ENUM TYPES (must exist before tables)
CREATE TYPE public.campaign_status AS ENUM ('review', 'active', 'expired', 'needs review');
CREATE TYPE public.log_level AS ENUM ('warning', 'error', 'critical');
CREATE TYPE public.user_role AS ENUM ('user', 'merchant');
CREATE TYPE public.user_type AS ENUM ('consumer', 'merchant', 'system');

-- TABLES
CREATE TABLE IF NOT EXISTS public.app_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  user_role user_type NOT NULL,
  level log_level DEFAULT 'error'::log_level,
  status_code int4,
  message text NOT NULL,
  endpoint text,
  stack_trace text,
  metadata jsonb DEFAULT '{}'::jsonb,
  context_module text
);

CREATE TABLE IF NOT EXISTS public.campaign_interactions (
  interaction_id int8 DEFAULT nextval('campaign_interactions_interaction_id_seq'::regclass) NOT NULL,
  consumer_id varchar(255) NOT NULL,
  merchant_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  click_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  is_redeemed bool DEFAULT false,
  redeemed_at timestamptz,
  platform varchar(50),
  atstore_yet text DEFAULT ''::text,
  claim_no text,
  modified_at timestamptz DEFAULT now(),
  is_dotd bool DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  campaign_id uuid DEFAULT gen_random_uuid() NOT NULL,
  merchant_id uuid,
  shop_name text NOT NULL,
  deal_heading text NOT NULL,
  category text NOT NULL,
  latlong text NOT NULL,
  offer_value text NOT NULL,
  long_description varchar,
  status campaign_status DEFAULT 'review'::campaign_status,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  is_deal_of_the_day bool DEFAULT false,
  created_at timestamptz DEFAULT now(),
  store_id uuid,
  last_modified timestamptz DEFAULT now(),
  image_url text,
  image_name text,
  localized_description jsonb DEFAULT '{"en": "Standard DealPro incentive protocol.", "hi": "मानक DealPro प्रोत्साहन प्रोटोकॉल।", "kn": "Standard DealPro ಪ್ರೋತ್ಸಾಹಕ ಪ್ರೋಟೋಕಾಲ್."}'::jsonb,
  localized_heading jsonb DEFAULT '{}'::jsonb,
  localized_offer jsonb DEFAULT '{}'::jsonb,
  localized_shop_name jsonb DEFAULT '{}'::jsonb,
  modified_at timestamptz DEFAULT now(),
  comments text
);

CREATE TABLE IF NOT EXISTS public.cities (
  id int4 DEFAULT nextval('cities_id_seq'::regclass) NOT NULL,
  state_id int4,
  name_code varchar(100),
  names jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id int8 NOT NULL,
  user_id uuid,
  campaign_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  merchant_id uuid,
  campaign_status text,
  active_favorite bool DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  device_token text NOT NULL,
  device_type text,
  device_name text,
  app_version text,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hoardings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  hoarding_no text NOT NULL,
  topic text,
  heading text NOT NULL,
  description text,
  images text[] DEFAULT '{}'::text[],
  created_at timestamptz DEFAULT now(),
  modified_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.localities (
  id int4 DEFAULT nextval('localities_id_seq'::regclass) NOT NULL,
  city_id int4,
  pincode varchar(10),
  names jsonb NOT NULL,
  modified_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_audit_logs (
  id int8 DEFAULT nextval('merchant_audit_logs_id_seq'::regclass) NOT NULL,
  merchant_id varchar(255) NOT NULL,
  action_group text,
  action_type text,
  entity_id varchar(255),
  change_summary text,
  old_data jsonb,
  new_data jsonb,
  ip_address varchar(45),
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.merchant_bank_details (
  id int8 DEFAULT nextval('merchant_bank_details_id_seq'::regclass) NOT NULL,
  merchant_id varchar(255) NOT NULL,
  account_holder_name varchar(255) NOT NULL,
  account_number_encrypted text NOT NULL,
  account_type varchar(20) DEFAULT 'current'::character varying,
  ifsc_code varchar(11) NOT NULL,
  bank_name varchar(100),
  branch_name varchar(255),
  is_verified bool DEFAULT false,
  penny_drop_status varchar(20),
  pan_number varchar(10),
  gst_registration_type varchar(50),
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.merchant_images (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  image_name text NOT NULL,
  image_url text NOT NULL,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_modified_at timestamptz DEFAULT now(),
  consumer_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.merchant_invites (
  id int8 DEFAULT nextval('merchant_invites_id_seq'::regclass) NOT NULL,
  referrer_id varchar(255) NOT NULL,
  invitee_phone varchar(20) NOT NULL,
  invite_code varchar(50) NOT NULL,
  status varchar(20) DEFAULT 'sent'::character varying,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_payments (
  id int8 DEFAULT nextval('merchant_payments_id_seq'::regclass) NOT NULL,
  merchant_id varchar(255) NOT NULL,
  subscription_id int8,
  transaction_id varchar(255),
  order_id varchar(255) NOT NULL,
  amount_base numeric(12,2) NOT NULL,
  amount_total numeric(12,2) NOT NULL,
  currency varchar(3) DEFAULT 'INR'::character varying,
  gst_rate_percent numeric(5,2) DEFAULT 18.00,
  cgst_amount numeric(12,2) DEFAULT 0.00,
  sgst_amount numeric(12,2) DEFAULT 0.00,
  igst_amount numeric(12,2) DEFAULT 0.00,
  hsn_sac_code varchar(10) DEFAULT '9983'::character varying,
  merchant_gstin varchar(15),
  billing_state varchar(50),
  payment_method varchar(20),
  payment_status varchar(20),
  failure_reason text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.merchant_ratings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  consumer_id uuid,
  merchant_id uuid,
  campaign_id uuid,
  rating numeric(2,1),
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_referrals (
  id int8 DEFAULT nextval('merchant_referrals_id_seq'::regclass) NOT NULL,
  referrer_id varchar(255) NOT NULL,
  referee_id varchar(255) NOT NULL,
  referral_code_used varchar(50),
  status varchar(20) DEFAULT 'pending'::character varying,
  qualified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_stores (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  merchant_id uuid NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  landmark text,
  latitude float8,
  longitude float8,
  created_at timestamptz DEFAULT timezone('utc'::text, now()),
  store_hrs text,
  pincode text NOT NULL,
  store_name text,
  locality text
);

CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
  id int8 DEFAULT nextval('merchant_subscriptions_id_seq'::regclass) NOT NULL,
  merchant_id varchar(255) NOT NULL,
  plan_name varchar(50) NOT NULL,
  status varchar(20) NOT NULL,
  gateway_customer_id varchar(255),
  mandate_id varchar(255),
  subscription_id varchar(255),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end bool DEFAULT false,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  billing_cycle_day int4,
  billing_type varchar(20) DEFAULT 'advance'::character varying,
  last_billed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.merchant_usage (
  id int4 DEFAULT nextval('merchant_usage_id_seq'::regclass) NOT NULL,
  merchant_id varchar(255) NOT NULL,
  subscription_id int8,
  feature_key varchar(50) NOT NULL,
  current_usage_count int4 DEFAULT 0,
  billing_period_start timestamptz NOT NULL,
  billing_period_end timestamptz NOT NULL,
  last_updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pinned_deals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  merchant_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  active_status bool DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  username text NOT NULL,
  email text,
  phone text,
  role user_role DEFAULT 'user'::user_role,
  store_name text,
  business_category text,
  gstin text,
  pan text,
  avatar_url text,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  active_status varchar
);

CREATE TABLE IF NOT EXISTS public.spatial_ref_sys (
  srid int4 NOT NULL,
  auth_name varchar(256),
  auth_srid int4,
  srtext varchar(2048),
  proj4text varchar(2048)
);

CREATE TABLE IF NOT EXISTS public.states (
  id int4 DEFAULT nextval('states_id_seq'::regclass) NOT NULL,
  name_code varchar(50),
  names jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.store_categories (
  id int4 DEFAULT nextval('store_categories_id_seq'::regclass) NOT NULL,
  category_name text NOT NULL,
  active_status bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  modified_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stores (
  store_id uuid DEFAULT gen_random_uuid() NOT NULL,
  merchant_id uuid,
  address_line text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  landmark text,
  latitude numeric(10,8) NOT NULL,
  longitude numeric(11,8) NOT NULL,
  geo_location geography,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
  id int8 DEFAULT nextval('subscription_audit_logs_id_seq'::regclass) NOT NULL,
  subscription_id int8,
  merchant_id varchar(255) NOT NULL,
  action_type varchar(50) NOT NULL,
  old_plan_data jsonb,
  new_plan_data jsonb,
  change_source varchar(20) DEFAULT 'MERCHANT'::character varying,
  remarks text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.subscription_tiers (
  id int4 DEFAULT nextval('subscription_tiers_id_seq'::regclass) NOT NULL,
  tier_key text NOT NULL,
  tier_name varchar(100) NOT NULL,
  description text,
  currency varchar(3) DEFAULT 'INR'::character varying,
  subscription_fee numeric(12,2) NOT NULL,
  billing_frequency varchar(20) NOT NULL,
  trial_period_days int4 DEFAULT 0,
  is_active bool DEFAULT true,
  features jsonb,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  max_campaigns_per_month int4 DEFAULT 1,
  max_dotd_per_month int4 DEFAULT 0,
  is_multi_store bool DEFAULT false,
  modified_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transaction_claims (
  claim_id uuid DEFAULT gen_random_uuid() NOT NULL,
  consumer_id uuid,
  merchant_id uuid,
  campaign_id uuid,
  status text DEFAULT 'pending'::text,
  created_at timestamptz DEFAULT now(),
  redeemed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id int8 DEFAULT nextval('user_activity_logs_id_seq'::regclass) NOT NULL,
  user_id varchar(255) NOT NULL,
  event_type varchar(50) NOT NULL,
  merchant_id uuid,
  campaign_id varchar(255),
  platform varchar(50),
  metadata jsonb,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  role text
);

CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  device_token text NOT NULL,
  device_type text NOT NULL,
  device_name text,
  app_version text,
  is_active bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  campaign_id uuid,
  merchant_id uuid,
  type text DEFAULT 'new_deal'::text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  is_read bool DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  username text,
  email text,
  phone text NOT NULL,
  role text DEFAULT 'merchant'::text NOT NULL,
  store_name text,
  category text DEFAULT 'General'::text,
  gstin text,
  pan text,
  active_status bool DEFAULT true,
  created_at timestamptz DEFAULT now(),
  full_name text,
  first_login_at timestamptz,
  my_referral_code varchar(50),
  lang_preference text,
  home_location text,
  push_notification bool DEFAULT true,
  email_notification bool DEFAULT false,
  text_notification bool DEFAULT false
);

-- PRIMARY KEYS
ALTER TABLE public.app_logs ADD CONSTRAINT app_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_pkey PRIMARY KEY (interaction_id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id);
ALTER TABLE public.cities ADD CONSTRAINT cities_pkey PRIMARY KEY (id);
ALTER TABLE public.favorites ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);
ALTER TABLE public.fcm_tokens ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.hoardings ADD CONSTRAINT hoardings_pkey PRIMARY KEY (id);
ALTER TABLE public.localities ADD CONSTRAINT localities_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_audit_logs ADD CONSTRAINT merchant_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_bank_details ADD CONSTRAINT merchant_bank_details_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_images ADD CONSTRAINT merchant_images_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_invites ADD CONSTRAINT merchant_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_payments ADD CONSTRAINT merchant_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_ratings ADD CONSTRAINT merchant_ratings_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_referrals ADD CONSTRAINT merchant_referrals_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_stores ADD CONSTRAINT merchant_stores_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_subscriptions ADD CONSTRAINT merchant_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_usage ADD CONSTRAINT merchant_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.pinned_deals ADD CONSTRAINT pinned_deals_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.spatial_ref_sys ADD CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid);
ALTER TABLE public.states ADD CONSTRAINT states_pkey PRIMARY KEY (id);
ALTER TABLE public.store_categories ADD CONSTRAINT store_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.stores ADD CONSTRAINT stores_pkey PRIMARY KEY (store_id);
ALTER TABLE public.subscription_audit_logs ADD CONSTRAINT subscription_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.subscription_tiers ADD CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id);
ALTER TABLE public.transaction_claims ADD CONSTRAINT transaction_claims_pkey PRIMARY KEY (claim_id);
ALTER TABLE public.user_activity_logs ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_pkey PRIMARY KEY (id);

-- UNIQUE CONSTRAINTS
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_claim_no_unique UNIQUE (claim_no);
ALTER TABLE public.fcm_tokens ADD CONSTRAINT fcm_tokens_device_token_key UNIQUE (device_token);
ALTER TABLE public.hoardings ADD CONSTRAINT hoardings_hoarding_no_key UNIQUE (hoarding_no);
ALTER TABLE public.merchant_bank_details ADD CONSTRAINT merchant_bank_details_merchant_id_key UNIQUE (merchant_id);
ALTER TABLE public.merchant_invites ADD CONSTRAINT merchant_invites_referrer_id_invitee_phone_key UNIQUE (referrer_id, invitee_phone);
ALTER TABLE public.merchant_payments ADD CONSTRAINT merchant_payments_transaction_id_key UNIQUE (transaction_id);
ALTER TABLE public.merchant_referrals ADD CONSTRAINT merchant_referrals_referee_id_key UNIQUE (referee_id);
ALTER TABLE public.merchant_subscriptions ADD CONSTRAINT merchant_subscriptions_subscription_id_key UNIQUE (subscription_id);
ALTER TABLE public.merchant_usage ADD CONSTRAINT merchant_usage_merchant_id_feature_key_billing_period_start_key UNIQUE (merchant_id, feature_key, billing_period_start);
ALTER TABLE public.pinned_deals ADD CONSTRAINT pinned_deals_user_id_campaign_id_key UNIQUE (user_id, campaign_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gstin_key UNIQUE (gstin);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pan_key UNIQUE (pan);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE public.states ADD CONSTRAINT states_name_code_key UNIQUE (name_code);
ALTER TABLE public.store_categories ADD CONSTRAINT store_categories_category_name_key UNIQUE (category_name);
ALTER TABLE public.subscription_tiers ADD CONSTRAINT subscription_tiers_tier_key_key UNIQUE (tier_key);
ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_device_token_key UNIQUE (device_token);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_email_key UNIQUE (email);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_gstin_key UNIQUE (gstin);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_my_referral_code_key UNIQUE (my_referral_code);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_pan_key UNIQUE (pan);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_username_key UNIQUE (username);
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_phone_key UNIQUE (phone);

-- FOREIGN KEYS
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns (campaign_id);
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.user_profiles (id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.user_profiles (id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.merchant_stores (id);
ALTER TABLE public.cities ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states (id);
ALTER TABLE public.favorites ADD CONSTRAINT favorites_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns (campaign_id);
ALTER TABLE public.favorites ADD CONSTRAINT fk_favorites_merchant FOREIGN KEY (merchant_id) REFERENCES public.user_profiles (id);
ALTER TABLE public.localities ADD CONSTRAINT localities_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities (id);
ALTER TABLE public.merchant_payments ADD CONSTRAINT merchant_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.merchant_subscriptions (id);
ALTER TABLE public.merchant_ratings ADD CONSTRAINT fk_merchant_ratings_campaign FOREIGN KEY (campaign_id) REFERENCES public.campaigns (campaign_id);
ALTER TABLE public.merchant_ratings ADD CONSTRAINT fk_merchant_ratings_merchant FOREIGN KEY (merchant_id) REFERENCES public.user_profiles (id);
ALTER TABLE public.merchant_stores ADD CONSTRAINT merchant_stores_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.user_profiles (id);
ALTER TABLE public.merchant_usage ADD CONSTRAINT merchant_usage_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.merchant_subscriptions (id);
ALTER TABLE public.pinned_deals ADD CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES public.campaigns (campaign_id);
ALTER TABLE public.stores ADD CONSTRAINT stores_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.profiles (id);
ALTER TABLE public.subscription_audit_logs ADD CONSTRAINT subscription_audit_logs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.merchant_subscriptions (id);
ALTER TABLE public.transaction_claims ADD CONSTRAINT transaction_claims_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns (campaign_id);
ALTER TABLE public.transaction_claims ADD CONSTRAINT transaction_claims_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES public.user_profiles (id);
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns (campaign_id);

-- INDEXES
CREATE INDEX idx_logs_status_code ON public.app_logs USING btree (status_code);
CREATE INDEX idx_logs_user_role ON public.app_logs USING btree (user_role);
CREATE INDEX idx_campaign_interactions_claim_no ON public.campaign_interactions USING btree (claim_no);
CREATE INDEX idx_interactions_campaign ON public.campaign_interactions USING btree (campaign_id);
CREATE INDEX idx_interactions_consumer ON public.campaign_interactions USING btree (consumer_id);
CREATE INDEX idx_interactions_merchant ON public.campaign_interactions USING btree (merchant_id);
CREATE INDEX idx_campaigns_dates ON public.campaigns USING btree (start_date, end_date);
CREATE INDEX idx_campaigns_latlong ON public.campaigns USING btree (latlong);
CREATE INDEX idx_campaigns_merchant ON public.campaigns USING btree (merchant_id);
CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);
CREATE INDEX idx_favorites_consumer ON public.favorites USING btree (user_id);
CREATE INDEX idx_fcm_tokens_device_token ON public.fcm_tokens USING btree (device_token);
CREATE INDEX idx_fcm_tokens_last_used ON public.fcm_tokens USING btree (last_used_at);
CREATE INDEX idx_fcm_tokens_user_id ON public.fcm_tokens USING btree (user_id) WHERE (is_active = true);
CREATE INDEX idx_localities_city ON public.localities USING btree (city_id);
CREATE INDEX idx_localities_names_gin ON public.localities USING gin (names);
CREATE INDEX idx_localities_pincode ON public.localities USING btree (pincode varchar_pattern_ops);
CREATE INDEX idx_merchant_logs_group ON public.merchant_audit_logs USING btree (action_group);
CREATE INDEX idx_merchant_logs_id ON public.merchant_audit_logs USING btree (merchant_id);
CREATE INDEX idx_bank_merchant ON public.merchant_bank_details USING btree (merchant_id);
CREATE INDEX idx_pay_merchant_state ON public.merchant_payments USING btree (merchant_id, billing_state);
CREATE INDEX idx_pay_transaction_id ON public.merchant_payments USING btree (transaction_id);
CREATE INDEX idx_merchant_stores_merchant_id ON public.merchant_stores USING btree (merchant_id);
CREATE INDEX idx_sub_merchant_id ON public.merchant_subscriptions USING btree (merchant_id);
CREATE INDEX idx_usage_lookup ON public.merchant_usage USING btree (merchant_id, feature_key);
CREATE INDEX idx_pinned_deals_campaign_id ON public.pinned_deals USING btree (campaign_id);
CREATE INDEX idx_pinned_deals_created_at ON public.pinned_deals USING btree (created_at DESC);
CREATE INDEX idx_pinned_deals_merchant_id ON public.pinned_deals USING btree (merchant_id);
CREATE INDEX idx_pinned_deals_user_campaign ON public.pinned_deals USING btree (user_id, campaign_id);
CREATE INDEX idx_pinned_deals_user_id ON public.pinned_deals USING btree (user_id);
CREATE INDEX idx_stores_merchant ON public.stores USING btree (merchant_id);
CREATE INDEX idx_user_logs_event_type ON public.user_activity_logs USING btree (event_type);
CREATE INDEX idx_user_logs_user_id ON public.user_activity_logs USING btree (user_id);
CREATE INDEX idx_user_notifications_unread ON public.user_notifications USING btree (user_id, is_read) WHERE (is_read = false);
CREATE INDEX idx_user_notifications_user_id ON public.user_notifications USING btree (user_id);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.authorize_claim_v2(p_claim_id text, p_merchant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_full_claim_id UUID;
    v_target_merchant_id UUID;
    v_match_count INT;
BEGIN
    -- 1. Count matches
    SELECT count(*) INTO v_match_count
    FROM merchant_ratings 
    WHERE id::text ILIKE p_claim_id || '%';

    IF v_match_count = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CLAIM', 'message', 'Claim ID not recognized.');
    END IF;

    IF v_match_count > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'AMBIGUOUS', 'message', 'Multiple matches. Enter more characters.');
    END IF;

    -- 2. Fetch data
    SELECT id, merchant_id INTO v_full_claim_id, v_target_merchant_id
    FROM merchant_ratings 
    WHERE id::text ILIKE p_claim_id || '%'
    LIMIT 1;

    -- 3. Verify Merchant
    IF v_target_merchant_id != p_merchant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'This voucher belongs to another store.');
    END IF;

    -- 4. Update with CORRECT CAPITALIZATION ('Yes' instead of 'yes')
    UPDATE merchant_ratings
    SET 
        claim_status = 'redeemed',
        atstore_yet = 'Yes', 
        redeemed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_full_claim_id;

    RETURN jsonb_build_object('success', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_old_fcm_tokens()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Delete tokens that haven't been used in 90 days
  DELETE FROM public.fcm_tokens
  WHERE last_used_at < NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Cleaned up old FCM tokens';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_campaigns_in_radius(user_lat double precision, user_lng double precision, search_radius_km double precision)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    jsonb_build_object(
      -- We must explicitly name the keys to match what your .map() function expects
      'campaign_id', c.campaign_id,
      'merchant_id', c.merchant_id,
      'shop_name', c.shop_name,
      'deal_heading', c.deal_heading,
      'offer_value', c.offer_value,
      'category', c.category,
      'image_url', c.image_url,
      'status', c.status,
      'latlong', c.latlong,
      'long_description', c.long_description,
      'start_date', c.start_date,
      'end_date', c.end_date,
      'localized_description', c.localized_description,
      'localized_heading', c.localized_heading,
      'localized_offer', c.localized_offer,
      'localized_shop_name', c.localized_shop_name,
      'image_name', c.image_name,
      -- Nest the store data
      'merchant_stores', jsonb_build_object(
        'address', s.address,
        'city', s.city,
        'state', s.state,
        'landmark', s.landmark,
        'latitude', s.latitude,
        'longitude', s.longitude,
        'store_hrs', s.store_hrs
      )
    )
  FROM campaigns c
  JOIN merchant_stores s ON c.store_id = s.id
  WHERE c.status = 'active'
    AND (
      6371 * acos(
        cos(radians(user_lat)) * cos(radians(s.latitude)) * cos(radians(s.longitude) - radians(user_lng)) + 
        sin(radians(user_lat)) * sin(radians(s.latitude))
      )
    ) <= search_radius_km;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pinned_deals_count(p_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.pinned_deals
    WHERE user_id = p_user_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_campaign_pinned(p_user_id uuid, p_campaign_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.pinned_deals
    WHERE user_id = p_user_id
      AND campaign_id = p_campaign_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.qualify_referral()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Check if this new active subscriber was invited by someone
    UPDATE merchant_referrals
    SET status = 'qualified', qualified_at = NOW()
    FROM merchants
    WHERE merchant_referrals.referee_id = NEW.merchant_id
      AND NEW.status = 'active'
      AND NEW.plan_name IS NOT NULL;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_fcm_tokens_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.modified_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_rating_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

-- TRIGGERS
CREATE OR REPLACE TRIGGER update_campaign_interactions_modtime BEFORE UPDATE ON public.campaign_interactions FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER "new-deal-notification" AFTER UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/send-new-deal-notification', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdWx5eGdsenFsaHBxeGx3anF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg2MDgyMiwiZXhwIjoyMDg0NDM2ODIyfQ.9XiwXcNaci-ELD3Z95dIuF_InFc_GQOiO3ZmS-Ma7jw"}', '{}', '5000');
CREATE OR REPLACE TRIGGER update_campaigns_modtime BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER trigger_update_fcm_tokens_updated_at BEFORE UPDATE ON public.fcm_tokens FOR EACH ROW EXECUTE FUNCTION update_fcm_tokens_updated_at();
CREATE OR REPLACE TRIGGER update_hoardings_modtime BEFORE UPDATE ON public.hoardings FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_merchant_images_modtime BEFORE UPDATE ON public.merchant_images FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_merchant_ratings_changetime BEFORE UPDATE ON public.merchant_ratings FOR EACH ROW EXECUTE FUNCTION update_rating_modified_column();
CREATE OR REPLACE TRIGGER update_store_categories_modtime BEFORE UPDATE ON public.store_categories FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_subscription_tiers_modtime BEFORE UPDATE ON public.subscription_tiers FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- RLS
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow consumers and merchants to select" ON public.campaign_interactions AS PERMISSIVE FOR SELECT TO authenticated USING ((((auth.uid())::text = (consumer_id)::text) OR (auth.uid() = merchant_id)));
CREATE POLICY "Allow individual insertion" ON public.campaign_interactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid())::text = (consumer_id)::text));
CREATE POLICY "Allow merchants to select their interactions" ON public.campaign_interactions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = merchant_id));
CREATE POLICY "Allow merchants to update their interactions" ON public.campaign_interactions AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = merchant_id)) WITH CHECK ((auth.uid() = merchant_id));
CREATE POLICY "Users can insert their own interactions" ON public.campaign_interactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid())::text = (consumer_id)::text));
CREATE POLICY "Admins can view all campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'dealadmin'::text)))));
CREATE POLICY "Anyone can view active campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO public USING ((status = 'active'::campaign_status));
CREATE POLICY "Merchants can insert own campaigns" ON public.campaigns AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = merchant_id));
CREATE POLICY "Merchants can view own campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = merchant_id));
CREATE POLICY "Merchants manage own campaigns" ON public.campaigns AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = merchant_id));
CREATE POLICY "Allow authenticated read for cities" ON public.cities AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read access for cities" ON public.cities AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read cities" ON public.cities AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their own favorites" ON public.favorites AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Allow authenticated users to update hoardings" ON public.hoardings AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read access" ON public.hoardings AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Public read localities" ON public.localities AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Consumers can insert their own ratings" ON public.merchant_ratings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = consumer_id));
CREATE POLICY "Consumers can view their own ratings" ON public.merchant_ratings AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = consumer_id));
CREATE POLICY "Admins can view all stores" ON public.merchant_stores AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role = 'dealadmin'::text)))));
CREATE POLICY "Allow authenticated read" ON public.merchant_stores AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Merchants can view their own stores" ON public.merchant_stores AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = merchant_id));
CREATE POLICY authenticated_insert ON public.merchant_subscriptions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY authenticated_select ON public.merchant_subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY merchant_insert_own ON public.merchant_subscriptions AS PERMISSIVE FOR INSERT TO public WITH CHECK (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid)));
CREATE POLICY merchant_select_own ON public.merchant_subscriptions AS PERMISSIVE FOR SELECT TO public USING (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid)));
CREATE POLICY merchant_update_own ON public.merchant_subscriptions AS PERMISSIVE FOR UPDATE TO public USING (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid))) WITH CHECK (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid)));
CREATE POLICY "Users can pin deals" ON public.pinned_deals AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can unpin deals" ON public.pinned_deals AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own pinned deals" ON public.pinned_deals AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Allow public read access for states" ON public.states AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read of categories" ON public.store_categories AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated users to view active tiers" ON public.subscription_tiers AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
CREATE POLICY "Users can insert their own activity logs" ON public.user_activity_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid())::text = (user_id)::text));
CREATE POLICY "Users can view their own activity logs" ON public.user_activity_logs AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid())::text = (user_id)::text));
CREATE POLICY "Users can update their own notifications" ON public.user_notifications AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own notifications" ON public.user_notifications AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Service role full access" ON public.user_profiles AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));