import AsyncStorage from '@react-native-async-storage/async-storage';
import { cartRequest, clearSavedCart, isDemoSession, readCart } from './cart';
import { couponImageUrl } from './couponMedia';

export type OrderItem = {
  coupon_id: number; title: string; quantity: number; price: number;
  subtotal: number; thumbnail_url?: string; redemption_codes?: string[];
};
export type PaymentDetails = {
  provider?: string;
  session_id?: string;
  payment_intent_id?: string;
  payment_method_type?: string;
  card_brand?: string;
  card_last4?: string;
  customer_email?: string;
  customer_name?: string;
  receipt_url?: string;
  amount_total?: number;
  currency?: string;
  status?: string;
  timestamp?: string;
};

export type Order = {
  id: string; items: OrderItem[]; total_items: number; total_amount: number;
  currency: string; status: string; payment_status: string;
  payment_method?: string; transaction_id?: string; payment_details?: PaymentDetails;
  created_at: string;
};
const DEMO_ORDERS_KEY = 'roameoDemoPlacedOrders';
const listeners = new Set<() => void>();
export function subscribeOrders(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function normalizeOrder(value: Order): Order {
  if (!value?.id || !Array.isArray(value.items) || !value.created_at) throw new Error('Invalid order response.');
  return {
    ...value,
    id: String(value.id),
    total_amount: Number(value.total_amount),
    total_items: Number(value.total_items),
    payment_method: value.payment_method || (value.payment_status === 'paid' ? 'Stripe Card' : undefined),
    transaction_id: value.transaction_id || undefined,
    payment_details: typeof value.payment_details === 'string' ? JSON.parse(value.payment_details) : value.payment_details,
    items: value.items.map(item => ({
      ...item,
      quantity: Number(item.quantity),
      price: Number(item.price),
      subtotal: Number(item.subtotal),
      thumbnail_url: couponImageUrl(item.thumbnail_url),
      redemption_codes: Array.isArray(item.redemption_codes)
        ? item.redemption_codes.filter((code): code is string => typeof code === 'string' && !!code.trim())
        : []
    }))
  };
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

export async function createPaymentIntent(requestId: string): Promise<{
  clientSecret: string;
  paymentIntentId: string;
  checkoutUrl?: string;
  amount: number;
  currency: string;
}> {
  const token = await AsyncStorage.getItem('userToken');
  if (!token || token === 'demo-token') {
    throw new Error('Please log in to make a payment.');
  }
  const response = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/payment/create-payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ request_id: requestId }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || `Payment initialization failed (${response.status}).`);
  }
  return data.data;
}

export async function confirmPaymentOrder(params: { payment_intent_id?: string; session_id?: string; request_id: string }): Promise<Order> {
  const token = await AsyncStorage.getItem('userToken');
  if (!token || token === 'demo-token') {
    throw new Error('Please log in to complete your order.');
  }
  const response = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/payment/confirm-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || `Order confirmation failed (${response.status}).`);
  }
  const order = normalizeOrder(data.data);
  await clearSavedCart();
  listeners.forEach(listener => listener());
  return order;
}
