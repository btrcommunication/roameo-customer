const API_ORIGIN = process.env.EXPO_PUBLIC_BASE_URL;

export function couponImageUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  let path = value.trim();
  if (path.includes('roameomobileapp.braventra.in') && API_ORIGIN) {
    path = path.replace(/^https?:\/\/roameomobileapp\.braventra\.in/i, API_ORIGIN);
  }
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}/${path.replace(/^\/+/, '')}`;
}

// Server remains authoritative for validity dates and availability at add time.
export function isApprovedCoupon(coupon: { is_active?: unknown; is_approved?: unknown }) {
  return Number(coupon.is_active) === 1 && Number(coupon.is_approved) === 1;
}
