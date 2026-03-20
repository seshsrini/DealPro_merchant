-- Campaign Templates Table
-- Stores both system templates and merchant-created personal templates

CREATE TABLE IF NOT EXISTS public.campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template metadata
  name text NOT NULL,
  description text,
  category text, -- 'festival', 'flash-sale', 'clearance', 'new-launch', 'custom'

  -- Template type
  template_type text NOT NULL DEFAULT 'personal', -- 'system' or 'personal'
  merchant_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates

  -- Pre-filled campaign values
  title_format text, -- e.g., "[Product] - Weekend Only {{discount}}% Off!"
  suggested_discount numeric(5,2), -- e.g., 25.00
  discount_min numeric(5,2), -- e.g., 20.00
  discount_max numeric(5,2), -- e.g., 30.00
  launch_day_of_week integer, -- 0=Sunday, 5=Friday
  launch_hour integer, -- 0-23 (e.g., 18 for 6 PM)
  duration_days integer, -- e.g., 15

  -- Template insights
  tips jsonb DEFAULT '[]'::jsonb, -- Array of tip strings
  success_rate numeric(5,2), -- Percentage 0-100
  avg_redemptions integer, -- Average redemptions for campaigns using this template

  -- Usage tracking
  times_used integer DEFAULT 0,
  last_used_at timestamptz,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_templates_merchant ON public.campaign_templates(merchant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_type ON public.campaign_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_category ON public.campaign_templates(category);

-- RLS Policies
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on campaign_templates"
  ON public.campaign_templates
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view system templates
CREATE POLICY "Users can view system templates"
  ON public.campaign_templates
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (template_type = 'system');

-- Merchants can view their own personal templates
CREATE POLICY "Merchants can view own templates"
  ON public.campaign_templates
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (template_type = 'personal' AND merchant_id = auth.uid());

-- Merchants can insert their own templates
CREATE POLICY "Merchants can create own templates"
  ON public.campaign_templates
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (template_type = 'personal' AND merchant_id = auth.uid());

-- Merchants can update their own templates
CREATE POLICY "Merchants can update own templates"
  ON public.campaign_templates
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (template_type = 'personal' AND merchant_id = auth.uid())
  WITH CHECK (template_type = 'personal' AND merchant_id = auth.uid());

-- Merchants can delete their own templates
CREATE POLICY "Merchants can delete own templates"
  ON public.campaign_templates
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (template_type = 'personal' AND merchant_id = auth.uid());

-- Insert default system templates
INSERT INTO public.campaign_templates
  (name, description, category, template_type, title_format, suggested_discount, discount_min, discount_max, launch_day_of_week, launch_hour, duration_days, tips, success_rate, avg_redemptions)
VALUES
  (
    'Friday Evening Flash Sale',
    'High-engagement weekend campaign with proven timing',
    'flash-sale',
    'system',
    '{{product}} - Limited Weekend Offer!',
    25.00,
    20.00,
    30.00,
    5, -- Friday
    18, -- 6 PM
    15,
    '["Launch on Friday for 4.5x better engagement", "25% discount is the sweet spot", "Create urgency with weekend timing"]'::jsonb,
    92.00,
    145
  ),
  (
    'Weekend Clearance Sale',
    'Move inventory quickly with weekend urgency',
    'clearance',
    'system',
    'Weekend Clearance: {{discount}}% Off {{product}}',
    30.00,
    25.00,
    40.00,
    5, -- Friday
    18,
    15,
    '["Higher discounts work for clearance", "Weekend timing creates urgency", "Clear inventory before month-end"]'::jsonb,
    85.00,
    120
  ),
  (
    'New Product Launch',
    'Generate buzz for new arrivals',
    'new-launch',
    'system',
    'Just Arrived: {{product}} - Launch Offer {{discount}}% Off',
    20.00,
    15.00,
    25.00,
    5, -- Friday
    18,
    15,
    '["Moderate discount for new products", "Launch on Friday for weekend traffic", "Highlight newness in title"]'::jsonb,
    88.00,
    98
  ),
  (
    'Festival Mega Deal',
    'Special occasion campaigns with higher engagement',
    'festival',
    'system',
    'Festival Special: {{discount}}% Off {{product}}',
    30.00,
    25.00,
    35.00,
    5, -- Friday
    18,
    15,
    '["Festival timing boosts engagement by 60%", "Higher discounts expected during festivals", "Mention festival in title"]'::jsonb,
    94.00,
    210
  ),
  (
    'Premium Product Showcase',
    'Highlight high-value items with moderate discounts',
    'premium',
    'system',
    'Exclusive: {{product}} Now {{discount}}% Off',
    15.00,
    10.00,
    20.00,
    5, -- Friday
    18,
    15,
    '["Lower discounts maintain premium perception", "Use words like Exclusive, Premium", "Quality over quantity approach"]'::jsonb,
    78.00,
    65
  ),
  (
    'Mid-Week Flash',
    'Boost weekday traffic with surprise deals',
    'flash-sale',
    'system',
    'Flash Alert: {{discount}}% Off {{product}} Today Only!',
    25.00,
    20.00,
    30.00,
    3, -- Wednesday
    12, -- Noon
    15,
    '["Mid-week deals boost slow days", "Create urgency with time limits", "Lunch hour launch catches attention"]'::jsonb,
    68.00,
    85
  );

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_campaign_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_templates_updated_at
  BEFORE UPDATE ON public.campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_templates_updated_at();
