// Calculate in cents; never accept totals supplied by the customer.
function priceInCents(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const price = Number(value);
  const cents = Math.round(price * 100);
  return Number.isFinite(price) && price >= 0 && Number.isSafeInteger(cents) ? cents : null;
}

function priceCart(rows) {
  let totalCents = 0;
  const items = rows.map(row => {
    const cents = priceInCents(row.price);
    const quantity = Number(row.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid cart quantity');
    const subtotal = cents === null ? null : cents * quantity;
    if (subtotal !== null && !Number.isSafeInteger(subtotal)) throw new Error('Cart amount exceeds supported range');
    totalCents += subtotal ?? 0;
    return { ...row, quantity, pricing_configured: cents !== null, price: cents === null ? null : cents / 100,
      final_price: cents === null ? null : cents / 100, subtotal: subtotal === null ? null : subtotal / 100 };
  });
  if (!Number.isSafeInteger(totalCents)) throw new Error('Cart total exceeds supported range');
  return { items, total_items: items.reduce((sum, item) => sum + item.quantity, 0),
    total_amount: items.some(item => !item.pricing_configured) ? null : totalCents / 100, currency: 'USD' };
}
module.exports = { priceInCents, priceCart };
