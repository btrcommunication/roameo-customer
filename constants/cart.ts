import { couponImageUrl } from './couponMedia';
import { couponPrice } from './couponPrice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addCouponToDemoCart, readDemoCart, writeDemoCart, DemoCartItem } from './demoCart';

export type CartItem = DemoCartItem & { coupon_id?: number; pricing_configured?: boolean };
const CART_URL = `${process.env.EXPO_PUBLIC_BASE_URL}/api/cart`;
export const isDemoSession = async () => (await AsyncStorage.getItem('userToken')) === 'demo-token';

const cartListeners = new Set<() => void>();
export function subscribeCartChanges(listener: () => void) {
  cartListeners.add(listener);
  return () => { cartListeners.delete(listener); };
}
function notifyCartChanged() {
  cartListeners.forEach(listener => listener());
}

async function request(method: string, path = '', body?: object) {
  const token = await AsyncStorage.getItem('userToken');
  if (!token || token === 'demo-token') throw new Error('Please log in to save your cart.');
  const response = await fetch(`${CART_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || `Cart request failed (${response.status}).`);
  }
  if (await AsyncStorage.getItem('userToken') !== token) throw new Error('Your login changed. Please reload.');
  if (method !== 'GET') notifyCartChanged();
  return data;
}

const VENDOR_CACHE_KEY = 'roameoCouponVendors';
const vendorNames = new Map<number, string>();
const validVendor = (name: unknown): name is string =>
  typeof name === 'string' && !!name.trim() && name.trim().toLowerCase() !== 'unknown vendor';

async function resolveVendors(items: CartItem[]): Promise<CartItem[]> {
  try {
    const saved = JSON.parse(await AsyncStorage.getItem(VENDOR_CACHE_KEY) || '{}');
    Object.entries(saved).forEach(([id, name]) => {
      if (validVendor(name) && !vendorNames.has(Number(id))) vendorNames.set(Number(id), name);
    });
  } catch { /* A missing metadata cache must not prevent loading the cart. */ }
  const couponId = (item: CartItem) => Number(item.coupon_id ?? item.listing_id);
  if (items.some(item => !validVendor(item.vendor_name) && !vendorNames.has(couponId(item)))) {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/coupons`);
      const data = await response.json();
      if (response.ok && data.status === 'success' && Array.isArray(data.data)) {
        data.data.forEach((coupon: any) => {
          if (validVendor(coupon.vendor_name)) vendorNames.set(Number(coupon.id), coupon.vendor_name);
        });
        await AsyncStorage.setItem(VENDOR_CACHE_KEY, JSON.stringify(Object.fromEntries(vendorNames)));
      }
    } catch { /* Keep cart operations available if the catalog is temporarily unavailable. */ }
  }
  return items.map(item => ({ ...item, vendor_name: validVendor(item.vendor_name)
    ? item.vendor_name : vendorNames.get(couponId(item)) || '' }));
}

export async function readCart(): Promise<CartItem[]> {
  if (await isDemoSession()) return resolveVendors(await readDemoCart());
  const result = await request('GET');
  if (!Array.isArray(result.data?.items)) throw new Error('Invalid cart response.');
  return resolveVendors(result.data.items.map((item: CartItem) => ({
    ...item,
    thumbnail_url: couponImageUrl(item.thumbnail_url),
    // Compatibility ID for existing cart UI; API and database use coupon_id.
    listing_id: Number(item.coupon_id),
    coupon_id: Number(item.coupon_id),
    pricing_configured: couponPrice(item.final_price ?? item.price) !== null,
    quantity: Number(item.quantity),
    price: couponPrice(item.price) ?? 0,
    final_price: couponPrice(item.final_price ?? item.price) ?? 0,
    subtotal: Math.round((couponPrice(item.final_price ?? item.price) ?? 0) * 100 * Number(item.quantity)) / 100,
  })));
}

export { request as cartRequest };

export async function addCartItem(coupon: any, ad_id?: number) {
  const vendorName = coupon.vendor_name || coupon.original?.vendor_name;
  if (validVendor(vendorName)) {
    vendorNames.set(Number(coupon.id), vendorName);
    try {
      const saved = JSON.parse(await AsyncStorage.getItem(VENDOR_CACHE_KEY) || '{}');
      await AsyncStorage.setItem(VENDOR_CACHE_KEY, JSON.stringify({ ...saved, [coupon.id]: vendorName }));
    } catch { /* In-memory metadata is still available for this session. */ }
  }
  if (await isDemoSession()) {
    const added = await addCouponToDemoCart(coupon);
    if (added) notifyCartChanged();
    return added;
  }
  const couponId = Number(coupon.id);
  if (!Number.isSafeInteger(couponId) || couponId <= 0) {
    throw new Error('Invalid coupon ID.');
  }
  await request('POST', '', { coupon_id: couponId, quantity: 1, ad_id });
  return true;
}

export async function setCartQuantity(listingId: number, quantity: number) {
  if (quantity <= 0) return removeCartItem(listingId);
  if (await isDemoSession()) {
    const items = await readDemoCart();
    await writeDemoCart(items.map(item => item.listing_id === listingId
      ? { ...item, quantity, subtotal: item.final_price * quantity } : item));
    notifyCartChanged();
  } else await request('PUT', `/${listingId}`, { quantity });
}

export async function removeCartItem(listingId: number) {
  if (await isDemoSession()) {
    await writeDemoCart((await readDemoCart()).filter(item => item.listing_id !== listingId));
    notifyCartChanged();
  } else await request('DELETE', `/${listingId}`);
}

export async function clearSavedCart() {
  if (await isDemoSession()) {
    await writeDemoCart([]);
    notifyCartChanged();
  }
  else await request('DELETE');
}
