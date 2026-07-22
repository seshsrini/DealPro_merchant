-- ============================================================================
-- CAMPAIGN APPROVAL NOTIFICATION TRIGGER
-- ============================================================================
-- Triggers push notifications when a campaign status changes to 'active'
-- (i.e., when admin approves a campaign)

-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_campaign_approved_notification ON public.campaigns;
DROP FUNCTION IF EXISTS public.notify_campaign_approved();

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.notify_campaign_approved()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'active'
  -- Check both:
  -- 1. NEW.status = 'active' (new status is active)
  -- 2. OLD.status != 'active' (old status was NOT active)
  -- This prevents duplicate notifications if status is updated multiple times

  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    RAISE NOTICE 'Campaign approved and activated: %', NEW.campaign_id;

    -- Target project + key come from per-database settings — NEVER hardcode them
    -- here. Set once per database:
    --   ALTER DATABASE postgres SET app.settings.project_ref      = '<your-project-ref>';
    --   ALTER DATABASE postgres SET app.settings.service_role_key = '<your-service-role-key>';
    --
    -- WARNING: this uses extensions.http_post, which is SYNCHRONOUS — a failing or
    -- unreachable URL fails the campaign UPDATE itself. A placeholder URL left in a
    -- campaigns trigger is exactly what took deal creation down (libcurl error 21).
    -- So if the settings are missing we skip the call with a warning rather than
    -- attempt a doomed request. Consider migrating this to net.http_post (async),
    -- as the referral triggers do, so notification failures can never block writes.
    IF coalesce(current_setting('app.settings.project_ref', true), '') = ''
       OR coalesce(current_setting('app.settings.service_role_key', true), '') = '' THEN
      RAISE WARNING '[campaign-approved] app.settings.project_ref/service_role_key not set — skipping notification for campaign %', NEW.campaign_id;
    ELSE
      PERFORM extensions.http_post(
        format('https://%s.supabase.co/functions/v1/send-new-deal-notification',
               current_setting('app.settings.project_ref', true)),
        json_build_object('record', row_to_json(NEW))::text,
        'application/json',
        ARRAY[
          extensions.http_header('Content-Type', 'application/json'),
          extensions.http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
        ]
      );
    END IF;
  ELSE
    RAISE NOTICE 'Campaign update but not approved yet: % (status: %)', NEW.campaign_id, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_campaign_approved_notification
AFTER UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.notify_campaign_approved();

-- Verify trigger was created
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_campaign_approved_notification';

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 1. Set app.settings.project_ref on the database (see the function body)
-- 2. Set app.settings.service_role_key on the database — never hardcode it here
-- 3. Run this SQL in Supabase SQL Editor
-- 4. Test by updating a campaign status from 'review' to 'active'

-- ============================================================================
-- TEST QUERY
-- ============================================================================
-- Update a campaign from 'review' to 'active' to trigger notification:
-- UPDATE campaigns
-- SET status = 'active'
-- WHERE campaign_id = 'YOUR_CAMPAIGN_ID' AND status = 'review';
