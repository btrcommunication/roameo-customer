export function couponPrice(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null;
}

export function formatCouponPrice(value: unknown): string {
  const price = couponPrice(value);
  return price === null ? 'No price' : `$${price.toFixed(2)}`;
}
