-- Create searchable_stores view for store search functionality
-- This view combines merchant_stores with merchant_profiles to provide searchable store data

CREATE OR REPLACE VIEW searchable_stores AS
SELECT
  ms.id,
  ms.merchant_id,
  ms.store_name AS branch_name,
  mp.store_name AS brand_name,
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
  INNER JOIN merchant_profiles mp ON ms.merchant_id = mp.id
WHERE
  mp.role = 'merchant' AND mp.active_status = true;

-- Grant SELECT permission to authenticated users
GRANT SELECT ON searchable_stores TO authenticated;

-- Verify the view
SELECT * FROM searchable_stores LIMIT 5;
