// constants/demoCart.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { couponPrice } from './couponPrice';

export const DEMO_CART_KEY = 'roameoDemoCart';
export const DEMO_CART_CHANGED_KEY = 'roameoDemoCartChanged';

export interface DemoCartItem {
  cart_id: number;
  listing_id: number;
  quantity: number;
  title: string;
  description: string;
  price: number;
  discount_percentage: number;
  thumbnail_url: string;
  city: string;
  vendor_name: string;
  final_price: number;
  subtotal: number;
  coupon_code?: string;
  max_quantity?: number; // Add this field
  pricing_configured?: boolean;
}

export const readDemoCart = async (): Promise<DemoCartItem[]> => {
  const storedCart = await AsyncStorage.getItem(DEMO_CART_KEY);
  if (!storedCart) return [];
  try {
    const items = JSON.parse(storedCart);
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

export const writeDemoCart = async (items: DemoCartItem[]) => {
  await Promise.all([
    AsyncStorage.setItem(DEMO_CART_KEY, JSON.stringify(items)),
    AsyncStorage.setItem('cartCount', String(items.reduce((sum, item) => sum + item.quantity, 0))),
    AsyncStorage.setItem(DEMO_CART_CHANGED_KEY, String(Date.now())),
  ]);
};

export const addCouponToDemoCart = async (coupon: any) => {
  const items = await readDemoCart();
  const listingId = Number(coupon.id);
  
  // Check if already in cart
  if (items.some((item) => item.listing_id === listingId)) return false;
  
  const parsedPrice = couponPrice(coupon.price ?? coupon.original?.price);
  const finalPrice = parsedPrice ?? 0;
  
  // Get max_quantity from coupon, default to 1
  const maxQuantity = Number(coupon.max_quantity) || 1;
  
  items.push({
    cart_id: listingId,
    listing_id: listingId,
    quantity: 1,
    title: coupon.title || 'Roameo Coupon',
    description: coupon.description || coupon.subtitle || 'Demo coupon purchase',
    price: finalPrice,
    pricing_configured: parsedPrice !== null,
    discount_percentage: Number(coupon.discount_percentage) || 0,
    thumbnail_url: coupon.image || coupon.banner_image || '',
    city: coupon.city || '',
    vendor_name: coupon.vendor_name || coupon.distance || 'Roameo Partner',
    final_price: finalPrice,
    subtotal: finalPrice,
    coupon_code: coupon.coupon_code || coupon.discount || '',
    max_quantity: maxQuantity, // Store max_quantity
  });
  
  await writeDemoCart(items);
  return true;
};
