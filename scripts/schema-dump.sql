-- Schema dump: DEV → QA
-- Generated: 2026-06-04T19:49:17.129Z

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
CREATE SEQUENCE IF NOT EXISTS public.merchant_permissions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_referrals_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_rewards_log_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_subscriptions_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.merchant_usage_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.razorpay_webhook_events_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.states_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.store_categories_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.subscription_audit_logs_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS public.subscription_tiers_id_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 NO CYCLE;

-- ENUM TYPES (must exist before tables)
CREATE TYPE public.campaign_status AS ENUM ('review', 'active', 'expired', 'needs review');
CREATE TYPE public.log_level AS ENUM ('warning', 'error', 'critical');
CREATE TYPE public.user_role AS ENUM ('user', 'merchant');
CREATE TYPE public.user_type AS ENUM ('consumer', 'merchant', 'system');

-- TABLES
CREATE TABLE IF NOT EXISTS public."VEDIC_profiles" (
  "id" uuid NOT NULL,
  "email" text,
  "full_name" text,
  "display_name" text,
  "avatar_url" text,
  "phone" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "invite_code" text,
  "country_code" text
);

CREATE TABLE IF NOT EXISTS public."app_configs" (
  "config_key" text NOT NULL,
  "config_value" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."app_files" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "folder_id" uuid NOT NULL,
  "name" text NOT NULL,
  "storage_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" int8 NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."app_folders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "parent_id" uuid,
  "name" text NOT NULL,
  "path" text NOT NULL,
  "is_restricted" bool DEFAULT false NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."apps" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_key" text NOT NULL,
  "app_name" text NOT NULL,
  "sector" text,
  "description" text,
  "base_url" text,
  "subdomain" text,
  "is_active" bool DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."campaign_drafts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "current_step" int4 DEFAULT 0 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "cover_image_url" text,
  "additional_image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "free_gift_image_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."campaign_interactions" (
  "interaction_id" int8 DEFAULT nextval('campaign_interactions_interaction_id_seq'::regclass) NOT NULL,
  "consumer_id" varchar(255) NOT NULL,
  "merchant_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "click_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "is_redeemed" bool DEFAULT false,
  "redeemed_at" timestamptz,
  "platform" varchar(50),
  "atstore_yet" text DEFAULT ''::text,
  "claim_no" text,
  "modified_at" timestamptz DEFAULT now(),
  "is_dotd" bool DEFAULT false
);

CREATE TABLE IF NOT EXISTS public."campaign_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "template_type" text DEFAULT 'personal'::text NOT NULL,
  "merchant_id" uuid,
  "title_format" text,
  "suggested_discount" numeric(5,2),
  "discount_min" numeric(5,2),
  "discount_max" numeric(5,2),
  "launch_day_of_week" int4,
  "launch_hour" int4,
  "duration_days" int4,
  "tips" jsonb DEFAULT '[]'::jsonb,
  "success_rate" numeric(5,2),
  "avg_redemptions" int4,
  "times_used" int4 DEFAULT 0,
  "last_used_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "is_active" bool DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."campaigns" (
  "campaign_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid,
  "shop_name" text NOT NULL,
  "deal_heading" text NOT NULL,
  "category" text NOT NULL,
  "latlong" text NOT NULL,
  "offer_value" text NOT NULL,
  "long_description" varchar,
  "status" campaign_status DEFAULT 'review'::campaign_status,
  "start_date" date DEFAULT CURRENT_DATE,
  "end_date" date,
  "is_deal_of_the_day" bool DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "store_id" uuid,
  "last_modified" timestamptz DEFAULT now(),
  "image_url" text,
  "image_name" text,
  "localized_description" jsonb DEFAULT '{"en": "Standard DealPro incentive protocol.", "hi": "मानक DealPro प्रोत्साहन प्रोटोकॉल।", "kn": "Standard DealPro ಪ್ರೋತ್ಸಾಹಕ ಪ್ರೋಟೋಕಾಲ್."}'::jsonb,
  "localized_heading" jsonb DEFAULT '{}'::jsonb,
  "localized_offer" jsonb DEFAULT '{}'::jsonb,
  "localized_shop_name" jsonb DEFAULT '{}'::jsonb,
  "modified_at" timestamptz DEFAULT now(),
  "comments" text,
  "media_urls" text[] DEFAULT '{}'::text[],
  "video_url" text,
  "image_price_overlays" jsonb DEFAULT '{}'::jsonb,
  "trust_badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "free_gifts" jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public."cities" (
  "id" int4 DEFAULT nextval('cities_id_seq'::regclass) NOT NULL,
  "state_id" int4,
  "name_code" varchar(100),
  "names" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public."consumer_referrals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "referrer_id" uuid NOT NULL,
  "referee_id" uuid,
  "referral_code" text NOT NULL,
  "referee_phone" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "referrer_points" int4 DEFAULT 0 NOT NULL,
  "referee_points" int4 DEFAULT 0 NOT NULL,
  "qualified_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."consumer_requirements" (
  "id" int8 NOT NULL,
  "item_type" text NOT NULL,
  "parent_id" int8,
  "req_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "acceptance_criteria" text,
  "priority" text DEFAULT 'medium'::text,
  "status" text DEFAULT 'backlog'::text,
  "assignee" text,
  "sprint" text,
  "story_points" int4,
  "linked_test_case" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."consumer_rewards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "points_balance" int4 DEFAULT 0 NOT NULL,
  "lifetime_points" int4 DEFAULT 0 NOT NULL,
  "tier" text DEFAULT 'bronze'::text NOT NULL,
  "tier_updated_at" timestamptz,
  "streak_days" int4 DEFAULT 0 NOT NULL,
  "streak_updated_on" date,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."consumer_test_cases" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "steps" text,
  "expected_result" text,
  "priority" text DEFAULT 'medium'::text NOT NULL,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "category" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."consumer_test_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "test_case_id" uuid NOT NULL,
  "app_id" uuid NOT NULL,
  "result" text NOT NULL,
  "actual_result" text,
  "notes" text,
  "executed_by" uuid NOT NULL,
  "executed_at" timestamptz DEFAULT now() NOT NULL,
  "attachment_url" text
);

CREATE TABLE IF NOT EXISTS public."contractor_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "first_name" text,
  "last_name" text,
  "dob" date,
  "home_address_line1" text,
  "home_address_line2" text,
  "home_city" text,
  "home_state" text,
  "home_pincode" text,
  "servicing_city" text,
  "servicing_state" text,
  "start_date" date,
  "mobile_number" text,
  "active_status" bool DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_modified_date" timestamptz DEFAULT now() NOT NULL,
  "aadhaar_encrypted" text,
  "aadhaar_hash" text,
  "aadhaar_last3" text
);

CREATE TABLE IF NOT EXISTS public."deal_shares" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "campaign_id" uuid NOT NULL,
  "shared_by" uuid NOT NULL,
  "shared_with" uuid NOT NULL,
  "message" text,
  "created_at" timestamptz DEFAULT now(),
  "viewed_at" timestamptz
);

CREATE TABLE IF NOT EXISTS public."dealpro_test_plan_results" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "test_id" text NOT NULL,
  "status" text NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "is_auto_test" bool DEFAULT false NOT NULL,
  "run_id" uuid,
  "started_at" timestamptz,
  "screenshot_urls" text[] DEFAULT '{}'::text[] NOT NULL,
  "duration_ms" int4
);

CREATE TABLE IF NOT EXISTS public."dealpro_test_plan_runs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "triggered_by" uuid,
  "triggered_at" timestamptz DEFAULT now() NOT NULL,
  "finished_at" timestamptz,
  "status" text DEFAULT 'queued'::text NOT NULL,
  "app" text NOT NULL,
  "github_run_id" int8,
  "github_run_url" text,
  "commit_sha" text,
  "branch" text,
  "total_tests" int4 DEFAULT 0 NOT NULL,
  "passed" int4 DEFAULT 0 NOT NULL,
  "failed" int4 DEFAULT 0 NOT NULL,
  "notes" text
);

CREATE TABLE IF NOT EXISTS public."diagrams" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text DEFAULT 'Untitled diagram'::text NOT NULL,
  "content" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."favorites" (
  "id" int8 NOT NULL,
  "user_id" uuid,
  "campaign_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "merchant_id" uuid,
  "campaign_status" text,
  "active_favorite" bool DEFAULT true
);

CREATE TABLE IF NOT EXISTS public."fcm_tokens" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "device_token" text NOT NULL,
  "device_type" text,
  "device_name" text,
  "app_version" text,
  "is_active" bool DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "last_used_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."feature_permissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "feature_key" text NOT NULL,
  "role" text NOT NULL,
  "can_view" bool DEFAULT true NOT NULL,
  "can_edit" bool DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_accounts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "account_name" text NOT NULL,
  "account_type" text NOT NULL,
  "bank_name" text,
  "account_number_last4" text,
  "opening_balance" numeric(15,2) DEFAULT 0 NOT NULL,
  "current_balance" numeric(15,2) DEFAULT 0 NOT NULL,
  "is_active" bool DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_attachments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "record_type" text NOT NULL,
  "record_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" int8 NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_budgets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "category" text NOT NULL,
  "period_type" text NOT NULL,
  "period_label" text NOT NULL,
  "budgeted_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "actual_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_expenses" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "date" date NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "amount" numeric(15,2) NOT NULL,
  "payment_method" text NOT NULL,
  "paid_to" text,
  "account_id" uuid,
  "reference_number" text,
  "bill_number" text,
  "is_recurring" bool DEFAULT false NOT NULL,
  "due_date" date,
  "notes" text,
  "tax_amount" numeric(15,2) DEFAULT 0,
  "tax_type" text DEFAULT 'none'::text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_income" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "date" date NOT NULL,
  "category" text NOT NULL,
  "description" text NOT NULL,
  "amount" numeric(15,2) NOT NULL,
  "payment_method" text NOT NULL,
  "received_from" text,
  "account_id" uuid,
  "reference_number" text,
  "invoice_id" uuid,
  "notes" text,
  "tax_amount" numeric(15,2) DEFAULT 0,
  "tax_type" text DEFAULT 'none'::text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_invoice_items" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "description" text NOT NULL,
  "quantity" numeric(10,2) DEFAULT 1 NOT NULL,
  "unit_price" numeric(15,2) DEFAULT 0 NOT NULL,
  "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
  "amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "sort_order" int4 DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_invoices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "invoice_number" text NOT NULL,
  "type" text NOT NULL,
  "date" date NOT NULL,
  "due_date" date,
  "party_name" text NOT NULL,
  "party_contact" text,
  "party_gstin" text,
  "status" text DEFAULT 'draft'::text NOT NULL,
  "subtotal" numeric(15,2) DEFAULT 0 NOT NULL,
  "tax_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "total" numeric(15,2) DEFAULT 0 NOT NULL,
  "paid_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_payments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "date" date NOT NULL,
  "type" text NOT NULL,
  "amount" numeric(15,2) NOT NULL,
  "payment_method" text NOT NULL,
  "party_name" text,
  "account_id" uuid,
  "invoice_id" uuid,
  "reference_number" text,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."fin_tax_records" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "date" date NOT NULL,
  "tax_type" text NOT NULL,
  "period_month" int4 NOT NULL,
  "period_year" int4 NOT NULL,
  "taxable_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "tax_rate" numeric(5,2) DEFAULT 0 NOT NULL,
  "tax_amount" numeric(15,2) DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "filing_reference" text,
  "notes" text,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."folder_permissions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "folder_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "granted_by" uuid NOT NULL,
  "can_write" bool DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."friendships" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "requester_id" uuid NOT NULL,
  "addressee_id" uuid NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."geocode_cache" (
  "id" int8 NOT NULL,
  "query_key" text NOT NULL,
  "latitude" float8 NOT NULL,
  "longitude" float8 NOT NULL,
  "city" text,
  "state" text,
  "locality" text,
  "created_at" timestamptz DEFAULT now(),
  "expires_at" timestamptz DEFAULT (now() + '90 days'::interval)
);

CREATE TABLE IF NOT EXISTS public."hoardings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "hoarding_no" text NOT NULL,
  "topic" text,
  "heading" text NOT NULL,
  "description" text,
  "images" text[] DEFAULT '{}'::text[],
  "created_at" timestamptz DEFAULT now(),
  "modified_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."invite_codes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "is_active" bool DEFAULT true NOT NULL,
  "expires_at" timestamptz,
  "max_uses" int4 DEFAULT 1 NOT NULL,
  "used_count" int4 DEFAULT 0 NOT NULL,
  "used_by" uuid,
  "used_at" timestamptz,
  "note" text
);

CREATE TABLE IF NOT EXISTS public."kanban_task_attachments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "user_name" text,
  "file_name" text NOT NULL,
  "file_size" int8,
  "content_type" text,
  "storage_path" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."kanban_task_comments" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "task_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "user_name" text,
  "content" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."kanban_tasks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text DEFAULT 'backlog'::text NOT NULL,
  "priority" text DEFAULT 'medium'::text NOT NULL,
  "assigned_to" uuid,
  "assigned_to_name" text,
  "created_by" uuid NOT NULL,
  "created_by_name" text,
  "position" float8 DEFAULT 0 NOT NULL,
  "due_date" date,
  "backlog_at" timestamptz,
  "todo_at" timestamptz,
  "assigned_at" timestamptz,
  "in_progress_at" timestamptz,
  "on_hold_at" timestamptz,
  "complete_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."localities" (
  "id" int4 DEFAULT nextval('localities_id_seq'::regclass) NOT NULL,
  "city_id" int4,
  "pincode" varchar(10),
  "names" jsonb NOT NULL,
  "modified_at" timestamptz DEFAULT now(),
  "latitude" float8,
  "longitude" float8
);

CREATE TABLE IF NOT EXISTS public."merchant_addon_subscriptions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "subscription_id" int8,
  "addon_type" text DEFAULT 'loyalty_redemption'::text NOT NULL,
  "status" text NOT NULL,
  "price_at_enrollment" numeric(10,2) DEFAULT 10.00,
  "started_at" timestamptz DEFAULT now(),
  "ended_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."merchant_audit_logs" (
  "id" int8 DEFAULT nextval('merchant_audit_logs_id_seq'::regclass) NOT NULL,
  "merchant_id" varchar(255) NOT NULL,
  "action_group" text,
  "action_type" text,
  "entity_id" varchar(255),
  "change_summary" text,
  "old_data" jsonb,
  "new_data" jsonb,
  "ip_address" varchar(45),
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."merchant_bank_details" (
  "id" int8 DEFAULT nextval('merchant_bank_details_id_seq'::regclass) NOT NULL,
  "merchant_id" varchar(255) NOT NULL,
  "account_holder_name" varchar(255) NOT NULL,
  "account_number_encrypted" text NOT NULL,
  "account_type" varchar(20) DEFAULT 'current'::character varying,
  "ifsc_code" varchar(11) NOT NULL,
  "bank_name" varchar(100),
  "branch_name" varchar(255),
  "is_verified" bool DEFAULT false,
  "penny_drop_status" varchar(20),
  "pan_number" varchar(10),
  "gst_registration_type" varchar(50),
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."merchant_images" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "image_name" text NOT NULL,
  "image_url" text NOT NULL,
  "is_active" bool DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "last_modified_at" timestamptz DEFAULT now(),
  "consumer_id" text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."merchant_invites" (
  "id" int8 DEFAULT nextval('merchant_invites_id_seq'::regclass) NOT NULL,
  "referrer_id" varchar(255) NOT NULL,
  "invitee_phone" varchar(20) NOT NULL,
  "invite_code" varchar(50) NOT NULL,
  "status" varchar(20) DEFAULT 'sent'::character varying,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."merchant_payments" (
  "id" int8 DEFAULT nextval('merchant_payments_id_seq'::regclass) NOT NULL,
  "merchant_id" varchar(255) NOT NULL,
  "subscription_id" int8,
  "transaction_id" varchar(255),
  "order_id" varchar(255) NOT NULL,
  "amount_base" numeric(12,2) NOT NULL,
  "amount_total" numeric(12,2) NOT NULL,
  "currency" varchar(3) DEFAULT 'INR'::character varying,
  "gst_rate_percent" numeric(5,2) DEFAULT 18.00,
  "cgst_amount" numeric(12,2) DEFAULT 0.00,
  "sgst_amount" numeric(12,2) DEFAULT 0.00,
  "igst_amount" numeric(12,2) DEFAULT 0.00,
  "hsn_sac_code" varchar(10) DEFAULT '9983'::character varying,
  "merchant_gstin" varchar(15),
  "billing_state" varchar(50),
  "payment_method" varchar(20),
  "payment_status" varchar(20),
  "failure_reason" text,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."merchant_payouts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid,
  "redemption_id" uuid,
  "amount" numeric(10,2) NOT NULL,
  "payout_id" text,
  "status" text DEFAULT 'pending'::text,
  "fund_account_id" text,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."merchant_permissions" (
  "id" int4 DEFAULT nextval('merchant_permissions_id_seq'::regclass) NOT NULL,
  "role" text NOT NULL,
  "permission" text NOT NULL,
  "allowed" bool DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public."merchant_profiles" (
  "id" uuid NOT NULL,
  "email" text,
  "phone" text NOT NULL,
  "full_name" text,
  "role" text DEFAULT 'merchant'::text NOT NULL,
  "store_name" text,
  "category" text DEFAULT 'General'::text,
  "gstin" text,
  "pan" text,
  "business_type" text,
  "udyam_no" text,
  "fssai_no" text,
  "trade_license_no" text,
  "my_referral_code" varchar(50),
  "terms_accepted" bool DEFAULT false,
  "privacy_accepted" bool DEFAULT false,
  "lang_preference" text DEFAULT 'en'::text,
  "active_status" bool DEFAULT true,
  "push_notification" bool DEFAULT true,
  "email_notification" bool DEFAULT false,
  "text_notification" bool DEFAULT false,
  "first_login_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "country_code" text,
  "invite_code" text,
  "consumer_referral" text,
  "consumer_referral_code" varchar(6),
  "merchant_referral_code" varchar(6)
);

CREATE TABLE IF NOT EXISTS public."merchant_ratings" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "consumer_id" uuid,
  "merchant_id" uuid,
  "campaign_id" uuid,
  "rating" numeric(2,1),
  "comments" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."merchant_referrals" (
  "id" int8 DEFAULT nextval('merchant_referrals_id_seq'::regclass) NOT NULL,
  "referrer_id" varchar(255) NOT NULL,
  "referee_id" varchar(255) NOT NULL,
  "referral_code_used" varchar(50),
  "status" varchar(20) DEFAULT 'pending'::character varying,
  "qualified_at" timestamptz,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."merchant_requirements" (
  "id" int8 NOT NULL,
  "item_type" text NOT NULL,
  "parent_id" int8,
  "req_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "acceptance_criteria" text,
  "priority" text DEFAULT 'medium'::text,
  "status" text DEFAULT 'backlog'::text,
  "assignee" text,
  "sprint" text,
  "story_points" int4,
  "linked_test_case" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."merchant_rewards_log" (
  "id" int8 DEFAULT nextval('merchant_rewards_log_id_seq'::regclass) NOT NULL,
  "merchant_id" varchar(255) NOT NULL,
  "reward_type" varchar(50) DEFAULT 'free_month'::character varying NOT NULL,
  "referral_count" int4 NOT NULL,
  "reward_month" date NOT NULL,
  "days_extended" int4 DEFAULT 30 NOT NULL,
  "old_end_date" timestamptz,
  "new_end_date" timestamptz,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."merchant_staff" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text DEFAULT 'staff'::text NOT NULL,
  "display_name" text NOT NULL,
  "phone" text,
  "invited_by" uuid,
  "status" text DEFAULT 'active'::text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "last_active_at" timestamptz
);

CREATE TABLE IF NOT EXISTS public."merchant_staff_invites" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL,
  "invited_by" uuid NOT NULL,
  "invite_code" text NOT NULL,
  "role" text DEFAULT 'staff'::text NOT NULL,
  "display_name" text NOT NULL,
  "phone" text,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "expires_at" timestamptz DEFAULT (now() + '7 days'::interval)
);

CREATE TABLE IF NOT EXISTS public."merchant_stores" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL,
  "address" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "landmark" text,
  "latitude" float8,
  "longitude" float8,
  "created_at" timestamptz DEFAULT timezone('utc'::text, now()),
  "store_hrs" text,
  "pincode" text NOT NULL,
  "store_name" text,
  "locality" text,
  "store_category" text,
  "active_status" text DEFAULT 'active'::text,
  "store_phone" text,
  "store_phone_alt" text,
  "delivers" bool DEFAULT false,
  "delivery_radius_km" int4
);

CREATE TABLE IF NOT EXISTS public."merchant_subscriptions" (
  "id" int8 DEFAULT nextval('merchant_subscriptions_id_seq'::regclass) NOT NULL,
  "merchant_id" varchar(255) NOT NULL,
  "plan_name" varchar(50) NOT NULL,
  "status" varchar(20) NOT NULL,
  "gateway_customer_id" varchar(255),
  "mandate_id" varchar(255),
  "subscription_id" varchar(255),
  "current_period_start" timestamptz,
  "current_period_end" timestamptz,
  "cancel_at_period_end" bool DEFAULT false,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "billing_cycle_day" int4,
  "billing_type" varchar(20) DEFAULT 'advance'::character varying,
  "last_billed_at" timestamptz,
  "cancellation_reason" text,
  "trial_end" timestamptz,
  "loyalty_redemption_enabled" bool DEFAULT false,
  "loyalty_addon_price" numeric DEFAULT 10.00,
  "total_recurring_amount" numeric,
  "last_notified_at" timestamptz,
  "is_test_subscription" bool DEFAULT false NOT NULL,
  "razorpay_subscription_id" text,
  "razorpay_payment_id" text,
  "razorpay_status" text,
  "razorpay_current_period_end" timestamptz,
  "cancelled_at" timestamptz
);

CREATE TABLE IF NOT EXISTS public."merchant_usage" (
  "id" int4 DEFAULT nextval('merchant_usage_id_seq'::regclass) NOT NULL,
  "merchant_id" varchar(255) NOT NULL,
  "subscription_id" int8,
  "feature_key" varchar(50) NOT NULL,
  "current_usage_count" int4 DEFAULT 0,
  "billing_period_start" timestamptz NOT NULL,
  "billing_period_end" timestamptz NOT NULL,
  "last_updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."milestone_claims" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "milestone_id" uuid NOT NULL,
  "points_awarded" int4 DEFAULT 0 NOT NULL,
  "claimed_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."notification_logs" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL,
  "notification_type" text NOT NULL,
  "channel" text NOT NULL,
  "recipient" text,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'sent'::text NOT NULL,
  "error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."performance_traces" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "app_key" text NOT NULL,
  "action_name" text NOT NULL,
  "screen" text,
  "total_duration_ms" int4 NOT NULL,
  "breakdowns" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "platform" text DEFAULT 'web'::text,
  "session_id" text,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now(),
  "phone" text
);

CREATE TABLE IF NOT EXISTS public."pinned_deals" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "campaign_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "active_status" bool DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public."platform_errors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "captured_at" timestamptz DEFAULT now() NOT NULL,
  "error_type" text DEFAULT 'unknown'::text NOT NULL,
  "severity" text DEFAULT 'error'::text NOT NULL,
  "message" text NOT NULL,
  "stack_trace" text,
  "path" text,
  "method" text,
  "status_code" int4,
  "user_id" uuid,
  "user_email" text,
  "app_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "is_resolved" bool DEFAULT false,
  "resolved_at" timestamptz,
  "resolved_by" uuid,
  "resolved_note" text
);

CREATE TABLE IF NOT EXISTS public."points_transactions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "action" text NOT NULL,
  "points" int4 NOT NULL,
  "campaign_id" text,
  "merchant_id" text,
  "reference_id" text,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."product_favorites_user" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "merchant_id" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."products" (
  "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
  "gtin_upc" varchar(20),
  "name" text NOT NULL,
  "category" varchar(50) NOT NULL,
  "image_url" text,
  "source_url" text,
  "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "merchant_id" uuid,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "is_active" bool DEFAULT true,
  "merchant_consent" bool DEFAULT false,
  "merch_consent_date" timestamptz,
  "description" text,
  "stock_count" int4,
  "additional_images" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "video_url" text,
  "store_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public."profiles" (
  "id" uuid NOT NULL,
  "username" text NOT NULL,
  "email" text,
  "phone" text,
  "role" user_role DEFAULT 'user'::user_role,
  "store_name" text,
  "business_category" text,
  "gstin" text,
  "pan" text,
  "avatar_url" text,
  "is_active" bool DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "active_status" varchar
);

CREATE TABLE IF NOT EXISTS public."razorpay_webhook_events" (
  "id" int8 DEFAULT nextval('razorpay_webhook_events_id_seq'::regclass) NOT NULL,
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "razorpay_subscription_id" text,
  "payload" jsonb NOT NULL,
  "received_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."reward_milestones" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "milestone_type" text NOT NULL,
  "threshold" int4 NOT NULL,
  "bonus_points" int4 DEFAULT 0 NOT NULL,
  "badge_icon" text,
  "is_active" bool DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."reward_point_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "action" text NOT NULL,
  "points" int4 DEFAULT 0 NOT NULL,
  "is_active" bool DEFAULT true NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "tier" text DEFAULT 'bronze'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."signup_drafts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "current_step" int4 DEFAULT 0 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."states" (
  "id" int4 DEFAULT nextval('states_id_seq'::regclass) NOT NULL,
  "name_code" varchar(50),
  "names" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public."store_categories" (
  "id" int4 DEFAULT nextval('store_categories_id_seq'::regclass) NOT NULL,
  "category_name" text NOT NULL,
  "active_status" bool DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "modified_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."stores" (
  "store_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid,
  "address_line" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "landmark" text,
  "latitude" numeric(10,8) NOT NULL,
  "longitude" numeric(11,8) NOT NULL,
  "geo_location" geography,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."subscription_audit_logs" (
  "id" int8 DEFAULT nextval('subscription_audit_logs_id_seq'::regclass) NOT NULL,
  "subscription_id" int8,
  "merchant_id" varchar(255) NOT NULL,
  "action_type" varchar(50) NOT NULL,
  "old_plan_data" jsonb,
  "new_plan_data" jsonb,
  "change_source" varchar(20) DEFAULT 'MERCHANT'::character varying,
  "remarks" text,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."subscription_tiers" (
  "id" int4 DEFAULT nextval('subscription_tiers_id_seq'::regclass) NOT NULL,
  "tier_key" text NOT NULL,
  "tier_name" varchar(100) NOT NULL,
  "description" text,
  "currency" varchar(3) DEFAULT 'INR'::character varying,
  "subscription_fee" numeric(12,2) NOT NULL,
  "billing_frequency" varchar(20) NOT NULL,
  "trial_period_days" int4 DEFAULT 0,
  "is_active" bool DEFAULT true,
  "features" jsonb,
  "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
  "max_campaigns_per_month" int4 DEFAULT 1,
  "max_dotd_per_month" int4 DEFAULT 0,
  "is_multi_store" bool DEFAULT false,
  "modified_at" timestamp DEFAULT now(),
  "razorpay_plan_id" text
);

CREATE TABLE IF NOT EXISTS public."test_cases" (
  "id" int8 NOT NULL,
  "module" text NOT NULL,
  "feature" text NOT NULL,
  "tc_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "priority" text DEFAULT 'medium'::text,
  "test_type" text DEFAULT 'functional'::text,
  "preconditions" text,
  "platform" text DEFAULT 'all'::text,
  "role" text DEFAULT 'merchant'::text,
  "is_active" bool DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "story_req_id" text,
  "created_by" text,
  "app_id" uuid NOT NULL,
  "category" text
);

CREATE TABLE IF NOT EXISTS public."test_runs" (
  "id" int8 NOT NULL,
  "test_case_id" int8 NOT NULL,
  "release" text NOT NULL,
  "environment" text DEFAULT 'dev'::text,
  "status" text DEFAULT 'pending'::text,
  "executed_by" text,
  "executed_at" timestamptz,
  "comments" text,
  "bug_ticket" text,
  "screenshot" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "app_id" uuid NOT NULL,
  "actual_result" text,
  "notes" text,
  "attachment_url" text
);

CREATE TABLE IF NOT EXISTS public."tier_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tier_name" text NOT NULL,
  "min_points" int4 DEFAULT 0 NOT NULL,
  "label" text NOT NULL,
  "color" text DEFAULT '#CD7F32'::text NOT NULL,
  "icon" text DEFAULT 'shield'::text NOT NULL,
  "sort_order" int4 DEFAULT 0 NOT NULL,
  "is_active" bool DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."transaction_claims" (
  "claim_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "consumer_id" uuid,
  "merchant_id" uuid,
  "campaign_id" uuid,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamptz DEFAULT now(),
  "redeemed_at" timestamptz
);

CREATE TABLE IF NOT EXISTS public."user_activity_logs" (
  "id" int8 NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "merchant_id" uuid,
  "campaign_id" uuid,
  "platform" text DEFAULT 'mobile'::text NOT NULL,
  "role" text DEFAULT 'consumer'::text,
  "session_id" text,
  "screen" text,
  "duration_ms" int4,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."user_app_registry" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "app_id" uuid NOT NULL,
  "role" text NOT NULL,
  "is_active" bool DEFAULT true NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."user_devices" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "device_token" text NOT NULL,
  "device_type" text NOT NULL,
  "device_name" text,
  "app_version" text,
  "is_active" bool DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "last_used_at" timestamptz
);

CREATE TABLE IF NOT EXISTS public."user_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "campaign_id" uuid,
  "merchant_id" uuid,
  "type" text DEFAULT 'new_deal'::text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "image_url" text,
  "is_read" bool DEFAULT false,
  "created_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."user_permission_overrides" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "app_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "feature_key" text NOT NULL,
  "can_view" bool,
  "can_edit" bool,
  "granted_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public."user_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "email" text,
  "phone" text NOT NULL,
  "role" text DEFAULT 'consumer'::text NOT NULL,
  "active_status" bool DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "full_name" text,
  "first_login_at" timestamptz,
  "lang_preference" text,
  "home_location" text,
  "push_notification" bool DEFAULT true,
  "email_notification" bool DEFAULT false,
  "text_notification" bool DEFAULT false,
  "last_logged_in" timestamptz,
  "country_code" text,
  "email_verified" bool DEFAULT false,
  "phone_verified" bool DEFAULT false,
  "location_state" text,
  "allow_location" bool DEFAULT false,
  "referral_code" text,
  "auth_uid" uuid
);

CREATE TABLE IF NOT EXISTS public."web_login_requests" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "merchant_id" uuid NOT NULL,
  "phone" text NOT NULL,
  "request_code" text NOT NULL,
  "claim_nonce" text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "token_hash" text,
  "requester_label" text,
  "approved_by" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL
);

-- PRIMARY KEYS
ALTER TABLE public."VEDIC_profiles" ADD CONSTRAINT "VEDIC_profiles_pkey" PRIMARY KEY (id);
ALTER TABLE public.app_configs ADD CONSTRAINT app_configs_pkey PRIMARY KEY (config_key);
ALTER TABLE public.app_files ADD CONSTRAINT app_files_pkey PRIMARY KEY (id);
ALTER TABLE public.app_folders ADD CONSTRAINT app_folders_pkey PRIMARY KEY (id);
ALTER TABLE public.apps ADD CONSTRAINT apps_pkey PRIMARY KEY (id);
ALTER TABLE public.campaign_drafts ADD CONSTRAINT campaign_drafts_pkey PRIMARY KEY (id);
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_pkey PRIMARY KEY (interaction_id);
ALTER TABLE public.campaign_templates ADD CONSTRAINT campaign_templates_pkey PRIMARY KEY (id);
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_pkey PRIMARY KEY (campaign_id);
ALTER TABLE public.cities ADD CONSTRAINT cities_pkey PRIMARY KEY (id);
ALTER TABLE public.consumer_referrals ADD CONSTRAINT consumer_referrals_pkey PRIMARY KEY (id);
ALTER TABLE public.consumer_requirements ADD CONSTRAINT consumer_requirements_pkey PRIMARY KEY (id);
ALTER TABLE public.consumer_rewards ADD CONSTRAINT consumer_rewards_pkey PRIMARY KEY (id);
ALTER TABLE public.consumer_test_cases ADD CONSTRAINT consumer_test_cases_pkey PRIMARY KEY (id);
ALTER TABLE public.consumer_test_runs ADD CONSTRAINT consumer_test_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.contractor_codes ADD CONSTRAINT contractor_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.deal_shares ADD CONSTRAINT deal_shares_pkey PRIMARY KEY (id);
ALTER TABLE public.dealpro_test_plan_results ADD CONSTRAINT dealpro_test_plan_results_pkey PRIMARY KEY (id);
ALTER TABLE public.dealpro_test_plan_runs ADD CONSTRAINT dealpro_test_plan_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.diagrams ADD CONSTRAINT diagrams_pkey PRIMARY KEY (id);
ALTER TABLE public.favorites ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);
ALTER TABLE public.fcm_tokens ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.feature_permissions ADD CONSTRAINT feature_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_accounts ADD CONSTRAINT fin_accounts_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_attachments ADD CONSTRAINT fin_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_budgets ADD CONSTRAINT fin_budgets_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_expenses ADD CONSTRAINT fin_expenses_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_income ADD CONSTRAINT fin_income_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_invoice_items ADD CONSTRAINT fin_invoice_items_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_invoices ADD CONSTRAINT fin_invoices_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_payments ADD CONSTRAINT fin_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_tax_records ADD CONSTRAINT fin_tax_records_pkey PRIMARY KEY (id);
ALTER TABLE public.folder_permissions ADD CONSTRAINT folder_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.friendships ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);
ALTER TABLE public.geocode_cache ADD CONSTRAINT geocode_cache_pkey PRIMARY KEY (id);
ALTER TABLE public.hoardings ADD CONSTRAINT hoardings_pkey PRIMARY KEY (id);
ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.kanban_task_attachments ADD CONSTRAINT kanban_task_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.kanban_task_comments ADD CONSTRAINT kanban_task_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.kanban_tasks ADD CONSTRAINT kanban_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.localities ADD CONSTRAINT localities_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_addon_subscriptions ADD CONSTRAINT merchant_addon_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_audit_logs ADD CONSTRAINT merchant_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_bank_details ADD CONSTRAINT merchant_bank_details_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_images ADD CONSTRAINT merchant_images_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_invites ADD CONSTRAINT merchant_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_payments ADD CONSTRAINT merchant_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_payouts ADD CONSTRAINT merchant_payouts_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_permissions ADD CONSTRAINT merchant_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_ratings ADD CONSTRAINT merchant_ratings_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_referrals ADD CONSTRAINT merchant_referrals_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_requirements ADD CONSTRAINT merchant_requirements_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_rewards_log ADD CONSTRAINT merchant_rewards_log_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_staff ADD CONSTRAINT merchant_staff_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_staff_invites ADD CONSTRAINT merchant_staff_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_stores ADD CONSTRAINT merchant_stores_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_subscriptions ADD CONSTRAINT merchant_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.merchant_usage ADD CONSTRAINT merchant_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.milestone_claims ADD CONSTRAINT milestone_claims_pkey PRIMARY KEY (id);
ALTER TABLE public.notification_logs ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.performance_traces ADD CONSTRAINT performance_traces_pkey PRIMARY KEY (id);
ALTER TABLE public.pinned_deals ADD CONSTRAINT pinned_deals_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_errors ADD CONSTRAINT platform_errors_pkey PRIMARY KEY (id);
ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.product_favorites_user ADD CONSTRAINT product_favorites_user_pkey PRIMARY KEY (id);
ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.razorpay_webhook_events ADD CONSTRAINT razorpay_webhook_events_pkey PRIMARY KEY (id);
ALTER TABLE public.reward_milestones ADD CONSTRAINT reward_milestones_pkey PRIMARY KEY (id);
ALTER TABLE public.reward_point_config ADD CONSTRAINT reward_point_config_pkey PRIMARY KEY (id);
ALTER TABLE public.signup_drafts ADD CONSTRAINT signup_drafts_pkey PRIMARY KEY (id);
ALTER TABLE public.states ADD CONSTRAINT states_pkey PRIMARY KEY (id);
ALTER TABLE public.store_categories ADD CONSTRAINT store_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.stores ADD CONSTRAINT stores_pkey PRIMARY KEY (store_id);
ALTER TABLE public.subscription_audit_logs ADD CONSTRAINT subscription_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.subscription_tiers ADD CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id);
ALTER TABLE public.test_cases ADD CONSTRAINT test_cases_pkey PRIMARY KEY (id);
ALTER TABLE public.test_runs ADD CONSTRAINT test_runs_pkey PRIMARY KEY (id);
ALTER TABLE public.tier_config ADD CONSTRAINT tier_config_pkey PRIMARY KEY (id);
ALTER TABLE public.transaction_claims ADD CONSTRAINT transaction_claims_pkey PRIMARY KEY (claim_id);
ALTER TABLE public.user_activity_logs ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.user_app_registry ADD CONSTRAINT user_app_registry_pkey PRIMARY KEY (id);
ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_pkey PRIMARY KEY (id);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_pkey PRIMARY KEY (id);
ALTER TABLE public.web_login_requests ADD CONSTRAINT web_login_requests_pkey PRIMARY KEY (id);

-- UNIQUE CONSTRAINTS
ALTER TABLE public."VEDIC_profiles" ADD CONSTRAINT "VEDIC_profiles_email_key" UNIQUE (email);
ALTER TABLE public.app_files ADD CONSTRAINT uq_file_name_per_folder UNIQUE (folder_id, name);
ALTER TABLE public.app_folders ADD CONSTRAINT uq_folder_name_per_parent UNIQUE (app_id, parent_id, name);
ALTER TABLE public.app_folders ADD CONSTRAINT uq_folder_path_per_app UNIQUE (app_id, path);
ALTER TABLE public.apps ADD CONSTRAINT apps_app_key_key UNIQUE (app_key);
ALTER TABLE public.campaign_drafts ADD CONSTRAINT campaign_drafts_uq_merchant_kind UNIQUE (merchant_id, kind);
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_claim_no_unique UNIQUE (claim_no);
ALTER TABLE public.consumer_referrals ADD CONSTRAINT consumer_ref_code_unique UNIQUE (referral_code);
ALTER TABLE public.consumer_requirements ADD CONSTRAINT consumer_requirements_req_id_key UNIQUE (req_id);
ALTER TABLE public.consumer_rewards ADD CONSTRAINT consumer_rewards_user_unique UNIQUE (user_id);
ALTER TABLE public.contractor_codes ADD CONSTRAINT contractor_codes_code_key UNIQUE (code);
ALTER TABLE public.contractor_codes ADD CONSTRAINT contractor_codes_mobile_number_key UNIQUE (mobile_number);
ALTER TABLE public.dealpro_test_plan_results ADD CONSTRAINT dealpro_test_plan_results_user_test_uq UNIQUE (user_id, test_id);
ALTER TABLE public.fcm_tokens ADD CONSTRAINT fcm_tokens_device_token_key UNIQUE (device_token);
ALTER TABLE public.feature_permissions ADD CONSTRAINT feature_permissions_app_id_feature_key_role_key UNIQUE (app_id, feature_key, role);
ALTER TABLE public.fin_budgets ADD CONSTRAINT fin_budgets_app_id_category_period_type_period_label_key UNIQUE (app_id, category, period_type, period_label);
ALTER TABLE public.fin_invoices ADD CONSTRAINT fin_invoices_app_id_invoice_number_key UNIQUE (app_id, invoice_number);
ALTER TABLE public.folder_permissions ADD CONSTRAINT uq_folder_permission UNIQUE (folder_id, user_id);
ALTER TABLE public.friendships ADD CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id);
ALTER TABLE public.geocode_cache ADD CONSTRAINT geocode_cache_query_key_key UNIQUE (query_key);
ALTER TABLE public.hoardings ADD CONSTRAINT hoardings_hoarding_no_key UNIQUE (hoarding_no);
ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_code_key UNIQUE (code);
ALTER TABLE public.merchant_bank_details ADD CONSTRAINT merchant_bank_details_merchant_id_key UNIQUE (merchant_id);
ALTER TABLE public.merchant_invites ADD CONSTRAINT merchant_invites_referrer_id_invitee_phone_key UNIQUE (referrer_id, invitee_phone);
ALTER TABLE public.merchant_payments ADD CONSTRAINT merchant_payments_transaction_id_key UNIQUE (transaction_id);
ALTER TABLE public.merchant_payouts ADD CONSTRAINT merchant_payouts_payout_id_key UNIQUE (payout_id);
ALTER TABLE public.merchant_permissions ADD CONSTRAINT merchant_permissions_role_permission_key UNIQUE (role, permission);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_consumer_referral_code_key UNIQUE (consumer_referral_code);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_email_key UNIQUE (email);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_fssai_no_key UNIQUE (fssai_no);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_gstin_key UNIQUE (gstin);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_merchant_referral_code_key UNIQUE (merchant_referral_code);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_my_referral_code_key UNIQUE (my_referral_code);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_pan_key UNIQUE (pan);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_phone_key UNIQUE (phone);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_trade_license_no_key UNIQUE (trade_license_no);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_udyam_no_key UNIQUE (udyam_no);
ALTER TABLE public.merchant_referrals ADD CONSTRAINT merchant_referrals_referee_id_key UNIQUE (referee_id);
ALTER TABLE public.merchant_requirements ADD CONSTRAINT merchant_requirements_req_id_key UNIQUE (req_id);
ALTER TABLE public.merchant_staff ADD CONSTRAINT merchant_staff_merchant_id_user_id_key UNIQUE (merchant_id, user_id);
ALTER TABLE public.merchant_staff_invites ADD CONSTRAINT merchant_staff_invites_invite_code_key UNIQUE (invite_code);
ALTER TABLE public.merchant_subscriptions ADD CONSTRAINT merchant_subscriptions_subscription_id_key UNIQUE (subscription_id);
ALTER TABLE public.merchant_usage ADD CONSTRAINT merchant_usage_merchant_id_feature_key_billing_period_start_key UNIQUE (merchant_id, feature_key, billing_period_start);
ALTER TABLE public.milestone_claims ADD CONSTRAINT milestone_claim_unique UNIQUE (user_id, milestone_id);
ALTER TABLE public.pinned_deals ADD CONSTRAINT pinned_deals_user_id_campaign_id_key UNIQUE (user_id, campaign_id);
ALTER TABLE public.points_transactions ADD CONSTRAINT points_tx_idempotent UNIQUE (user_id, action, reference_id);
ALTER TABLE public.product_favorites_user ADD CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id);
ALTER TABLE public.products ADD CONSTRAINT products_gtin_upc_key UNIQUE (gtin_upc);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gstin_key UNIQUE (gstin);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pan_key UNIQUE (pan);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE public.razorpay_webhook_events ADD CONSTRAINT razorpay_webhook_events_event_id_key UNIQUE (event_id);
ALTER TABLE public.reward_point_config ADD CONSTRAINT reward_point_config_action_tier_key UNIQUE (action, tier);
ALTER TABLE public.signup_drafts ADD CONSTRAINT signup_drafts_user_id_key UNIQUE (user_id);
ALTER TABLE public.states ADD CONSTRAINT states_name_code_key UNIQUE (name_code);
ALTER TABLE public.store_categories ADD CONSTRAINT store_categories_category_name_key UNIQUE (category_name);
ALTER TABLE public.subscription_tiers ADD CONSTRAINT subscription_tiers_tier_key_key UNIQUE (tier_key);
ALTER TABLE public.test_cases ADD CONSTRAINT test_cases_tc_id_key UNIQUE (tc_id);
ALTER TABLE public.tier_config ADD CONSTRAINT tier_config_tier_name_key UNIQUE (tier_name);
ALTER TABLE public.user_app_registry ADD CONSTRAINT user_app_registry_user_id_app_id_key UNIQUE (user_id, app_id);
ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_device_token_key UNIQUE (device_token);
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_app_id_user_id_feature_key_key UNIQUE (app_id, user_id, feature_key);
ALTER TABLE public.user_profiles ADD CONSTRAINT merchants_email_key UNIQUE (email);
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_phone_key UNIQUE (phone);

-- FOREIGN KEYS
ALTER TABLE public."VEDIC_profiles" ADD CONSTRAINT "VEDIC_profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.app_files ADD CONSTRAINT app_files_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.app_files ADD CONSTRAINT app_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES app_folders(id) ON DELETE CASCADE;
ALTER TABLE public.app_folders ADD CONSTRAINT app_folders_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.app_folders ADD CONSTRAINT app_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES app_folders(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_drafts ADD CONSTRAINT campaign_drafts_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id);
ALTER TABLE public.campaign_interactions ADD CONSTRAINT campaign_interactions_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.campaign_templates ADD CONSTRAINT campaign_templates_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_store_id_fkey FOREIGN KEY (store_id) REFERENCES merchant_stores(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.cities ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES states(id);
ALTER TABLE public.consumer_referrals ADD CONSTRAINT consumer_referrals_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES auth.users(id);
ALTER TABLE public.consumer_referrals ADD CONSTRAINT consumer_referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.consumer_requirements ADD CONSTRAINT consumer_requirements_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES consumer_requirements(id) ON DELETE CASCADE;
ALTER TABLE public.consumer_rewards ADD CONSTRAINT consumer_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.consumer_test_cases ADD CONSTRAINT consumer_test_cases_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.consumer_test_cases ADD CONSTRAINT consumer_test_cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES "VEDIC_profiles"(id) ON DELETE CASCADE;
ALTER TABLE public.consumer_test_runs ADD CONSTRAINT consumer_test_runs_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.consumer_test_runs ADD CONSTRAINT consumer_test_runs_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES "VEDIC_profiles"(id) ON DELETE CASCADE;
ALTER TABLE public.consumer_test_runs ADD CONSTRAINT consumer_test_runs_test_case_id_fkey FOREIGN KEY (test_case_id) REFERENCES consumer_test_cases(id) ON DELETE CASCADE;
ALTER TABLE public.deal_shares ADD CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE;
ALTER TABLE public.dealpro_test_plan_results ADD CONSTRAINT dealpro_test_plan_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.dealpro_test_plan_runs ADD CONSTRAINT dealpro_test_plan_runs_triggered_by_fkey FOREIGN KEY (triggered_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.diagrams ADD CONSTRAINT diagrams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.favorites ADD CONSTRAINT favorites_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE;
ALTER TABLE public.favorites ADD CONSTRAINT fk_favorites_merchant FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.feature_permissions ADD CONSTRAINT feature_permissions_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_accounts ADD CONSTRAINT fin_accounts_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_attachments ADD CONSTRAINT fin_attachments_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_budgets ADD CONSTRAINT fin_budgets_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expenses ADD CONSTRAINT fin_expenses_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.fin_expenses ADD CONSTRAINT fin_expenses_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_income ADD CONSTRAINT fin_income_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.fin_income ADD CONSTRAINT fin_income_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_income ADD CONSTRAINT fk_fin_income_invoice FOREIGN KEY (invoice_id) REFERENCES fin_invoices(id) ON DELETE SET NULL;
ALTER TABLE public.fin_invoice_items ADD CONSTRAINT fin_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES fin_invoices(id) ON DELETE CASCADE;
ALTER TABLE public.fin_invoices ADD CONSTRAINT fin_invoices_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_payments ADD CONSTRAINT fin_payments_account_id_fkey FOREIGN KEY (account_id) REFERENCES fin_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.fin_payments ADD CONSTRAINT fin_payments_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.fin_payments ADD CONSTRAINT fin_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES fin_invoices(id) ON DELETE SET NULL;
ALTER TABLE public.fin_tax_records ADD CONSTRAINT fin_tax_records_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.folder_permissions ADD CONSTRAINT folder_permissions_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES app_folders(id) ON DELETE CASCADE;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_used_by_fkey FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.kanban_task_attachments ADD CONSTRAINT kanban_task_attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES kanban_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.kanban_task_comments ADD CONSTRAINT kanban_task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES kanban_tasks(id) ON DELETE CASCADE;
ALTER TABLE public.localities ADD CONSTRAINT localities_city_id_fkey FOREIGN KEY (city_id) REFERENCES cities(id);
ALTER TABLE public.merchant_addon_subscriptions ADD CONSTRAINT merchant_addon_subscriptions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES merchant_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE public.merchant_payments ADD CONSTRAINT merchant_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES merchant_subscriptions(id);
ALTER TABLE public.merchant_payouts ADD CONSTRAINT merchant_payouts_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.merchant_profiles ADD CONSTRAINT merchant_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.merchant_ratings ADD CONSTRAINT fk_merchant_ratings_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE;
ALTER TABLE public.merchant_ratings ADD CONSTRAINT merchant_ratings_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.merchant_requirements ADD CONSTRAINT merchant_requirements_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES merchant_requirements(id) ON DELETE CASCADE;
ALTER TABLE public.merchant_staff ADD CONSTRAINT merchant_staff_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE public.merchant_staff ADD CONSTRAINT merchant_staff_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.merchant_staff ADD CONSTRAINT merchant_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.merchant_staff_invites ADD CONSTRAINT merchant_staff_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id);
ALTER TABLE public.merchant_staff_invites ADD CONSTRAINT merchant_staff_invites_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.merchant_stores ADD CONSTRAINT merchant_stores_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.merchant_usage ADD CONSTRAINT merchant_usage_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES merchant_subscriptions(id);
ALTER TABLE public.milestone_claims ADD CONSTRAINT milestone_claims_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES reward_milestones(id) ON DELETE CASCADE;
ALTER TABLE public.milestone_claims ADD CONSTRAINT milestone_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pinned_deals ADD CONSTRAINT fk_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id);
ALTER TABLE public.pinned_deals ADD CONSTRAINT pinned_deals_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.points_transactions ADD CONSTRAINT points_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.product_favorites_user ADD CONSTRAINT product_favorites_user_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.product_favorites_user ADD CONSTRAINT product_favorites_user_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public.product_favorites_user ADD CONSTRAINT product_favorites_user_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.products ADD CONSTRAINT fk_merchant_profile FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.signup_drafts ADD CONSTRAINT signup_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.stores ADD CONSTRAINT stores_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_audit_logs ADD CONSTRAINT subscription_audit_logs_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES merchant_subscriptions(id);
ALTER TABLE public.test_cases ADD CONSTRAINT test_cases_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.test_runs ADD CONSTRAINT test_runs_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.test_runs ADD CONSTRAINT test_runs_test_case_id_fkey FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE;
ALTER TABLE public.transaction_claims ADD CONSTRAINT transaction_claims_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id);
ALTER TABLE public.transaction_claims ADD CONSTRAINT transaction_claims_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES user_profiles(id);
ALTER TABLE public.user_app_registry ADD CONSTRAINT user_app_registry_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.user_app_registry ADD CONSTRAINT user_app_registry_user_id_fkey FOREIGN KEY (user_id) REFERENCES "VEDIC_profiles"(id) ON DELETE CASCADE;
ALTER TABLE public.user_devices ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL;
ALTER TABLE public.user_notifications ADD CONSTRAINT user_notifications_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES merchant_profiles(id);
ALTER TABLE public.user_permission_overrides ADD CONSTRAINT user_permission_overrides_app_id_fkey FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE;
ALTER TABLE public.web_login_requests ADD CONSTRAINT web_login_requests_merchant_id_fkey FOREIGN KEY (merchant_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- INDEXES
CREATE INDEX idx_app_files_app_id ON public.app_files USING btree (app_id);
CREATE INDEX idx_app_files_folder_id ON public.app_files USING btree (folder_id);
CREATE INDEX idx_app_files_storage_path ON public.app_files USING btree (storage_path);
CREATE INDEX idx_app_folders_app_id ON public.app_folders USING btree (app_id);
CREATE INDEX idx_app_folders_parent_id ON public.app_folders USING btree (parent_id);
CREATE INDEX idx_app_folders_path ON public.app_folders USING btree (app_id, path);
CREATE INDEX campaign_drafts_merchant_idx ON public.campaign_drafts USING btree (merchant_id);
CREATE INDEX campaign_drafts_updated_at_idx ON public.campaign_drafts USING btree (updated_at);
CREATE INDEX idx_campaign_interactions_claim_no ON public.campaign_interactions USING btree (claim_no);
CREATE INDEX idx_ci_campaign_redeemed ON public.campaign_interactions USING btree (campaign_id, is_redeemed);
CREATE INDEX idx_ci_campaign_time ON public.campaign_interactions USING btree (campaign_id, click_at DESC);
CREATE INDEX idx_ci_claim_no ON public.campaign_interactions USING btree (claim_no) WHERE (claim_no IS NOT NULL);
CREATE INDEX idx_ci_consumer_campaign ON public.campaign_interactions USING btree (consumer_id, campaign_id);
CREATE INDEX idx_ci_consumer_clicks ON public.campaign_interactions USING btree (consumer_id, click_at DESC);
CREATE INDEX idx_ci_consumer_pending ON public.campaign_interactions USING btree (consumer_id, interaction_id DESC) WHERE (is_redeemed = true);
CREATE INDEX idx_ci_consumer_redeemed ON public.campaign_interactions USING btree (consumer_id, is_redeemed, redeemed_at DESC);
CREATE INDEX idx_ci_merchant_redeemed ON public.campaign_interactions USING btree (merchant_id, is_redeemed, redeemed_at DESC);
CREATE INDEX idx_ci_merchant_time ON public.campaign_interactions USING btree (merchant_id, redeemed_at DESC);
CREATE INDEX idx_interactions_campaign ON public.campaign_interactions USING btree (campaign_id);
CREATE INDEX idx_interactions_consumer ON public.campaign_interactions USING btree (consumer_id);
CREATE INDEX idx_interactions_merchant ON public.campaign_interactions USING btree (merchant_id);
CREATE INDEX idx_campaign_templates_category ON public.campaign_templates USING btree (category);
CREATE INDEX idx_campaign_templates_merchant ON public.campaign_templates USING btree (merchant_id);
CREATE INDEX idx_campaign_templates_type ON public.campaign_templates USING btree (template_type);
CREATE INDEX idx_camp_campaign_id ON public.campaigns USING btree (campaign_id);
CREATE INDEX idx_camp_created ON public.campaigns USING btree (created_at DESC);
CREATE INDEX idx_camp_deal_of_day ON public.campaigns USING btree (start_date DESC) WHERE ((is_deal_of_the_day = true) AND (status = 'active'::campaign_status));
CREATE INDEX idx_camp_merchant ON public.campaigns USING btree (merchant_id, created_at DESC);
CREATE INDEX idx_camp_merchant_status ON public.campaigns USING btree (merchant_id, status);
CREATE INDEX idx_camp_status_time ON public.campaigns USING btree (status, created_at DESC);
CREATE INDEX idx_campaigns_dates ON public.campaigns USING btree (start_date, end_date);
CREATE INDEX idx_campaigns_deal_of_day_active ON public.campaigns USING btree (is_deal_of_the_day) WHERE (status = 'active'::campaign_status);
CREATE INDEX idx_campaigns_latlong ON public.campaigns USING btree (latlong);
CREATE INDEX idx_campaigns_merchant ON public.campaigns USING btree (merchant_id);
CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status);
CREATE INDEX idx_campaigns_store_id ON public.campaigns USING btree (store_id);
CREATE INDEX idx_consumer_ref_code ON public.consumer_referrals USING btree (referral_code);
CREATE INDEX idx_consumer_ref_referee ON public.consumer_referrals USING btree (referee_id);
CREATE INDEX idx_consumer_ref_referrer ON public.consumer_referrals USING btree (referrer_id);
CREATE INDEX idx_consumer_req_parent ON public.consumer_requirements USING btree (parent_id);
CREATE INDEX idx_consumer_req_type ON public.consumer_requirements USING btree (item_type);
CREATE INDEX idx_consumer_rewards_user ON public.consumer_rewards USING btree (user_id);
CREATE INDEX idx_consumer_test_cases_app_id ON public.consumer_test_cases USING btree (app_id);
CREATE INDEX idx_consumer_test_cases_created_by ON public.consumer_test_cases USING btree (created_by);
CREATE INDEX idx_consumer_test_runs_app_id ON public.consumer_test_runs USING btree (app_id);
CREATE INDEX idx_consumer_test_runs_executed_by ON public.consumer_test_runs USING btree (executed_by);
CREATE INDEX idx_consumer_test_runs_test_case_id ON public.consumer_test_runs USING btree (test_case_id);
CREATE UNIQUE INDEX contractor_codes_aadhaar_hash_uidx ON public.contractor_codes USING btree (aadhaar_hash) WHERE (aadhaar_hash IS NOT NULL);
CREATE INDEX contractor_codes_active_code_idx ON public.contractor_codes USING btree (code) WHERE (active_status = true);
CREATE INDEX idx_deal_shares_campaign ON public.deal_shares USING btree (campaign_id);
CREATE INDEX idx_deal_shares_shared_by ON public.deal_shares USING btree (shared_by, created_at DESC);
CREATE INDEX idx_deal_shares_shared_with ON public.deal_shares USING btree (shared_with, created_at DESC);
CREATE INDEX dealpro_test_plan_results_is_auto_idx ON public.dealpro_test_plan_results USING btree (is_auto_test) WHERE (is_auto_test = true);
CREATE INDEX dealpro_test_plan_results_run_idx ON public.dealpro_test_plan_results USING btree (run_id) WHERE (run_id IS NOT NULL);
CREATE INDEX dealpro_test_plan_results_test_idx ON public.dealpro_test_plan_results USING btree (test_id);
CREATE INDEX dealpro_test_plan_results_user_idx ON public.dealpro_test_plan_results USING btree (user_id);
CREATE INDEX dealpro_test_plan_runs_status_idx ON public.dealpro_test_plan_runs USING btree (status);
CREATE INDEX dealpro_test_plan_runs_triggered_at_idx ON public.dealpro_test_plan_runs USING btree (triggered_at DESC);
CREATE INDEX diagrams_owner_idx ON public.diagrams USING btree (owner_id);
CREATE INDEX diagrams_updated_idx ON public.diagrams USING btree (updated_at DESC);
CREATE INDEX idx_favorites_consumer ON public.favorites USING btree (user_id);
CREATE INDEX idx_fcm_tokens_device_token ON public.fcm_tokens USING btree (device_token);
CREATE INDEX idx_fcm_tokens_last_used ON public.fcm_tokens USING btree (last_used_at);
CREATE INDEX idx_fcm_tokens_user_id ON public.fcm_tokens USING btree (user_id) WHERE (is_active = true);
CREATE INDEX idx_feature_permissions_app_role ON public.feature_permissions USING btree (app_id, role);
CREATE INDEX idx_fin_accounts_app ON public.fin_accounts USING btree (app_id);
CREATE INDEX idx_fin_attach_app ON public.fin_attachments USING btree (app_id);
CREATE INDEX idx_fin_attach_path ON public.fin_attachments USING btree (storage_path);
CREATE INDEX idx_fin_attach_record ON public.fin_attachments USING btree (record_type, record_id);
CREATE INDEX idx_fin_budgets_app ON public.fin_budgets USING btree (app_id);
CREATE INDEX idx_fin_budgets_cat ON public.fin_budgets USING btree (category, period_type);
CREATE INDEX idx_fin_expenses_account ON public.fin_expenses USING btree (account_id);
CREATE INDEX idx_fin_expenses_app ON public.fin_expenses USING btree (app_id);
CREATE INDEX idx_fin_expenses_category ON public.fin_expenses USING btree (category);
CREATE INDEX idx_fin_expenses_date ON public.fin_expenses USING btree (date);
CREATE INDEX idx_fin_income_account ON public.fin_income USING btree (account_id);
CREATE INDEX idx_fin_income_app ON public.fin_income USING btree (app_id);
CREATE INDEX idx_fin_income_date ON public.fin_income USING btree (date);
CREATE INDEX idx_fin_invoice_items_invoice ON public.fin_invoice_items USING btree (invoice_id);
CREATE INDEX idx_fin_invoices_app ON public.fin_invoices USING btree (app_id);
CREATE INDEX idx_fin_invoices_date ON public.fin_invoices USING btree (date);
CREATE INDEX idx_fin_invoices_status ON public.fin_invoices USING btree (status);
CREATE INDEX idx_fin_payments_app ON public.fin_payments USING btree (app_id);
CREATE INDEX idx_fin_payments_date ON public.fin_payments USING btree (date);
CREATE INDEX idx_fin_payments_invoice ON public.fin_payments USING btree (invoice_id);
CREATE INDEX idx_fin_tax_app ON public.fin_tax_records USING btree (app_id);
CREATE INDEX idx_fin_tax_period ON public.fin_tax_records USING btree (period_year, period_month);
CREATE INDEX idx_folder_permissions_folder_id ON public.folder_permissions USING btree (folder_id);
CREATE INDEX idx_folder_permissions_user_id ON public.folder_permissions USING btree (user_id);
CREATE INDEX idx_friendships_addressee ON public.friendships USING btree (addressee_id, status);
CREATE INDEX idx_friendships_requester ON public.friendships USING btree (requester_id, status);
CREATE INDEX idx_geocode_cache_expires ON public.geocode_cache USING btree (expires_at);
CREATE INDEX idx_geocode_cache_key ON public.geocode_cache USING btree (query_key);
CREATE INDEX invite_codes_code_idx ON public.invite_codes USING btree (code);
CREATE INDEX idx_kanban_attachments_task ON public.kanban_task_attachments USING btree (task_id, created_at);
CREATE INDEX idx_kanban_comments_task ON public.kanban_task_comments USING btree (task_id, created_at);
CREATE INDEX idx_kanban_tasks_app_id ON public.kanban_tasks USING btree (app_id);
CREATE INDEX idx_kanban_tasks_app_status ON public.kanban_tasks USING btree (app_id, status);
CREATE INDEX idx_localities_city ON public.localities USING btree (city_id);
CREATE INDEX idx_localities_coords ON public.localities USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));
CREATE INDEX idx_localities_names_gin ON public.localities USING gin (names);
CREATE INDEX idx_localities_pincode ON public.localities USING btree (pincode varchar_pattern_ops);
CREATE INDEX idx_addon_sub_id ON public.merchant_addon_subscriptions USING btree (subscription_id, status);
CREATE INDEX idx_merchant_logs_group ON public.merchant_audit_logs USING btree (action_group);
CREATE INDEX idx_merchant_logs_id ON public.merchant_audit_logs USING btree (merchant_id);
CREATE INDEX idx_bank_merchant ON public.merchant_bank_details USING btree (merchant_id);
CREATE INDEX idx_pay_merchant_state ON public.merchant_payments USING btree (merchant_id, billing_state);
CREATE INDEX idx_pay_transaction_id ON public.merchant_payments USING btree (transaction_id);
CREATE INDEX idx_merchant_consumer_referral ON public.merchant_profiles USING btree (consumer_referral_code);
CREATE INDEX idx_merchant_merchant_referral ON public.merchant_profiles USING btree (merchant_referral_code);
CREATE INDEX idx_mprof_phone ON public.merchant_profiles USING btree (phone);
CREATE INDEX idx_mprof_role ON public.merchant_profiles USING btree (role);
CREATE INDEX idx_merchant_ratings_merchant_id ON public.merchant_ratings USING btree (merchant_id);
CREATE INDEX idx_merchant_req_parent ON public.merchant_requirements USING btree (parent_id);
CREATE INDEX idx_merchant_req_type ON public.merchant_requirements USING btree (item_type);
CREATE INDEX idx_rewards_log_merchant ON public.merchant_rewards_log USING btree (merchant_id);
CREATE INDEX idx_merchant_staff_merchant ON public.merchant_staff USING btree (merchant_id);
CREATE INDEX idx_merchant_staff_user ON public.merchant_staff USING btree (user_id);
CREATE INDEX idx_staff_invites_code ON public.merchant_staff_invites USING btree (invite_code);
CREATE INDEX idx_staff_invites_merchant ON public.merchant_staff_invites USING btree (merchant_id);
CREATE INDEX idx_merchant_stores_merchant_id ON public.merchant_stores USING btree (merchant_id);
CREATE INDEX idx_sub_merchant_id ON public.merchant_subscriptions USING btree (merchant_id);
CREATE INDEX merchant_subscriptions_is_test_idx ON public.merchant_subscriptions USING btree (is_test_subscription) WHERE (is_test_subscription = true);
CREATE UNIQUE INDEX merchant_subscriptions_razorpay_sub_uidx ON public.merchant_subscriptions USING btree (razorpay_subscription_id);
CREATE INDEX idx_usage_lookup ON public.merchant_usage USING btree (merchant_id, feature_key);
CREATE INDEX idx_milestone_claims_user ON public.milestone_claims USING btree (user_id);
CREATE INDEX idx_notification_logs_dedup ON public.notification_logs USING btree (merchant_id, notification_type, created_at DESC);
CREATE INDEX idx_notification_logs_type_status ON public.notification_logs USING btree (notification_type, status, created_at DESC);
CREATE INDEX idx_perf_traces_action ON public.performance_traces USING btree (action_name, created_at DESC);
CREATE INDEX idx_perf_traces_app ON public.performance_traces USING btree (app_key, created_at DESC);
CREATE INDEX idx_perf_traces_created_at ON public.performance_traces USING btree (created_at DESC);
CREATE INDEX idx_pinned_deals_campaign_id ON public.pinned_deals USING btree (campaign_id);
CREATE INDEX idx_pinned_deals_created_at ON public.pinned_deals USING btree (created_at DESC);
CREATE INDEX idx_pinned_deals_merchant_id ON public.pinned_deals USING btree (merchant_id);
CREATE INDEX idx_pinned_deals_user_campaign ON public.pinned_deals USING btree (user_id, campaign_id);
CREATE INDEX idx_pinned_deals_user_id ON public.pinned_deals USING btree (user_id);
CREATE INDEX platform_errors_captured_at_idx ON public.platform_errors USING btree (captured_at DESC);
CREATE INDEX platform_errors_error_type_idx ON public.platform_errors USING btree (error_type);
CREATE INDEX platform_errors_is_resolved_idx ON public.platform_errors USING btree (is_resolved);
CREATE INDEX platform_errors_severity_idx ON public.platform_errors USING btree (severity);
CREATE INDEX idx_points_tx_action ON public.points_transactions USING btree (action);
CREATE INDEX idx_points_tx_created ON public.points_transactions USING btree (created_at DESC);
CREATE INDEX idx_points_tx_user ON public.points_transactions USING btree (user_id);
CREATE INDEX idx_product_favorites_merchant_id ON public.product_favorites_user USING btree (merchant_id);
CREATE INDEX idx_product_favorites_product_id ON public.product_favorites_user USING btree (product_id);
CREATE INDEX idx_product_favorites_user_id ON public.product_favorites_user USING btree (user_id, created_at DESC);
CREATE INDEX idx_products_active ON public.products USING btree (is_active) WHERE (is_active = true);
CREATE INDEX idx_products_attributes_gin ON public.products USING gin (attributes);
CREATE INDEX idx_products_consent_date ON public.products USING btree (merch_consent_date);
CREATE INDEX idx_products_consented ON public.products USING btree (merchant_consent) WHERE (merchant_consent = true);
CREATE INDEX idx_products_merchant_id ON public.products USING btree (merchant_id);
CREATE INDEX idx_products_stock_available ON public.products USING btree ((((stock_count IS NULL) OR (stock_count > 0)))) WHERE (is_active = true);
CREATE INDEX razorpay_webhook_events_sub_idx ON public.razorpay_webhook_events USING btree (razorpay_subscription_id);
CREATE INDEX idx_reward_point_config_action_tier ON public.reward_point_config USING btree (action, tier) WHERE (is_active = true);
CREATE INDEX signup_drafts_updated_at_idx ON public.signup_drafts USING btree (updated_at);
CREATE INDEX idx_stores_merchant ON public.stores USING btree (merchant_id);
CREATE INDEX idx_test_cases_app_id ON public.test_cases USING btree (app_id);
CREATE INDEX idx_test_cases_created_by ON public.test_cases USING btree (created_by);
CREATE INDEX idx_test_cases_module ON public.test_cases USING btree (module);
CREATE INDEX idx_test_runs_app_id ON public.test_runs USING btree (app_id);
CREATE INDEX idx_test_runs_executed_by ON public.test_runs USING btree (executed_by);
CREATE INDEX idx_test_runs_release ON public.test_runs USING btree (release);
CREATE INDEX idx_test_runs_status ON public.test_runs USING btree (status);
CREATE INDEX idx_test_runs_test_case_id ON public.test_runs USING btree (test_case_id);
CREATE INDEX idx_tier_config_sort ON public.tier_config USING btree (sort_order) WHERE (is_active = true);
CREATE INDEX idx_ual_campaign ON public.user_activity_logs USING btree (campaign_id, created_at DESC) WHERE (campaign_id IS NOT NULL);
CREATE INDEX idx_ual_created_at ON public.user_activity_logs USING btree (created_at DESC);
CREATE INDEX idx_ual_event_time ON public.user_activity_logs USING btree (event_type, created_at DESC);
CREATE INDEX idx_ual_event_type ON public.user_activity_logs USING btree (event_type);
CREATE INDEX idx_ual_merchant ON public.user_activity_logs USING btree (merchant_id, created_at DESC) WHERE (merchant_id IS NOT NULL);
CREATE INDEX idx_ual_screen ON public.user_activity_logs USING btree (screen, created_at DESC) WHERE (screen IS NOT NULL);
CREATE INDEX idx_ual_user_event ON public.user_activity_logs USING btree (user_id, event_type, created_at DESC);
CREATE INDEX idx_ual_user_id ON public.user_activity_logs USING btree (user_id);
CREATE INDEX idx_ual_user_time ON public.user_activity_logs USING btree (user_id, created_at DESC);
CREATE INDEX idx_user_app_registry_app_id ON public.user_app_registry USING btree (app_id);
CREATE INDEX idx_user_app_registry_user_id ON public.user_app_registry USING btree (user_id);
CREATE INDEX idx_user_notifications_unread ON public.user_notifications USING btree (user_id, is_read) WHERE (is_read = false);
CREATE INDEX idx_user_notifications_user_id ON public.user_notifications USING btree (user_id);
CREATE INDEX idx_user_permission_overrides_app_user ON public.user_permission_overrides USING btree (app_id, user_id);
CREATE INDEX idx_uprof_location ON public.user_profiles USING btree (home_location);
CREATE INDEX idx_uprof_phone ON public.user_profiles USING btree (phone);
CREATE INDEX idx_uprof_push ON public.user_profiles USING btree (push_notification) WHERE (push_notification = true);
CREATE INDEX idx_uprof_role ON public.user_profiles USING btree (role);
CREATE UNIQUE INDEX idx_user_profiles_auth_uid ON public.user_profiles USING btree (auth_uid) WHERE (auth_uid IS NOT NULL);
CREATE INDEX idx_user_referral_code ON public.user_profiles USING btree (referral_code);
CREATE INDEX idx_wlr_expires ON public.web_login_requests USING btree (expires_at);
CREATE INDEX idx_wlr_merchant_status ON public.web_login_requests USING btree (merchant_id, status);

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

CREATE OR REPLACE FUNCTION public.auto_create_merchant_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.role = 'merchant' THEN
    INSERT INTO public.merchant_staff (merchant_id, user_id, role, display_name, phone, status)
    VALUES (NEW.id, NEW.id, 'owner', COALESCE(NEW.full_name, NEW.store_name, 'Owner'), NEW.phone, 'active')
    ON CONFLICT (merchant_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.award_consumer_points(p_user_id uuid, p_points integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_new_lifetime int;
  v_new_tier     text;
  v_old_tier     text;
BEGIN
  -- Upsert: create row if first time, or increment atomically
  INSERT INTO consumer_rewards (user_id, points_balance, lifetime_points, tier, updated_at)
  VALUES (p_user_id, p_points, p_points, 'bronze', now())
  ON CONFLICT (user_id) DO UPDATE SET
    points_balance  = consumer_rewards.points_balance + p_points,
    lifetime_points = consumer_rewards.lifetime_points + p_points,
    updated_at      = now();

  -- Recalculate tier
  SELECT lifetime_points, tier INTO v_new_lifetime, v_old_tier
  FROM consumer_rewards WHERE user_id = p_user_id;

  v_new_tier := calculate_tier(v_new_lifetime);

  IF v_new_tier <> v_old_tier THEN
    UPDATE consumer_rewards
    SET tier = v_new_tier, tier_updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_tier(p_lifetime_points integer)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_tier text := 'bronze';
BEGIN
  SELECT tier_name INTO v_tier
  FROM tier_config
  WHERE is_active = TRUE AND min_points <= p_lifetime_points
  ORDER BY min_points DESC
  LIMIT 1;

  RETURN COALESCE(v_tier, 'bronze');
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

CREATE OR REPLACE FUNCTION public.cleanup_stale_drafts()
 RETURNS TABLE(campaign_drafts_deleted integer, signup_drafts_deleted integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  c int;
  s int;
BEGIN
  WITH d AS (
    DELETE FROM public.campaign_drafts
    WHERE updated_at < now() - interval '30 days'
    RETURNING id
  )
  SELECT count(*)::int INTO c FROM d;

  WITH d AS (
    DELETE FROM public.signup_drafts
    WHERE updated_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*)::int INTO s FROM d;

  RETURN QUERY SELECT c, s;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.contractor_codes_set_modified()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.last_modified_date = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.diagrams_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;

CREATE OR REPLACE FUNCTION public.expire_ended_campaigns()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  expired_count INT;
BEGIN
  UPDATE public.campaigns
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  IF expired_count > 0 THEN
    RAISE NOTICE '[expire_ended_campaigns] Expired % campaign(s)', expired_count;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(col_name text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  exists_count INT;
BEGIN
  FOR attempt IN 1..10 LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;

    -- Check uniqueness
    IF col_name = 'consumer_referral_code' THEN
      SELECT COUNT(*) INTO exists_count FROM merchant_profiles WHERE consumer_referral_code = code;
    ELSE
      SELECT COUNT(*) INTO exists_count FROM merchant_profiles WHERE merchant_referral_code = code;
    END IF;

    IF exists_count = 0 THEN
      RETURN code;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Failed to generate unique code after 10 attempts';
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
      'campaign_id', c.campaign_id,
      'merchant_id', c.merchant_id,
      'shop_name', c.shop_name,
      'deal_heading', c.deal_heading,
      'offer_value', c.offer_value,
      'category', COALESCE(s.store_category, c.category, 'General'),
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
      'store_id', c.store_id,
      'media_urls', c.media_urls,
      'video_url', c.video_url,
      'is_deal_of_the_day', c.is_deal_of_the_day,
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

CREATE OR REPLACE FUNCTION public.get_rewards_summary(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_rewards     jsonb;
  v_history     jsonb;
  v_milestones  jsonb;
  v_stats       jsonb;
  v_next_tier   jsonb;
  v_current_tier text;
  v_lifetime    int;
  v_cur_order   int;
  v_next_name   text;
  v_next_min    int;
BEGIN
  -- 1. Core rewards
  SELECT jsonb_build_object(
    'points_balance', COALESCE(r.points_balance, 0),
    'lifetime_points', COALESCE(r.lifetime_points, 0),
    'tier', COALESCE(r.tier, 'bronze'),
    'streak_days', COALESCE(r.streak_days, 0)
  ) INTO v_rewards
  FROM consumer_rewards r WHERE r.user_id = p_user_id;

  IF v_rewards IS NULL THEN
    v_rewards := '{"points_balance":0,"lifetime_points":0,"tier":"bronze","streak_days":0}'::jsonb;
  END IF;

  v_current_tier := v_rewards->>'tier';
  v_lifetime := (v_rewards->>'lifetime_points')::int;

  -- 2. Recent transactions (last 20)
  SELECT COALESCE(jsonb_agg(t ORDER BY t.created_at DESC), '[]'::jsonb) INTO v_history
  FROM (
    SELECT action, points, campaign_id, metadata, created_at
    FROM points_transactions
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  -- 3. Milestones (all active + whether user claimed each)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'name', m.name,
      'description', m.description,
      'milestone_type', m.milestone_type,
      'threshold', m.threshold,
      'bonus_points', m.bonus_points,
      'badge_icon', m.badge_icon,
      'claimed', (mc.id IS NOT NULL),
      'claimed_at', mc.claimed_at
    )
  ), '[]'::jsonb) INTO v_milestones
  FROM reward_milestones m
  LEFT JOIN milestone_claims mc ON mc.milestone_id = m.id AND mc.user_id = p_user_id
  WHERE m.is_active = true;

  -- 4. Stats
  SELECT jsonb_build_object(
    'total_deals_claimed', (SELECT COUNT(*) FROM points_transactions WHERE user_id = p_user_id AND action IN ('claim_deal','redeem_deal')),
    'total_referrals', (SELECT COUNT(*) FROM consumer_referrals WHERE referrer_id = p_user_id AND status <> 'pending'),
    'milestones_earned', (SELECT COUNT(*) FROM milestone_claims WHERE user_id = p_user_id)
  ) INTO v_stats;

  -- 5. Next tier progress (dynamic from tier_config)
  SELECT sort_order INTO v_cur_order
  FROM tier_config
  WHERE tier_name = v_current_tier AND is_active = TRUE;

  IF v_cur_order IS NULL THEN v_cur_order := 0; END IF;

  SELECT tier_name, min_points INTO v_next_name, v_next_min
  FROM tier_config
  WHERE is_active = TRUE AND sort_order > v_cur_order
  ORDER BY sort_order ASC
  LIMIT 1;

  IF v_next_name IS NOT NULL THEN
    v_next_tier := jsonb_build_object(
      'next_tier', v_next_name,
      'points_needed', GREATEST(v_next_min - v_lifetime, 0)
    );
  ELSE
    v_next_tier := jsonb_build_object('next_tier', null, 'points_needed', 0);
  END IF;

  RETURN jsonb_build_object(
    'rewards',    v_rewards,
    'history',    v_history,
    'milestones', v_milestones,
    'stats',      v_stats,
    'next_tier',  v_next_tier
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.grant_free_month(m_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  sub RECORD;
  new_end TIMESTAMPTZ;
  old_end TIMESTAMPTZ;
  is_in_trial BOOLEAN;
BEGIN
  -- Find the merchant's active subscription
  SELECT * INTO sub
  FROM public.merchant_subscriptions
  WHERE merchant_id = m_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF sub IS NULL THEN
    RAISE NOTICE '[grant_free_month] No active subscription for merchant %', m_id;
    RETURN;
  END IF;

  -- Check if merchant is still in trial period
  is_in_trial := (sub.trial_end IS NOT NULL AND sub.trial_end > now());

  IF is_in_trial THEN
    -- Extend the trial_end by 30 days
    old_end := sub.trial_end;
    new_end := sub.trial_end + INTERVAL '30 days';

    UPDATE public.merchant_subscriptions
    SET trial_end = new_end,
        current_period_end = new_end,
        updated_at = now()
    WHERE id = sub.id;
  ELSE
    -- Extend the current_period_end by 30 days (paid period)
    old_end := sub.current_period_end;
    new_end := COALESCE(sub.current_period_end, now()) + INTERVAL '30 days';

    UPDATE public.merchant_subscriptions
    SET current_period_end = new_end,
        updated_at = now()
    WHERE id = sub.id;
  END IF;

  -- Audit log
  INSERT INTO public.merchant_rewards_log (merchant_id, reward_type, referral_count, reward_month, days_extended, old_end_date, new_end_date)
  VALUES (m_id, 'free_month', 20, date_trunc('month', now())::DATE, 30, old_end, new_end);

  RAISE NOTICE '[grant_free_month] Extended merchant % subscription by 30 days (% -> %)', m_id, old_end, new_end;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invite_codes_single_use_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.max_uses = 1 and new.used_count > 0 then
    if new.used_by is null or new.used_at is null then
      raise exception 'For single-use invites, used_by and used_at must be set when used_count > 0';
    end if;
    if new.used_count > 1 then
      raise exception 'Single-use invite cannot be used more than once';
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_app_admin(p_app_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_app_registry
    WHERE user_id = auth.uid() AND app_id = p_app_id
      AND role IN ('admin', 'owner') AND is_active = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_app_member(p_app_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_app_registry
    WHERE user_id = auth.uid() AND app_id = p_app_id AND is_active = true
  );
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

CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_app_registry
    WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.notify_upcoming_trial_ends()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  r RECORD;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  edge_function_url := 'https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/send-trial-email';
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdrdWx5eGdsenFsaHBxeGx3anF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg2MDgyMiwiZXhwIjoyMDg0NDM2ODIyfQ.9XiwXcNaci-ELD3Z95dIuF_InFc_GQOiO3ZmS-Ma7jw';

  FOR r IN
    SELECT
      ms.id AS subscription_id,
      ms.merchant_id,
      ms.plan_name,
      ms.current_period_end,
      COALESCE(ms.total_recurring_amount, st.subscription_fee, 0) AS total_recurring_amount,
      COALESCE(st.tier_name, ms.plan_name) AS tier_name,
      COALESCE(st.currency, 'INR') AS currency
    FROM public.merchant_subscriptions ms
    LEFT JOIN public.subscription_tiers st ON st.tier_key = ms.plan_name
    WHERE ms.status = 'active'
      AND ms.cancel_at_period_end = false
      AND ms.current_period_end IS NOT NULL
      AND ms.current_period_end >= (NOW() + INTERVAL '2 days 12 hours')
      AND ms.current_period_end < (NOW() + INTERVAL '3 days 12 hours')
      AND ms.last_notified_at IS NULL
  LOOP
    PERFORM net.http_post(
      url := edge_function_url,
      body := json_build_object(
        'merchant_id', r.merchant_id,
        'subscription_id', r.subscription_id,
        'total_recurring_amount', r.total_recurring_amount,
        'plan_name', r.plan_name,
        'tier_name', r.tier_name,
        'currency', r.currency,
        'trial_end', r.current_period_end
      )::jsonb,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )::jsonb
    );

    INSERT INTO public.user_notifications (user_id, type, title, body, merchant_id)
    VALUES (
      r.merchant_id::uuid,
      'trial_expiry_3day',
      'Your DealPro trial ends in 3 days!',
      'Your first payment of ' || r.currency || r.total_recurring_amount::text ||
        ' will be processed soon. Enjoy your remaining trial days with ' || r.tier_name || ' plan.',
      r.merchant_id::uuid
    );
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.process_merchant_referral()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  referrer_merchant_id VARCHAR(255);
  ref_count INT;
  threshold INT;
BEGIN
  -- Only process if the new merchant used an invite code
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    RETURN NEW;
  END IF;

  -- Find the referrer by their merchant_referral_code matching the invite_code
  SELECT id INTO referrer_merchant_id
  FROM public.merchant_profiles
  WHERE merchant_referral_code = NEW.invite_code
    AND id != NEW.id
  LIMIT 1;

  IF referrer_merchant_id IS NULL THEN
    RAISE NOTICE '[process_merchant_referral] No merchant found with referral code %', NEW.invite_code;
    RETURN NEW;
  END IF;

  -- Insert into merchant_referrals with status = 'qualified'
  INSERT INTO public.merchant_referrals (referrer_id, referee_id, referral_code_used, status, qualified_at)
  VALUES (referrer_merchant_id, NEW.id, NEW.invite_code, 'qualified', now())
  ON CONFLICT (referee_id) DO NOTHING;

  -- Count qualified referrals for this referrer in the current calendar month
  SELECT COUNT(*) INTO ref_count
  FROM public.merchant_referrals
  WHERE referrer_id = referrer_merchant_id
    AND status = 'qualified'
    AND qualified_at >= date_trunc('month', now())
    AND qualified_at < date_trunc('month', now()) + INTERVAL '1 month';

  -- Fetch the configurable threshold
  SELECT (config_value->>'count')::INT INTO threshold
  FROM public.app_configs
  WHERE config_key = 'referral_reward_threshold';

  IF threshold IS NULL THEN
    threshold := 20; -- fallback default
  END IF;

  -- If referrer hit the threshold, grant free month (only once per month)
  IF ref_count >= threshold THEN
    -- Check if already rewarded this month
    IF NOT EXISTS (
      SELECT 1 FROM public.merchant_rewards_log
      WHERE merchant_id = referrer_merchant_id
        AND reward_month = date_trunc('month', now())::DATE
    ) THEN
      -- Call the edge function via pg_net to defer Google Play billing + update DB
      PERFORM net.http_post(
        url := 'https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/process-referral-reward',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'merchant_id', referrer_merchant_id,
          'subscription_id', (
            SELECT id FROM public.merchant_subscriptions
            WHERE merchant_id = referrer_merchant_id AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
          )
        )
      );
    END IF;
  END IF;

  RETURN NEW;
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

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_set_updated_at_dealpro_test_plan_results()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_campaign_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_daily_streak(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_last_date  date;
  v_today      date := current_date;
  v_streak     int;
  v_bonus      int := 0;
BEGIN
  -- Ensure row exists
  INSERT INTO consumer_rewards (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT streak_updated_on, streak_days INTO v_last_date, v_streak
  FROM consumer_rewards WHERE user_id = p_user_id;

  IF v_last_date IS NULL OR v_last_date < v_today - 1 THEN
    -- Streak broken or first login: reset to 1
    v_streak := 1;
  ELSIF v_last_date = v_today - 1 THEN
    -- Consecutive day: increment
    v_streak := v_streak + 1;
  ELSIF v_last_date = v_today THEN
    -- Already logged in today: no change
    RETURN jsonb_build_object('streak', v_streak, 'is_new_day', false, 'bonus', 0);
  END IF;

  UPDATE consumer_rewards
  SET streak_days = v_streak, streak_updated_on = v_today, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('streak', v_streak, 'is_new_day', true, 'bonus', v_bonus);
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

CREATE OR REPLACE FUNCTION public.update_reward_point_config_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_tier_config_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_timestamp()
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
CREATE OR REPLACE TRIGGER vedic_profiles_updated_at BEFORE UPDATE ON public."VEDIC_profiles" FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE OR REPLACE TRIGGER apps_updated_at BEFORE UPDATE ON public.apps FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE OR REPLACE TRIGGER campaign_drafts_set_updated_at BEFORE UPDATE ON public.campaign_drafts FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE OR REPLACE TRIGGER update_campaign_interactions_modtime BEFORE UPDATE ON public.campaign_interactions FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER campaign_templates_updated_at BEFORE UPDATE ON public.campaign_templates FOR EACH ROW EXECUTE FUNCTION update_campaign_templates_updated_at();
CREATE OR REPLACE TRIGGER update_campaigns_modtime BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER trg_consumer_req_updated BEFORE UPDATE ON public.consumer_requirements FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE OR REPLACE TRIGGER consumer_test_cases_updated_at BEFORE UPDATE ON public.consumer_test_cases FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE OR REPLACE TRIGGER contractor_codes_set_modified BEFORE UPDATE ON public.contractor_codes FOR EACH ROW EXECUTE FUNCTION contractor_codes_set_modified();
CREATE OR REPLACE TRIGGER dealpro_test_plan_results_set_updated_at BEFORE UPDATE ON public.dealpro_test_plan_results FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at_dealpro_test_plan_results();
CREATE OR REPLACE TRIGGER diagrams_set_updated_at BEFORE UPDATE ON public.diagrams FOR EACH ROW EXECUTE FUNCTION diagrams_set_updated_at();
CREATE OR REPLACE TRIGGER trigger_update_fcm_tokens_updated_at BEFORE UPDATE ON public.fcm_tokens FOR EACH ROW EXECUTE FUNCTION update_fcm_tokens_updated_at();
CREATE OR REPLACE TRIGGER update_hoardings_modtime BEFORE UPDATE ON public.hoardings FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER trg_invite_codes_single_use_guard BEFORE INSERT ON public.invite_codes FOR EACH ROW EXECUTE FUNCTION invite_codes_single_use_guard();
CREATE OR REPLACE TRIGGER trg_invite_codes_single_use_guard BEFORE UPDATE ON public.invite_codes FOR EACH ROW EXECUTE FUNCTION invite_codes_single_use_guard();
CREATE OR REPLACE TRIGGER update_merchant_images_modtime BEFORE UPDATE ON public.merchant_images FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER trg_auto_create_owner AFTER INSERT ON public.merchant_profiles FOR EACH ROW EXECUTE FUNCTION auto_create_merchant_owner();
CREATE OR REPLACE TRIGGER trg_process_merchant_referral AFTER INSERT ON public.merchant_profiles FOR EACH ROW EXECUTE FUNCTION process_merchant_referral();
CREATE OR REPLACE TRIGGER update_merchant_ratings_changetime BEFORE UPDATE ON public.merchant_ratings FOR EACH ROW EXECUTE FUNCTION update_rating_modified_column();
CREATE OR REPLACE TRIGGER trg_merchant_req_updated BEFORE UPDATE ON public.merchant_requirements FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE OR REPLACE TRIGGER trg_reward_point_config_updated BEFORE UPDATE ON public.reward_point_config FOR EACH ROW EXECUTE FUNCTION update_reward_point_config_timestamp();
CREATE OR REPLACE TRIGGER signup_drafts_set_updated_at BEFORE UPDATE ON public.signup_drafts FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE OR REPLACE TRIGGER update_store_categories_modtime BEFORE UPDATE ON public.store_categories FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER update_subscription_tiers_modtime BEFORE UPDATE ON public.subscription_tiers FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE OR REPLACE TRIGGER test_cases_updated_at BEFORE UPDATE ON public.test_cases FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE OR REPLACE TRIGGER trg_test_cases_updated BEFORE UPDATE ON public.test_cases FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE OR REPLACE TRIGGER trg_test_runs_updated BEFORE UPDATE ON public.test_runs FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE OR REPLACE TRIGGER trg_tier_config_updated BEFORE UPDATE ON public.tier_config FOR EACH ROW EXECUTE FUNCTION update_tier_config_timestamp();

-- RLS
ALTER TABLE public."VEDIC_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consumer_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealpro_test_plan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealpro_test_plan_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoardings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_addon_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pinned_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_favorites_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razorpay_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_point_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_app_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_login_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: owners can read all" ON public."VEDIC_profiles" AS PERMISSIVE FOR SELECT TO authenticated USING (is_owner());
CREATE POLICY "profiles: users can insert own profile" ON public."VEDIC_profiles" AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));
CREATE POLICY "profiles: users can read own profile" ON public."VEDIC_profiles" AS PERMISSIVE FOR SELECT TO authenticated USING ((id = auth.uid()));
CREATE POLICY "profiles: users can update own profile" ON public."VEDIC_profiles" AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
CREATE POLICY "apps: authenticated can read active apps" ON public.apps AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
CREATE POLICY merchants_modify_own_drafts ON public.campaign_drafts AS PERMISSIVE FOR ALL TO public USING ((merchant_id = auth.uid())) WITH CHECK ((merchant_id = auth.uid()));
CREATE POLICY merchants_read_own_drafts ON public.campaign_drafts AS PERMISSIVE FOR SELECT TO public USING ((merchant_id = auth.uid()));
CREATE POLICY "Allow consumers and merchants to select" ON public.campaign_interactions AS PERMISSIVE FOR SELECT TO authenticated USING ((((auth.uid())::text = (consumer_id)::text) OR (auth.uid() = merchant_id)));
CREATE POLICY "Allow individual insertion" ON public.campaign_interactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid())::text = (consumer_id)::text));
CREATE POLICY "Allow merchants to select their interactions" ON public.campaign_interactions AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = merchant_id));
CREATE POLICY "Allow merchants to update their interactions" ON public.campaign_interactions AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = merchant_id)) WITH CHECK ((auth.uid() = merchant_id));
CREATE POLICY "Users can insert their own interactions" ON public.campaign_interactions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid())::text = (consumer_id)::text));
CREATE POLICY "Merchants can create own templates" ON public.campaign_templates AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((template_type = 'personal'::text) AND (merchant_id = auth.uid())));
CREATE POLICY "Merchants can delete own templates" ON public.campaign_templates AS PERMISSIVE FOR DELETE TO authenticated USING (((template_type = 'personal'::text) AND (merchant_id = auth.uid())));
CREATE POLICY "Merchants can update own templates" ON public.campaign_templates AS PERMISSIVE FOR UPDATE TO authenticated USING (((template_type = 'personal'::text) AND (merchant_id = auth.uid()))) WITH CHECK (((template_type = 'personal'::text) AND (merchant_id = auth.uid())));
CREATE POLICY "Merchants can view own templates" ON public.campaign_templates AS PERMISSIVE FOR SELECT TO authenticated USING (((template_type = 'personal'::text) AND (merchant_id = auth.uid())));
CREATE POLICY "Service role full access on campaign_templates" ON public.campaign_templates AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view system templates" ON public.campaign_templates AS PERMISSIVE FOR SELECT TO authenticated USING ((template_type = 'system'::text));
CREATE POLICY "Admins can view all campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM merchant_profiles
  WHERE ((merchant_profiles.id = auth.uid()) AND (merchant_profiles.role = 'dealadmin'::text)))));
CREATE POLICY "Anyone can view active campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO public USING ((status = 'active'::campaign_status));
CREATE POLICY "Merchants can insert own campaigns" ON public.campaigns AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = merchant_id));
CREATE POLICY "Merchants can view own campaigns" ON public.campaigns AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = merchant_id));
CREATE POLICY "Merchants manage own campaigns" ON public.campaigns AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = merchant_id));
CREATE POLICY "Allow authenticated read for cities" ON public.cities AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow public read access for cities" ON public.cities AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read cities" ON public.cities AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users read own referrals" ON public.consumer_referrals AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = referrer_id));
CREATE POLICY "Users read own rewards" ON public.consumer_rewards AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "test_cases: admins can delete" ON public.consumer_test_cases AS PERMISSIVE FOR DELETE TO authenticated USING (is_app_admin(app_id));
CREATE POLICY "test_cases: admins can insert" ON public.consumer_test_cases AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_cases: admins can update" ON public.consumer_test_cases AS PERMISSIVE FOR UPDATE TO authenticated USING (is_app_admin(app_id)) WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_cases: members can read" ON public.consumer_test_cases AS PERMISSIVE FOR SELECT TO authenticated USING (is_app_member(app_id));
CREATE POLICY "test_runs: admins can delete" ON public.consumer_test_runs AS PERMISSIVE FOR DELETE TO authenticated USING (is_app_admin(app_id));
CREATE POLICY "test_runs: admins can insert" ON public.consumer_test_runs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_runs: admins can update" ON public.consumer_test_runs AS PERMISSIVE FOR UPDATE TO authenticated USING (is_app_admin(app_id)) WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_runs: members can read" ON public.consumer_test_runs AS PERMISSIVE FOR SELECT TO authenticated USING (is_app_member(app_id));
CREATE POLICY "Service role full access" ON public.deal_shares AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can mark their shares as viewed" ON public.deal_shares AS PERMISSIVE FOR UPDATE TO authenticated USING ((shared_with = auth.uid())) WITH CHECK ((shared_with = auth.uid()));
CREATE POLICY "Users can view shares they received" ON public.deal_shares AS PERMISSIVE FOR SELECT TO authenticated USING ((shared_with = auth.uid()));
CREATE POLICY "Users can view shares they sent" ON public.deal_shares AS PERMISSIVE FOR SELECT TO authenticated USING ((shared_by = auth.uid()));
CREATE POLICY users_modify_own_test_results ON public.dealpro_test_plan_results AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY users_read_own_test_results ON public.dealpro_test_plan_results AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY users_read_runs ON public.dealpro_test_plan_runs AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users can manage their own favorites" ON public.favorites AS PERMISSIVE FOR ALL TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can view their own FCM tokens" ON public.fcm_tokens AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Public read geocode_cache" ON public.geocode_cache AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Service insert geocode_cache" ON public.geocode_cache AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Service update geocode_cache" ON public.geocode_cache AS PERMISSIVE FOR UPDATE TO public USING (true);
CREATE POLICY "Allow authenticated users to update hoardings" ON public.hoardings AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read access" ON public.hoardings AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Public read localities" ON public.localities AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated can read permissions" ON public.merchant_permissions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Merchants can view own profile" ON public.merchant_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Service role full access" ON public.merchant_profiles AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Consumers can insert their own ratings" ON public.merchant_ratings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = consumer_id));
CREATE POLICY "Consumers can view their own ratings" ON public.merchant_ratings AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = consumer_id));
CREATE POLICY "Service role full access on merchant_staff" ON public.merchant_staff AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Staff can view own merchant staff" ON public.merchant_staff AS PERMISSIVE FOR SELECT TO authenticated USING (((merchant_id IN ( SELECT merchant_staff_1.merchant_id
   FROM merchant_staff merchant_staff_1
  WHERE (merchant_staff_1.user_id = auth.uid()))) OR (merchant_id = auth.uid())));
CREATE POLICY "Owner manages invites" ON public.merchant_staff_invites AS PERMISSIVE FOR ALL TO authenticated USING ((merchant_id = auth.uid())) WITH CHECK ((merchant_id = auth.uid()));
CREATE POLICY "Service role full access on merchant_staff_invites" ON public.merchant_staff_invites AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Admins can view all stores" ON public.merchant_stores AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM merchant_profiles
  WHERE ((merchant_profiles.id = auth.uid()) AND (merchant_profiles.role = 'dealadmin'::text)))));
CREATE POLICY "Allow authenticated read" ON public.merchant_stores AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Merchants can view their own stores" ON public.merchant_stores AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = merchant_id));
CREATE POLICY authenticated_insert ON public.merchant_subscriptions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY authenticated_select ON public.merchant_subscriptions AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY merchant_insert_own ON public.merchant_subscriptions AS PERMISSIVE FOR INSERT TO public WITH CHECK (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid)));
CREATE POLICY merchant_select_own ON public.merchant_subscriptions AS PERMISSIVE FOR SELECT TO public USING (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid)));
CREATE POLICY merchant_update_own ON public.merchant_subscriptions AS PERMISSIVE FOR UPDATE TO public USING (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid))) WITH CHECK (((merchant_id)::text = ( SELECT (auth.uid())::text AS uid)));
CREATE POLICY "Users read own milestone claims" ON public.milestone_claims AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can pin deals" ON public.pinned_deals AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can unpin deals" ON public.pinned_deals AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own pinned deals" ON public.pinned_deals AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users read own transactions" ON public.points_transactions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Service role full access" ON public.product_favorites_user AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can add own favorites" ON public.product_favorites_user AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Users can delete own favorites" ON public.product_favorites_user AS PERMISSIVE FOR DELETE TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can view own favorites" ON public.product_favorites_user AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Merchants manage own products" ON public.products AS PERMISSIVE FOR ALL TO authenticated USING ((merchant_id = auth.uid())) WITH CHECK ((merchant_id = auth.uid()));
CREATE POLICY "Anyone can read milestones" ON public.reward_milestones AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can read point config" ON public.reward_point_config AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY users_modify_own_signup_draft ON public.signup_drafts AS PERMISSIVE FOR ALL TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY users_read_own_signup_draft ON public.signup_drafts AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY "Allow public read access for states" ON public.states AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read of categories" ON public.store_categories AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated users to view active tiers" ON public.subscription_tiers AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true));
CREATE POLICY "test_cases_m: admins can delete" ON public.test_cases AS PERMISSIVE FOR DELETE TO authenticated USING (is_app_admin(app_id));
CREATE POLICY "test_cases_m: admins can insert" ON public.test_cases AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_cases_m: admins can update" ON public.test_cases AS PERMISSIVE FOR UPDATE TO authenticated USING (is_app_admin(app_id)) WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_cases_m: members can read" ON public.test_cases AS PERMISSIVE FOR SELECT TO authenticated USING (is_app_member(app_id));
CREATE POLICY "test_runs_m: admins can delete" ON public.test_runs AS PERMISSIVE FOR DELETE TO authenticated USING (is_app_admin(app_id));
CREATE POLICY "test_runs_m: admins can insert" ON public.test_runs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_runs_m: admins can update" ON public.test_runs AS PERMISSIVE FOR UPDATE TO authenticated USING (is_app_admin(app_id)) WITH CHECK (is_app_admin(app_id));
CREATE POLICY "test_runs_m: members can read" ON public.test_runs AS PERMISSIVE FOR SELECT TO authenticated USING (is_app_member(app_id));
CREATE POLICY "Anyone can read tier config" ON public.tier_config AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "registry: owners can delete" ON public.user_app_registry AS PERMISSIVE FOR DELETE TO authenticated USING (is_owner());
CREATE POLICY "registry: owners can insert" ON public.user_app_registry AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (is_owner());
CREATE POLICY "registry: owners can read all" ON public.user_app_registry AS PERMISSIVE FOR SELECT TO authenticated USING (is_owner());
CREATE POLICY "registry: owners can update" ON public.user_app_registry AS PERMISSIVE FOR UPDATE TO authenticated USING (is_owner());
CREATE POLICY "registry: users can read own memberships" ON public.user_app_registry AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Users can update their own notifications" ON public.user_notifications AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can view their own notifications" ON public.user_notifications AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "Service role full access" ON public.user_profiles AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can toggle own location" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id));
CREATE POLICY "Users can view own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = id));