const router = require('express').Router();
const pool = require('../config/db');
const authenticate = require('../middleware/auth');

const valid = n =>
  Number.isSafeInteger(Number(n)) && Number(n) > 0;

// Missing prices stay null. An explicit zero is a valid price.
const priceInCents = value => {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const price = Number(value);
  const cents = Math.round(price * 100);

  return Number.isFinite(price) &&
    price >= 0 &&
    Number.isSafeInteger(cents)
    ? cents
    : null;
};

// Calculate amounts from database prices using integer cents.
const calculateCart = rows => {
  let totalCents = 0;

  const items = rows.map(row => {
    const quantity = Number(row.quantity);

    if (!valid(quantity)) {
      throw new Error('Invalid cart quantity');
    }

    const unitCents = priceInCents(row.price);
    const subtotalCents =
      unitCents === null ? null : unitCents * quantity;

    if (
      subtotalCents !== null &&
      !Number.isSafeInteger(subtotalCents)
    ) {
      throw new Error('Cart amount exceeds supported range');
    }

    totalCents += subtotalCents ?? 0;

    return {
      ...row,
      quantity,
      price: unitCents === null ? null : unitCents / 100,
      final_price: unitCents === null ? null : unitCents / 100,
      subtotal: subtotalCents === null ? null : subtotalCents / 100,
      pricing_configured: unitCents !== null,
    };
  });

  if (!Number.isSafeInteger(totalCents)) {
    throw new Error('Cart total exceeds supported range');
  }

  return {
    items,
    total_items: items.reduce(
      (sum, item) => sum + item.quantity,
      0
    ),
    total_amount: items.some(item => !item.pricing_configured)
      ? null
      : totalCents / 100,
    currency: 'USD',
  };
};

router.use(authenticate);

router.use((req, res, next) => {
  if (!valid(req.user?.id)) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required',
    });
  }

  next();
});

const handle = fn => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    console.error('Cart error:', error);

    res.status(500).json({
      status: 'error',
      message: 'Cart request failed. Check backend logs.',
    });
  }
};

// ADD / UPDATE CART
const save = add => handle(async (req, res) => {
  const id = Number(
    add ? req.body?.coupon_id : req.params.coupon_id
  );

  const quantity = Number(
    req.body?.quantity ?? (add ? 1 : NaN)
  );

  if (!valid(id) || !valid(quantity)) {
    return res.status(400).json({
      status: 'error',
      message: 'Valid coupon_id and positive integer quantity required',
    });
  }

  const db = await pool.getConnection();

  try {
    await db.beginTransaction();

    const [coupons] = await db.query(
      `SELECT *,
        (valid_from <= NOW()) AS has_started,
        (valid_until >= NOW()) AS has_not_expired
       FROM coupons
       WHERE id = ?
       FOR UPDATE`,
      [id]
    );

    const coupon = coupons[0];

    const rejection =
      !coupon
        ? ['COUPON_NOT_FOUND', 'Coupon not found']
        : Number(coupon.is_active) !== 1
          ? ['COUPON_INACTIVE', 'This coupon is inactive']
          : Number(coupon.is_approved) !== 1
            ? ['COUPON_NOT_APPROVED', 'This coupon is awaiting approval']
            : Number(coupon.has_started) !== 1
              ? [
                  'COUPON_NOT_STARTED',
                  'This coupon is not valid yet. Check its start date.',
                ]
              : Number(coupon.has_not_expired) !== 1
                ? [
                    'COUPON_EXPIRED',
                    'This coupon has expired. Check its end date.',
                  ]
                : null;

    if (rejection) {
      await db.rollback();

      return res.status(coupon ? 400 : 404).json({
        status: 'error',
        code: rejection[0],
        message: rejection[1],
      });
    }

    const [rows] = await db.query(
      `SELECT quantity
       FROM coupon_cart
       WHERE user_id = ? AND coupon_id = ?
       FOR UPDATE`,
      [req.user.id, id]
    );

    if (!add && !rows.length) {
      await db.rollback();

      return res.status(404).json({
        status: 'error',
        message: 'Coupon not found in cart',
      });
    }

    const next =
      quantity + (add ? Number(rows[0]?.quantity || 0) : 0);

    if (!valid(next) || next > Number(coupon.max_quantity)) {
      await db.rollback();

      return res.status(400).json({
        status: 'error',
        message: `Maximum quantity is ${coupon.max_quantity}`,
      });
    }

    await db.query(
      `INSERT INTO coupon_cart (user_id, coupon_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = ?`,
      [req.user.id, id, next, next]
    );

    await db.commit();

    res.json({
      status: 'success',
      message: 'Coupon saved',
      data: {
        coupon_id: id,
        quantity: next,
      },
    });
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
});

router.post('/', save(true));
router.post('/add', save(true));
router.put('/:coupon_id', save(false));

// GET CART WITH REAL PRICES
router.get('/', handle(async (req, res) => {
  const [items] = await pool.query(
    `SELECT
      c.id AS cart_id,
      c.coupon_id,
      c.quantity,
      p.title,
      p.description,
      p.banner_image_url AS thumbnail_url,
      p.city,
      p.coupon_code,
      p.max_quantity,
      p.price
     FROM coupon_cart c
     LEFT JOIN coupons p ON p.id = c.coupon_id
     WHERE c.user_id = ?
     ORDER BY c.created_at DESC`,
    [req.user.id]
  );

  res.json({
    status: 'success',
    data: calculateCart(items),
  });
}));

const serializeOrder = order => ({
  ...order,
  id: String(order.id),
  items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items,
  total_items: Number(order.total_items),
  total_amount: Number(order.total_amount),
});

// Order history belongs only to the authenticated customer.
router.get('/orders', handle(async (req, res) => {
  const [orders] = await pool.query(
    `SELECT id, items, total_items, total_amount, currency, status, payment_status, created_at
     FROM coupon_orders WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    [req.user.id]
  );
  res.json({ status: 'success', data: { orders: orders.map(serializeOrder) } });
}));

// Place an order and clear its cart atomically. This does not collect payment.
router.post('/checkout', handle(async (req, res) => {
  const requestId = req.body?.request_id;
  if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(requestId)) {
    return res.status(400).json({ status: 'error', message: 'A valid request_id is required.' });
  }
  const db = await pool.getConnection();

  try {
    await db.beginTransaction();

    // Always use the authenticated customer's cart and database prices.
    const [rows] = await db.query(
      `SELECT
        c.coupon_id,
        c.quantity,
        p.title,
        p.banner_image_url AS thumbnail_url,
        p.price,
        p.max_quantity,
        p.is_active,
        p.is_approved,
        (
          p.valid_from <= NOW()
          AND p.valid_until >= NOW()
        ) AS valid_now
       FROM coupon_cart c
       LEFT JOIN coupons p ON p.id = c.coupon_id
       WHERE c.user_id = ?
       ORDER BY c.coupon_id
       FOR UPDATE`,
      [req.user.id]
    );

    // A retry after a lost response returns the same order, even with an empty cart.
    const [existing] = await db.query(
      `SELECT id, items, total_items, total_amount, currency, status, payment_status, created_at
       FROM coupon_orders WHERE user_id = ? AND request_id = ? FOR UPDATE`,
      [req.user.id, requestId]
    );
    if (existing.length) {
      await db.commit();
      return res.json({ status: 'success', message: 'Order placed successfully.', data: serializeOrder(existing[0]) });
    }

    if (!rows.length) {
      await db.rollback();

      return res.status(400).json({
        status: 'error',
        message: 'Your cart is empty.',
      });
    }

    const unavailable = rows.some(item =>
      Number(item.is_active) !== 1 ||
      Number(item.is_approved) !== 1 ||
      Number(item.valid_now) !== 1 ||
      !(
        Number(item.quantity) <= Number(item.max_quantity)
      )
    );

    if (unavailable) {
      await db.rollback();

      return res.status(400).json({
        status: 'error',
        message:
          'A coupon is unavailable or exceeds its quantity limit. Update your cart.',
      });
    }

    const summary = calculateCart(rows);

    if (summary.total_amount === null) {
      await db.rollback();

      return res.status(400).json({
        status: 'error',
        message:
          'A coupon has no price. Your order cannot be placed until its price is configured.',
      });
    }

    const items = summary.items.map(item => ({
      coupon_id: item.coupon_id,
      title: item.title,
      thumbnail_url: item.thumbnail_url,
      quantity: item.quantity,
      price: item.price,
      subtotal: item.subtotal,
    }));

    const [insert] = await db.query(
      `INSERT INTO coupon_orders (
        user_id,
        items,
        total_items,
        total_amount,
        currency,
        status,
        payment_status,
        request_id
      )
      VALUES (?, ?, ?, ?, ?, 'placed', 'pending', ?)`,
      [
        req.user.id,
        JSON.stringify(items),
        summary.total_items,
        summary.total_amount,
        summary.currency,
        requestId,
      ]
    );

    await db.query('DELETE FROM coupon_cart WHERE user_id = ?', [req.user.id]);
    await db.commit();

    res.json({
      status: 'success',
      message: 'Order placed successfully.',
      data: {
        ...summary,
        id: String(insert.insertId),
        items,
        status: 'placed',
        payment_status: 'pending',
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}));

// REMOVE ONE COUPON
router.delete('/:coupon_id', handle(async (req, res) => {
  if (!valid(req.params.coupon_id)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid coupon ID',
    });
  }

  await pool.query(
    'DELETE FROM coupon_cart WHERE user_id = ? AND coupon_id = ?',
    [req.user.id, req.params.coupon_id]
  );

  res.json({
    status: 'success',
    message: 'Coupon removed',
  });
}));

// CLEAR CART
router.delete('/', handle(async (req, res) => {
  await pool.query(
    'DELETE FROM coupon_cart WHERE user_id = ?',
    [req.user.id]
  );

  res.json({
    status: 'success',
    message: 'Cart cleared',
  });
}));

module.exports = router;
