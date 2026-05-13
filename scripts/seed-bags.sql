-- Inserts QR bag codes 210050541819 through 210050541936 into qr_bags.
-- Run this in the Supabase dashboard → SQL Editor.

INSERT INTO qr_bags (bag_code, status)
SELECT
  '21005054' || seq::text AS bag_code,
  'registered'            AS status
FROM generate_series(1819, 1936) AS seq
ON CONFLICT (bag_code) DO NOTHING;

-- Verify
SELECT COUNT(*) AS inserted FROM qr_bags
WHERE bag_code BETWEEN '210050541819' AND '210050541936';
