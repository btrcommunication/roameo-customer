import AsyncStorage from '@react-native-async-storage/async-storage';
import { cartRequest, clearSavedCart, isDemoSession, readCart } from './cart';
import { couponImageUrl } from './couponMedia';

export type OrderItem = {
  coupon_id: number; title: string; quantity: number; price: number;
  subtotal: number; thumbnail_url?: string; redemption_codes?: string[];
};
export type Order = {
  id: string; items: OrderItem[]; total_items: number; total_amount: number;
  currency: string; status: string; payment_status: string; created_at: string;
};
const DEMO_ORDERS_KEY = 'roameoDemoPlacedOrders';
const listeners = new Set<() => void>();
export function subscribeOrders(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function normalizeOrder(value: Order): Order {
  if (!value?.id || !Array.isArray(value.items) || !value.created_at) throw new Error('Invalid order response.');
  return { ...value, id: String(value.id), total_amount: Number(value.total_amount), total_items: Number(value.total_items),
    items: value.items.map(item => ({ ...item, quantity: Number(item.quantity), price: Number(item.price),
      subtotal: Number(item.subtotal), thumbnail_url: couponImageUrl(item.thumbnail_url),
      redemption_codes: Array.isArray(item.redemption_codes)
        ? item.redemption_codes.filter((code): code is string => typeof code === 'string' && !!code.trim())
        : [] })) };
}
export async function readOrders(): Promise<Order[]> {
  const orders = await isDemoSession()
    ? JSON.parse(await AsyncStorage.getItem(DEMO_ORDERS_KEY) || '[]')
    : (await cartRequest('GET', '/orders')).data?.orders;
  if (!Array.isArray(orders)) throw new Error('Unable to load orders. Please try again.');
  return orders.map(normalizeOrder);
}
export async function placeOrder(requestId: string): Promise<Order> {
  let order: Order;
  if (await isDemoSession()) {
    const orders = await readOrders();
    const previous = orders.find(item => item.id === `demo-${requestId}`);
    if (previous) {
      await clearSavedCart();
      listeners.forEach(listener => listener());
      return previous;
    }
    const cart = await readCart();
    if (!cart.length) throw new Error('Your cart is empty.');
    if (cart.some(item => item.pricing_configured === false)) throw new Error('A coupon has no price.');
    const items = cart.map(item => {
      const couponId = item.coupon_id ?? item.listing_id;
      const requestPart = requestId.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
      return {
        coupon_id: couponId, title: item.title, quantity: item.quantity, price: item.final_price,
        thumbnail_url: item.thumbnail_url,
        subtotal: Math.round(item.final_price * 100) * item.quantity / 100,
        // One redemption code is issued per coupon line, regardless of quantity.
        redemption_codes: [`RMO-${requestPart}-${couponId}-1`],
      };
    });
    order = { id: `demo-${requestId}`, items, total_items: items.reduce((sum, item) => sum + item.quantity, 0),
      total_amount: items.reduce((sum, item) => sum + Math.round(item.subtotal * 100), 0) / 100,
      currency: 'USD', status: 'placed', payment_status: 'demo', created_at: new Date().toISOString() };
    await AsyncStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify([order, ...orders]));
    await clearSavedCart();
  } else {
    order = normalizeOrder((await cartRequest('POST', '/checkout', { request_id: requestId })).data);
    if (order.status !== 'placed') throw new Error('The server did not confirm this order. Please refresh your orders.');
  }
  listeners.forEach(listener => listener());
  return order;
}
