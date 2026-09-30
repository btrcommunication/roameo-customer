import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CartItem as DemoCartItem, readCart, setCartQuantity, removeCartItem, clearSavedCart, isDemoSession, subscribeCartChanges } from '../../constants/cart';

import { Order, placeOrder, createPaymentIntent, confirmPaymentOrder } from '../../constants/orders';
import { openStripeCheckout } from '../../constants/stripeCheckout';

export default function CartScreen() {
  const router = useRouter();
  const [cartError, setCartError] = useState('');
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [clearingCart, setClearingCart] = useState(false);
  const clearingCartRef = useRef(false);
  const params = useLocalSearchParams<{
    checkout?: string;
    payment?: string;
    session_id?: string;
    request_id?: string;
  }>();
  const handledCheckout = useRef<string | undefined>(undefined);
  const handledPayment = useRef<string | undefined>(undefined);
  const [cartItems, setCartItems] = useState<DemoCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  const checkoutRequest = useRef<string | null>(null);
  const [demoCheckout, setDemoCheckout] = useState(false);
  const savingCheckout = useRef(false);

  useFocusEffect(useCallback(() => {
    fetchCart();
  }, [params.checkout, params.payment, params.session_id, params.request_id]));

  useEffect(() => subscribeCartChanges(() => {
    readCart().then(applyCart).catch(error => {
      setCartError(error instanceof Error ? error.message : 'Unable to refresh cart.');
    });
  }), []);

  const applyCart = (items: DemoCartItem[]) => {
    setCartItems(items);
    setTotalItems(items.reduce((sum, item) => sum + item.quantity, 0));
    setTotalAmount(items.reduce((sum, item) => sum + Math.round(item.final_price * 100) * item.quantity, 0) / 100);
  };

  const fetchCart = async () => {
    try {
      setLoading(true);

      // Handle Stripe web redirect success
      if (params.payment === 'success' && (params.session_id || params.request_id)) {
        const paymentKey = `${params.payment}_${params.session_id || ''}_${params.request_id || ''}`;
        if (handledPayment.current !== paymentKey) {
          handledPayment.current = paymentKey;
          router.setParams({ payment: undefined, session_id: undefined, request_id: undefined });
          setPaymentLoading(true);
          try {
            const order = await confirmPaymentOrder({
              session_id: params.session_id,
              request_id: params.request_id || `stripe-${params.session_id}`,
            });
            applyCart([]);
            setCheckoutModalVisible(false);
            setPaymentMessage('');
            setPlacedOrder(order);
          } catch (paymentErr) {
            console.error('Payment confirmation error:', paymentErr);
            Alert.alert('Payment Confirmation', paymentErr instanceof Error ? paymentErr.message : 'Unable to confirm payment.');
          } finally {
            setPaymentLoading(false);
          }
          return;
        }
      }

      const items = await readCart();
      applyCart(items);
      if (params.checkout && handledCheckout.current !== params.checkout) {
        handledCheckout.current = params.checkout;
        router.setParams({ checkout: undefined });
        await handleCheckout(items);
      }
    } catch (error) {
      console.error('Fetch cart error:', error);
      applyCart([]);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load cart');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCart();
  };

  const updateQuantity = async (listingId: number, newQuantity: number) => {
    if (savingCheckout.current) return;
    setCartError('');
    try {
      // Find the item to check max_quantity
      const item = cartItems.find(
        (item) => Number(item.listing_id) === Number(listingId)
      );
      
      // Check if new quantity exceeds max_quantity
      if (item && item.max_quantity && newQuantity > item.max_quantity) {
        setCartError(`You can only add up to ${item.max_quantity} of this item.`);
        return;
      }

      await setCartQuantity(listingId, newQuantity);
      applyCart(await readCart());
    } catch (error) {
      console.error('Update quantity error:', error);
      setCartError(error instanceof Error ? error.message : 'Failed to update cart');
    }
  };

  const removeItem = async (listingId: number) => {
    if (savingCheckout.current) return;
    setCartError('');
    try {
      await removeCartItem(listingId);
      applyCart(await readCart());
    } catch (error) {
      console.error('Remove item error:', error);
      setCartError(error instanceof Error ? error.message : 'Failed to remove item');
    }
  };

  const clearCart = async () => {
    if (clearingCartRef.current || savingCheckout.current || cartItems.length === 0) return;
    clearingCartRef.current = true;
    setClearingCart(true);
    setCartError('');
    try {
      await clearSavedCart();
      applyCart([]);
      setCheckoutModalVisible(false);
      setPaymentMessage('');
    } catch (error) {
      setCartError(error instanceof Error ? error.message : 'Failed to clear cart. Please try again.');
    } finally {
      setClearModalVisible(false);
      clearingCartRef.current = false;
      setClearingCart(false);
    }
  };

  const handleCheckout = async (items = cartItems) => {
    setCartError('');
    setDemoCheckout(await isDemoSession());
    if (items.some(item => item.pricing_configured === false)) {
      setCartError('A coupon has no price. Checkout is unavailable until its price is configured.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Add some items first!');
      return;
    }
    setCheckoutModalVisible(true);
    setPaymentMessage('');
    setPlacedOrder(null);
  };

  const submitOrder = async () => {
    if (savingCheckout.current) return;
    savingCheckout.current = true;
    setPaymentLoading(true);
    setPaymentMessage('');
    checkoutRequest.current ??= `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    try {
      if (demoCheckout) {
        const order = await placeOrder(checkoutRequest.current);
        applyCart([]);
        setCheckoutModalVisible(false);
        setPaymentMessage('');
        setPlacedOrder(order);
        checkoutRequest.current = null;
        return;
      }

      // 1. Initialize Payment with backend
      const paymentData = await createPaymentIntent(checkoutRequest.current);
      const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

      // 2. Present Stripe Checkout / Payment Sheet
      const result = await openStripeCheckout({
        publishableKey,
        clientSecret: paymentData.clientSecret,
        checkoutUrl: paymentData.checkoutUrl,
      });

      if (result.error) {
        if (result.error.code === 'Canceled') {
          setPaymentMessage('Payment was canceled.');
        } else {
          setPaymentMessage(result.error.message || 'Payment could not be processed.');
        }
        return;
      }

      if (result.redirected) {
        setCheckoutModalVisible(false);
        return;
      }

      // 3. Confirm order & verify payment on server
      const order = await confirmPaymentOrder({
        payment_intent_id: paymentData.paymentIntentId,
        request_id: checkoutRequest.current,
      });

      applyCart([]);
      setCheckoutModalVisible(false);
      setPaymentMessage('');
      setPlacedOrder(order);
      checkoutRequest.current = null;
    } catch (error) {
      console.error('Checkout error:', error);
      setPaymentMessage(error instanceof Error ? error.message : 'Unable to complete your order. Please try again.');
    } finally {
      savingCheckout.current = false;
      setPaymentLoading(false);
    }
  };

  if (loading && !placedOrder) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Loading cart...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {!!cartError && <Text accessibilityRole="alert" style={{ padding: 12, color: '#B91C1C', backgroundColor: '#FEF2F2' }}>{cartError}</Text>}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        {cartItems.length > 0 && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => { setCartError(''); setClearModalVisible(true); }}
            disabled={clearingCart}
            accessibilityRole="button"
            accessibilityLabel="Clear all cart items"
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B00']} />
        }
      >
        {cartItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={80} color="#D1D1D6" />
            <Text style={styles.emptyTitle}>Your Cart is Empty</Text>
            <Text style={styles.emptySubtitle}>Start adding items to your cart!</Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push('/listings')}
            >
              <Text style={styles.browseButtonText}>Browse Listings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {cartItems.map((item) => (
              <View key={item.cart_id || item.listing_id} style={styles.cartItem}>
                <Image
                  source={item.thumbnail_url ? { uri: item.thumbnail_url } : require('../../assets/images/Roameo-logo.png')}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
                <View style={styles.itemDetails}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.itemVendor}>{item.vendor_name || 'Unknown Vendor'}</Text>
                  <Text style={styles.itemPrice}>{item.pricing_configured === false ? 'No price' : `$${item.final_price.toFixed(2)}`}</Text>
                  {item.max_quantity && (
                    <Text style={styles.maxQuantityText}>Max: {item.max_quantity}</Text>
                  )}
                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.listing_id, item.quantity - 1)}
                    >
                      <Ionicons name="remove" size={16} color="#1C1C1E" />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.listing_id, item.quantity + 1)}
                    >
                      <Ionicons name="add" size={16} color="#1C1C1E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeItem(item.listing_id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.itemSubtotal}>{item.pricing_configured === false ? 'No price' : `$${(item.subtotal ?? item.final_price * item.quantity).toFixed(2)}`}</Text>
              </View>
            ))}

            {/* Cart Summary */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Items</Text>
                <Text style={styles.summaryValue}>{totalItems}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryTotal}>{cartItems.some(item => item.pricing_configured === false) ? 'No price' : `$${totalAmount.toFixed(2)}`}</Text>
              </View>
              <TouchableOpacity
                style={styles.checkoutButton}
                onPress={() => handleCheckout()}
              >
                <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!clearingCartRef.current) setClearModalVisible(false); }}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 24 }]}>
          <View style={[styles.modalContent, { borderRadius: 20 }]} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>Clear Cart</Text>
            <Text style={{ marginVertical: 20, color: '#48484A' }}>
              Remove all items from your cart?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={clearingCart}
                onPress={() => setClearModalVisible(false)}
                style={{ padding: 12 }}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Confirm clear cart"
                accessibilityState={{ disabled: clearingCart, busy: clearingCart }}
                disabled={clearingCart}
                onPress={clearCart}
                style={{ padding: 12, backgroundColor: '#EF4444', borderRadius: 8 }}
              >
                {clearingCart
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={{ color: '#FFF', fontWeight: '700' }}>Clear All</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal
        visible={checkoutModalVisible || placedOrder !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { if (!savingCheckout.current) { setCheckoutModalVisible(false); setPlacedOrder(null); } }}
      >
        {placedOrder ? (
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 24 }]}>
          <View style={[styles.modalContent, { borderRadius: 20, backgroundColor: '#F0FDF4' }]} accessibilityViewIsModal>
            <View style={styles.successContainer} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={72} color="#16A34A" />
              <Text style={[styles.successTitle, { color: '#15803D' }]}>Order placed!</Text>
              <Text style={styles.successSubtitle}>Your order #{placedOrder?.id} has been placed successfully.</Text>
              <Text style={styles.successAmount}>${placedOrder?.total_amount.toFixed(2)}</Text>
              <Text style={styles.successItemsCount}>{placedOrder?.total_items} items</Text>
              {placedOrder?.items.flatMap(item =>
                item.redemption_codes?.[0] ? [item.redemption_codes[0]] : []
              ).map(code => (
                <Text key={code} selectable style={styles.issuedCode}>{code}</Text>
              ))}
              <TouchableOpacity accessibilityRole="button" style={[styles.confirmButton, { backgroundColor: '#15803D', alignSelf: 'stretch' }]}
                onPress={() => {
                  const orderId = placedOrder?.id;
                  setPlacedOrder(null);
                  router.push({ pathname: '/(tabs)/orders', params: { orderId } });
                }}>
                <Text style={styles.confirmButtonText}>View order</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={{ padding: 16 }} onPress={() => setPlacedOrder(null)}>
                <Text style={{ color: '#15803D', fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        ) : (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout</Text>
              <TouchableOpacity disabled={paymentLoading} onPress={() => setCheckoutModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.modalBody}>
                {/* Order summary */}
                    {cartItems.map(item => (
                      <View key={item.listing_id} style={styles.modalSummaryRow}>
                        <Text style={[styles.modalSummaryLabel, { flex: 1 }]}>{item.title}{'\n'}${item.final_price.toFixed(2)} × {item.quantity}</Text>
                        <Text style={styles.modalSummaryValue}>${item.subtotal.toFixed(2)}</Text>
                      </View>
                    ))}
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Items ({totalItems})</Text>
                      <Text style={styles.modalSummaryValue}>${totalAmount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalSummaryLabel}>Delivery Fee</Text>
                      <Text style={styles.modalSummaryValue}>$0.00</Text>
                    </View>
                    <View style={styles.modalDivider} />
                    <View style={styles.modalSummaryRow}>
                      <Text style={styles.modalTotalLabel}>Total</Text>
                      <Text style={styles.modalTotalValue}>${totalAmount.toFixed(2)}</Text>
                    </View>

                    <View style={styles.stripeInfo}>
                      <Ionicons name="shield-checkmark" size={22} color="#635BFF" />
                      <View style={styles.paymentCopy}>
                        <Text style={styles.paymentTitle}>Secure Stripe Payment</Text>
                        <Text style={styles.paymentSubtitle}>
                          {demoCheckout ? 'Demo mode checkout.' : 'Pay securely with card using Stripe.'}
                        </Text>
                      </View>
                    </View>

                    {Boolean(paymentMessage) && (
                      <View style={styles.paymentMessageBox}>
                        <Ionicons name="information-circle" size={18} color="#B45309" />
                        <Text style={styles.paymentMessageText}>{paymentMessage}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.confirmButton}
                      accessibilityRole="button"
                      onPress={submitOrder}
                      disabled={paymentLoading}
                    >
                      {paymentLoading ? <ActivityIndicator color="#FFF" /> : <Ionicons name="card" size={16} color="#FFF" />}
                      <Text style={styles.confirmButtonText}>
                        {paymentLoading ? 'Processing...' : (demoCheckout ? 'Place order' : `Pay $${totalAmount.toFixed(2)}`)}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.demoNotice}>
                      <Text style={styles.demoNoticeText}>
                        {demoCheckout ? 'Demo mode. No real charges will be made.' : 'Stripe Test Mode. Your card will be processed in test mode.'}
                      </Text>
                    </View>
              </View>
            </ScrollView>
          </View>
        </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    gap: 4,
  },
  clearText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
  },
  browseButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  browseButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  itemVendor: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B00',
    marginTop: 4,
  },
  maxQuantityText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    marginLeft: 8,
    padding: 4,
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  summaryTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B00',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalBody: {
    paddingVertical: 8,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  modalSummaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalSummaryValue: {
    fontSize: 14,
    color: '#1C1C1E',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 8,
  },
  modalTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B00',
  },
  paymentForm: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8F8FA',
    borderRadius: 12,
  },
  paymentFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stripeInfo: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F7F6FF', 
    borderRadius: 12, 
    padding: 14, 
    marginTop: 16 
  },
  paymentCopy: { 
    flex: 1, 
    marginLeft: 12 
  },
  paymentTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#1C1C1E' 
  },
  paymentSubtitle: { 
    fontSize: 12, 
    color: '#8E8E93', 
    marginTop: 2 
  },
  demoNotice: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
  },
  demoNoticeText: {
    fontSize: 12,
    color: '#9A3412',
    textAlign: 'center',
  },
  paymentMessageBox: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 8, 
    backgroundColor: '#FFF7ED', 
    borderRadius: 8, 
    padding: 10, 
    marginTop: 10 
  },
  paymentMessageText: { 
    flex: 1, 
    color: '#9A3412', 
    fontSize: 12, 
    lineHeight: 17 
  },
  // Success styles
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  successDetails: {
    backgroundColor: '#F8F8FA',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  successAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B00',
  },
  successItemsCount: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  issuedCode: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
});
