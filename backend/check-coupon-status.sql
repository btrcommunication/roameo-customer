-- Read-only: shows why each coupon is accepted or rejected using database time.
SELECT id, title, is_active, is_approved, valid_from, valid_until,
       NOW() AS database_now,
       CASE
         WHEN COALESCE(is_active, 0) <> 1 THEN 'Inactive'
         WHEN COALESCE(is_approved, 0) <> 1 THEN 'Not approved'
         WHEN valid_from IS NULL OR valid_from > NOW() THEN 'Not started'
         WHEN valid_until IS NULL OR valid_until < NOW() THEN 'Expired'
         ELSE 'Available'
       END AS cart_status
FROM coupons
ORDER BY id DESC;
