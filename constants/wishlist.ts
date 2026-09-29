import AsyncStorage from '@react-native-async-storage/async-storage';
import { couponImageUrl } from './couponMedia';

export type WishlistCoupon = {
  id: number; title: string; vendor_name?: string; category_name?: string;
  description?: string; subtitle?: string; banner_image_url?: string; banner_image?: string;
  valid_from?: string; valid_until?: string; expiry?: string; max_quantity?: number;
  is_active?: number; is_approved?: number;
  price?: number | string | null;
};
const URL = `${process.env.EXPO_PUBLIC_BASE_URL}/api/wishlist`;
const listeners = new Set<() => void>();
export function subscribeWishlist(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export class WishlistLoginError extends Error {}
export async function wishlistRequest(method: string, id?: number) {
  const token = await AsyncStorage.getItem('userToken');
  if (!token || token === 'demo-token') throw new WishlistLoginError('Log in with your customer account to use your wishlist.');
  const response = await fetch(`${URL}${method === 'DELETE' && id !== undefined ? `/${id}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ coupon_id: id }) } : {}),
  });
  const result = await response.json().catch(() => null);
  if (response.status === 401) throw new WishlistLoginError('Your session has expired. Please log in again.');
  if (!response.ok || result?.status !== 'success') throw new Error(result?.message || 'Unable to load or update wishlist. Please try again.');
  // Prevent responses from an old login being shown under a different account.
  if (await AsyncStorage.getItem('userToken') !== token) throw new WishlistLoginError('Your login changed. Please reopen your wishlist.');
  return result;
}
export async function readWishlist(): Promise<WishlistCoupon[]> {
  const result = await wishlistRequest('GET');
  if (!Array.isArray(result.data?.items)) throw new Error('Invalid wishlist response.');
  return result.data.items.map((item: WishlistCoupon) => ({
    ...item, id: Number(item.id), banner_image_url: couponImageUrl(item.banner_image_url || item.banner_image),
  }));
}
export async function setWishlistSaved(id: number, saved: boolean) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid coupon ID.');
  await wishlistRequest(saved ? 'POST' : 'DELETE', id);
  listeners.forEach(listener => listener());
}
export async function clearWishlist() {
  await wishlistRequest('DELETE');
  listeners.forEach(listener => listener());
}
