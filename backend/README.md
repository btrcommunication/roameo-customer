# Place order and wishlist update

The frontend now offers **Remove all** in Wishlist and **Place order** in Checkout. A successful order clears the cart and checkout summary, displays a green **Order placed!** popup, and appears in Orders. **View order** opens that specific order's details. Orders, counts, filters, and item totals come from the signed-in customer's history.

## Separate backend files to install

1. Run [coupon-orders.sql](./coupon-orders.sql) in your application database. This creates `coupon_orders`; it preserves the old `coupon_checkouts` drafts. Drafts are not placed orders and are not migrated into history.
2. Replace your backend `routes/cartroutes.js` with [routes/cartroutes.js](./routes/cartroutes.js). This is a complete replacement based on your pasted cart route, including its price calculations. No additional pricing helper is needed.
3. Replace your backend `routes/wishlistroutes.js` with [routes/wishlistroutes.js](./routes/wishlistroutes.js).
4. **Your pasted coupon routes do not need changes.** Keep your existing Coupon model, authentication middleware and database pool.
5. Keep these mounts after `express.json()` and restart the backend:

```js
app.use('/api/cart', require('./routes/cartroutes'));
app.use('/api/wishlist', require('./routes/wishlistroutes'));
```

Deploy these backend changes with the updated frontend. They have been prepared locally; no live backend deployment or database migration has been performed.

For a fresh installation, also run [coupon-cart.sql](./coupon-cart.sql) and [coupon-wishlist.sql](./coupon-wishlist.sql). An existing installation does not need to recreate those tables. The new route no longer uses `coupon-checkouts.sql`.

## Endpoint behavior

- `DELETE /api/wishlist`: removes every saved coupon for the authenticated customer. Individual removal at `DELETE /api/wishlist/:coupon_id` still works.
- `POST /api/cart/checkout` with `{ "request_id": "checkout-unique-attempt-123" }`: validates and locks the customer's cart, calculates prices from `coupons.price`, inserts a new order with item snapshots, and clears the cart in one transaction. Returns the order ID, items, quantities, totals, currency, status, payment status and creation date. The client sends a unique request ID per purchase and reuses it when retrying. A retry returns the original order without creating another one or clearing newly added items.
- `GET /api/cart/orders`: returns `{ "status": "success", "data": { "orders": [...] } }` for the authenticated customer, newest first. Multiple purchases remain separate orders.

All endpoints require `Authorization: Bearer <token>`. Customer identity comes from `req.user.id`; client-supplied customer IDs and totals are ignored. Requires the existing mysql2 promise pool and InnoDB tables. Match the new table's `user_id INT` to your customer ID type. `coupons.price` must exist; missing prices block orders while an explicit zero remains valid.

**Order placement does not collect payment.** New orders have `status: 'placed'` and `payment_status: 'pending'`. There is no new payment integration in this change. Orders displays that payment state. Demo sessions keep demo orders on the device, separate from real customer history.

## Validation

Run from the workspace root:

```powershell
node backend/coupon-pricing.test.cjs
node backend/wishlist.test.cjs
node backend/order-flow.test.cjs
node backend/coupon-details.test.cjs
node node_modules/typescript/bin/tsc --noEmit
```

Tests cover server prices, failed insertion/deletion rollback, retry deduplication, separate purchases, customer isolation, wishlist clearing, checkout success/error states, and dynamic order details. Database and React Native tests use stubs, not a live MySQL server or device.

After installation, place two orders using a real customer login. Check the green popup, empty cart and badge, both orders after reopening the app, and the selected order's item details. Verify a second customer's history and wishlist are separate. An unavailable or unpriced coupon must leave the cart intact. Repeating a checkout request ID must return the same order.
