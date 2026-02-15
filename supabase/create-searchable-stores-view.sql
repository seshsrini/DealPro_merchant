-- Create searchable_stores view for store search functionality
-- This view combines merchant_stores with user_profiles to provide searchable store data

CREATE OR REPLACE VIEW searchable_stores AS
SELECT
  ms.id,
  ms.merchant_id,
  ms.store_name AS branch_name,
  up.store_name AS brand_name,
  ms.address,
  ms.city,
  ms.state,
  ms.pincode,
  ms.landmark,
  ms.latitude,
  ms.longitude,
  ms.store_hrs
FROM
  merchant_stores ms
  INNER JOIN user_profiles up ON ms.merchant_id = up.id
WHERE
  up.role = 'merchant' AND up.active_status = true;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON searchable_stores TO authenticated;

-- Verify the view
SELECT * FROM searchable_stores LIMIT 5;
