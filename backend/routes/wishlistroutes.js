const router = require('express').Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');
const Coupon = require('../models/Coupon');

const validId = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
router.use(authenticate);
router.use((req, res, next) => {
  if (!validId(req.user?.id)) return res.status(401).json({ status: 'error', message: 'Please log in.' });
  next();
});
const handle = fn => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    console.error('Wishlist error:', error);
    res.status(500).json({ status: 'error', message: 'Unable to update or load wishlist. Please try again.' });
  }
};

router.get('/', handle(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT w.coupon_id FROM coupon_wishlist w JOIN coupons c ON c.id = w.coupon_id WHERE w.user_id = ? ORDER BY w.created_at DESC, w.id DESC',
    [req.user.id]
  );
  // Reuse the coupon model so vendor/category names match /api/coupons.
  const coupons = await Promise.all(rows.map(row => Coupon.findById(row.coupon_id)));
  const fields = ['id', 'title', 'subtitle', 'description', 'vendor_id', 'vendor_name', 'category_id', 'category_name', 'city', 'banner_image_url', 'banner_image', 'valid_from', 'valid_until', 'expiry', 'is_active', 'is_approved', 'max_quantity', 'coupon_code', 'priority', 'price'];
  const items = coupons.filter(Boolean).map(coupon => Object.fromEntries(fields.map(key => [key, coupon[key]])));
  res.json({ status: 'success', data: { items, total: items.length } });
}));

router.post('/', handle(async (req, res) => {
  const id = req.body?.coupon_id;
  if (!validId(id)) return res.status(400).json({ status: 'error', message: 'Valid coupon_id required.' });
  // Atomic insert, with a unique user/coupon key to make repeated saves harmless.
  await pool.query(
    `INSERT INTO coupon_wishlist (user_id, coupon_id)
     SELECT ?, id FROM coupons WHERE id = ? AND is_active = 1 AND is_approved = 1
     ON DUPLICATE KEY UPDATE coupon_id = VALUES(coupon_id)`, [req.user.id, Number(id)]
  );
  const [rows] = await pool.query('SELECT coupon_id FROM coupon_wishlist WHERE user_id = ? AND coupon_id = ?', [req.user.id, Number(id)]);
  if (!rows.length) return res.status(404).json({ status: 'error', message: 'Coupon is not available to save.' });
  res.json({ status: 'success', data: { coupon_id: Number(id) } });
}));

router.delete('/', handle(async (req, res) => {
  await pool.query('DELETE FROM coupon_wishlist WHERE user_id = ?', [req.user.id]);
  res.json({ status: 'success', message: 'Wishlist cleared.' });
}));

router.delete('/:coupon_id', handle(async (req, res) => {
  if (!validId(req.params.coupon_id)) return res.status(400).json({ status: 'error', message: 'Valid coupon_id required.' });
  await pool.query('DELETE FROM coupon_wishlist WHERE user_id = ? AND coupon_id = ?', [req.user.id, Number(req.params.coupon_id)]);
  res.json({ status: 'success', message: 'Removed from wishlist.' });
}));
module.exports = router;
