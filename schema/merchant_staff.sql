-- =============================================
-- Merchant Staff: Multi-user support for merchant accounts
-- =============================================

-- 1. Staff members linked to a merchant account
CREATE TABLE IF NOT EXISTS public.merchant_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchant_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff')),
  display_name text NOT NULL,
  phone text,
  invited_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended')),
  created_at timestamptz DEFAULT now(),
  last_active_at timestamptz,
  UNIQUE(merchant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_staff_merchant ON public.merchant_staff(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_staff_user ON public.merchant_staff(user_id);

-- 2. Role-based permissions
CREATE TABLE IF NOT EXISTS public.merchant_permissions (
  id serial PRIMARY KEY,
  role text NOT NULL,
  permission text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE(role, permission)
);

-- Seed permissions
INSERT INTO public.merchant_permissions (role, permission, allowed) VALUES
  -- Owner: wildcard access
  ('owner', '*', true),
  -- Manager: most things except billing/staff
  ('manager', 'campaign.create', true),
  ('manager', 'campaign.edit', true),
  ('manager', 'campaign.delete', true),
  ('manager', 'dotd.create', true),
  ('manager', 'dotd.edit', true),
  ('manager', 'catalogue.manage', true),
  ('manager', 'store.manage', true),
  ('manager', 'analytics.view', true),
  ('manager', 'scan.verify', true),
  ('manager', 'subscription.manage', false),
  ('manager', 'staff.invite', false),
  ('manager', 'staff.manage', false),
  ('manager', 'billing.view', true),
  ('manager', 'billing.manage', false),
  -- Staff: limited (campaigns + DOTD + scan only)
  ('staff', 'campaign.create', true),
  ('staff', 'campaign.edit', true),
  ('staff', 'campaign.delete', false),
  ('staff', 'dotd.create', true),
  ('staff', 'dotd.edit', false),
  ('staff', 'catalogue.manage', false),
  ('staff', 'store.manage', false),
  ('staff', 'analytics.view', true),
  ('staff', 'scan.verify', true),
  ('staff', 'subscription.manage', false),
  ('staff', 'staff.invite', false),
  ('staff', 'staff.manage', false),
  ('staff', 'billing.view', false),
  ('staff', 'billing.manage', false)
ON CONFLICT (role, permission) DO NOTHING;

-- 3. Staff invitations
CREATE TABLE IF NOT EXISTS public.merchant_staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchant_profiles(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  invite_code text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
  display_name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_merchant ON public.merchant_staff_invites(merchant_id);
CREATE INDEX IF NOT EXISTS idx_staff_invites_code ON public.merchant_staff_invites(invite_code);

-- 4. RLS Policies
ALTER TABLE public.merchant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_permissions ENABLE ROW LEVEL SECURITY;

-- Service role: full access
CREATE POLICY "Service role full access on merchant_staff" ON public.merchant_staff
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on merchant_staff_invites" ON public.merchant_staff_invites
  FOR ALL USING (true) WITH CHECK (true);

-- Permissions table: read-only for authenticated users
CREATE POLICY "Authenticated can read permissions" ON public.merchant_permissions
  FOR SELECT TO authenticated USING (true);

-- Staff: can view own merchant's staff
CREATE POLICY "Staff can view own merchant staff" ON public.merchant_staff
  FOR SELECT TO authenticated
  USING (
    merchant_id IN (SELECT merchant_id FROM public.merchant_staff WHERE user_id = auth.uid())
    OR merchant_id = auth.uid()
  );

-- Owner can manage invites for their merchant
CREATE POLICY "Owner manages invites" ON public.merchant_staff_invites
  FOR ALL TO authenticated
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- Auto-create owner row when merchant registers (optional trigger)
-- You can also handle this in the registration edge function
CREATE OR REPLACE FUNCTION public.auto_create_merchant_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'merchant' THEN
    INSERT INTO public.merchant_staff (merchant_id, user_id, role, display_name, phone, status)
    VALUES (NEW.id, NEW.id, 'owner', COALESCE(NEW.full_name, NEW.store_name, 'Owner'), NEW.phone, 'active')
    ON CONFLICT (merchant_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger (run after merchant profile creation)
DROP TRIGGER IF EXISTS trg_auto_create_owner ON public.merchant_profiles;
CREATE TRIGGER trg_auto_create_owner
  AFTER INSERT ON public.merchant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_merchant_owner();
