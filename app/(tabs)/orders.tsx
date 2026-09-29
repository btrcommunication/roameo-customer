// app/(tabs)/orders.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order, readOrders, subscribeOrders } from '../../constants/orders';

const tabs = ['All', 'Upcoming', 'Completed', 'Canceled'];
const sectionFor = (order: Order) =>
  ['cancelled', 'canceled'].includes(order.status.toLowerCase()) ? 'Canceled'
  : order.status.toLowerCase() === 'completed' ? 'Completed'
  : 'Upcoming';
const statusLabel = (order: Order) =>
  order.status === 'placed' ? 'Order placed' : order.status.replace(/_/g, ' ');
const money = (amount: number, currency: string) =>
  currency === 'USD' ? `$${amount.toFixed(2)}` : `${currency} ${amount.toFixed(2)}`;
const paymentLabel = (order: Order) =>
  order.payment_status === 'demo' ? 'Demo order' : `Payment ${order.payment_status || 'pending'}`;

// Same wide + short image proportions as the listings screen
const IMAGE_WIDTH = 110;
const IMAGE_HEIGHT = 92;

export default function OrdersScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [activeTab, setActiveTab] = useState('All');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);
  const [issueText, setIssueText] = useState('');
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueSuccessMessage, setIssueSuccessMessage] = useState<string | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const handledOrder = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const next = await readOrders();
      if (!active.current || current !== generation.current) return;
      setOrders(next);
      setError('');
      if (orderId && handledOrder.current !== orderId) {
        const order = next.find(item => item.id === orderId);
        if (order) {
          setSelectedOrder(order);
          setActiveTab('All');
          handledOrder.current = orderId;
        }
      }
    } catch (cause) {
      if (active.current && current === generation.current) {
        setOrders([]);
        setError(cause instanceof Error ? cause.message : 'Unable to load orders.');
      }
        } finally {
      if (active.current && current === generation.current) setLoading(false);
    }
  }, [orderId, router]);

  const submitIssue = async () => {
    if (!issueText.trim() || !selectedOrder || !selectedOrder.items[0]) return;
    setIsSubmittingIssue(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/cart/orders/${selectedOrder.id}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          issue_text: issueText,
          coupon_id: selectedOrder.items[0].coupon_id
        })
      });
      if (res.ok) {
        setIssueSuccessMessage('Your issue has been reported and sent to the vendor.');
        setTimeout(() => setIssueSuccessMessage(null), 3000);
        setIssueText('');
        setIsReportingIssue(false);
      } else {
        const data = await res.json();
        setIssueSuccessMessage(data.message || 'Failed to submit issue');
        setTimeout(() => setIssueSuccessMessage(null), 3000);
      }
    } catch (err) {
      setIssueSuccessMessage('Network error while reporting issue.');
      setTimeout(() => setIssueSuccessMessage(null), 3000);
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      setOrders([]);
      setSelectedOrder(null);
      void refresh();
      const unsubscribe = subscribeOrders(() => { void refresh(); });
      return () => {
        active.current = false;
        generation.current++;
        unsubscribe();
      };
    }, [refresh])
  );

  const visibleOrders = orders.filter(order => activeTab === 'All' || sectionFor(order) === activeTab);
  const copyCouponCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedCouponCode(code);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Ionicons name="chevron-back" size={26} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.pageTitleText}>My Orders</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab}
                accessibilityRole="button"
                accessibilityState={{ selected: activeTab === tab }}
                style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStripContainer}>
          {tabs.map(tab => (
            <View key={tab} style={styles.statModuleCard}>
              <Text style={styles.statValueText}>
                {orders.filter(order => tab === 'All' || sectionFor(order) === tab).length}
              </Text>
              <Text style={styles.statLabelMain}>{tab === 'All' ? 'Total' : tab}</Text>
            </View>
          ))}
        </View>

        {/* Errors */}
        {!!error && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }}>
            <Text accessibilityRole="alert" style={{ color: '#B91C1C' }}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={refresh}>
              <Text style={styles.activeTabText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading */}
        {loading && !orders.length && (
          <ActivityIndicator color="#FF6B00" style={{ marginVertical: 24 }} />
        )}

        {/* Empty state */}
        {!loading && !error && !visibleOrders.length && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="bag-outline" size={36} color="#FF6B00" />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'All' ? 'No orders yet' : `No ${activeTab.toLowerCase()} orders`}
            </Text>
            <Text style={styles.emptySubtitle}>Your placed orders will appear here.</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.emptyCtaButton}
              onPress={() => router.push('/(tabs)/listings')}
            >
              <Text style={styles.emptyCtaButtonText}>Browse coupons</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Orders */}
        <View style={styles.sectionContainer}>
          {visibleOrders.map(order => {
            const item = order.items[0];
            const date = new Date(order.created_at);
            const section = sectionFor(order);
            const isCanceled = section === 'Canceled';
            const isCompleted = section === 'Completed';

            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCardItem}
                activeOpacity={0.9}
                onPress={() => setSelectedOrder(order)}
              >
                {/* Left: image with date ribbon */}
                <View style={styles.cardImageContainer}>
                  <Image
                    source={
                      item?.thumbnail_url
                        ? { uri: item.thumbnail_url }
                        : require('../../assets/images/Roameo-logo.png')
                    }
                    style={styles.cardMainAssetImage}
                    resizeMode="cover"
                  />
                  <View style={styles.dateRibbonBadge}>
                    <Text style={styles.dateDayText}>{date.getDate()}</Text>
                    <Text style={styles.dateMonthText}>
                      {date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Right: metadata */}
                <View style={styles.cardMetadataBlock}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardMainTitleText} numberOfLines={1}>
                      {item?.title || 'Coupon order'}
                      {order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}
                    </Text>
                    <View
                      style={[
                        styles.statusMicroPillFrame,
                        {
                          backgroundColor: isCanceled
                            ? '#FEE2E2'
                            : isCompleted
                            ? '#DCFCE7'
                            : '#FEF3C7',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusMicroPillValueText,
                          {
                            color: isCanceled
                              ? '#B91C1C'
                              : isCompleted
                              ? '#15803D'
                              : '#B45309',
                          },
                        ]}
                      >
                        {statusLabel(order)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardInfoLine} numberOfLines={1}>
                    Order #{order.id} · {order.total_items} {order.total_items === 1 ? 'item' : 'items'}
                  </Text>

                  <View style={styles.cardMetaRow}>
                    <Ionicons name="calendar-outline" size={12} color="#8E8E93" />
                    <Text style={styles.cardMetaText}>{date.toLocaleDateString()}</Text>
                  </View>

                  <View style={styles.cardMetaRow}>
                    <Ionicons name="card-outline" size={12} color="#8E8E93" />
                    <Text style={styles.cardMetaText}>{paymentLabel(order)}</Text>
                  </View>

                  {!!item?.redemption_codes?.[0] && (
                    <Text selectable numberOfLines={1} style={styles.cardCouponCode}>
                      Coupon code: {item.redemption_codes[0]}
                    </Text>
                  )}

                  <View style={styles.cardFooterRow}>
                    <Text style={styles.priceNumericalText}>
                      {money(order.total_amount, order.currency)}
                    </Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`View order ${order.id}`}
                      style={styles.detailsButton}
                      onPress={e => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                    >
                      <Ionicons name="eye-outline" size={12} color="#FF6B00" />
                      <Text style={styles.detailsButtonText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Help banner */}
        <View style={styles.supportBannerWrapper}>
          <View style={styles.supportIconBox}>
            <Ionicons name="headset-outline" size={18} color="#FF6B00" />
          </View>
          <View style={styles.supportTextContent}>
            <Text style={styles.supportTitleText}>Need help with an order?</Text>
            <Text style={styles.supportSubtitleText}>Our support team is here for you 24/7</Text>
          </View>
          <TouchableOpacity style={styles.supportActionLink}>
            <Text style={styles.supportActionText}>Contact</Text>
            <Ionicons name="chevron-forward" size={14} color="#FF6B00" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Order details modal */}
      <Modal
        visible={selectedOrder !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setSelectedOrder(null); setCopiedCouponCode(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>Order details</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close order details"
                onPress={() => { setSelectedOrder(null); setCopiedCouponCode(null); }}
                style={{ padding: 6 }}
              >
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text selectable style={styles.modalOrderId}>Order #{selectedOrder.id}</Text>
                <Text style={styles.modalDateText}>
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </Text>
                <View style={styles.modalStatusRow}>
                  <View
                    style={[
                      styles.statusMicroPillFrame,
                      {
                        backgroundColor: ['cancelled', 'canceled'].includes(selectedOrder.status.toLowerCase())
                          ? '#FEE2E2'
                          : '#DCFCE7',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusMicroPillValueText,
                        {
                          color: ['cancelled', 'canceled'].includes(selectedOrder.status.toLowerCase())
                            ? '#B91C1C'
                            : '#15803D',
                        },
                      ]}
                    >
                      {statusLabel(selectedOrder)}
                    </Text>
                  </View>
                  <Text style={styles.modalPaymentText}>{paymentLabel(selectedOrder)}</Text>
                </View>

                {selectedOrder.items.map((item, index) => (
                  <View key={`${item.coupon_id}-${index}`} style={styles.modalItemRow}>
                    <Image
                      source={
                        item.thumbnail_url
                          ? { uri: item.thumbnail_url }
                          : require('../../assets/images/Roameo-logo.png')
                      }
                      style={styles.modalItemImage}
                      resizeMode="cover"
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardMainTitleText} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.modalItemQty}>
                        {money(item.price, selectedOrder.currency)} × {item.quantity}
                      </Text>
                      <Text style={styles.priceNumericalText}>
                        {money(item.subtotal, selectedOrder.currency)}
                      </Text>
                      {!!item.redemption_codes?.[0] && (
                        <View style={styles.couponCodeRow}>
                          <Text selectable style={styles.modalCouponCode}>
                            Coupon code: {item.redemption_codes[0]}
                          </Text>
                          <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={`Copy coupon code ${item.redemption_codes[0]}`}
                            style={styles.copyCouponButton}
                            onPress={() => void copyCouponCode(item.redemption_codes![0])}
                          >
                            <Ionicons
                              name={copiedCouponCode === item.redemption_codes[0] ? 'checkmark' : 'copy-outline'}
                              size={14}
                              color="#9A3412"
                            />
                            <Text style={styles.copyCouponButtonText}>
                              {copiedCouponCode === item.redemption_codes[0] ? 'Copied' : 'Copy'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                ))}

                                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total</Text>
                  <Text style={styles.modalTotalValue}>
                    {money(selectedOrder.total_amount, selectedOrder.currency)}
                  </Text>
                </View>

                {/* Report Issue Section */}
                <View style={{ marginTop: 24, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 }}>
                  {issueSuccessMessage ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <Text style={{ marginLeft: 6, color: '#10B981', fontWeight: '600', fontSize: 14 }}>
                        {issueSuccessMessage}
                      </Text>
                    </View>
                  ) : !isReportingIssue ? (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setIsReportingIssue(true)}
                    >
                      <Ionicons name="warning-outline" size={18} color="#D97706" />
                      <Text style={{ marginLeft: 6, color: '#D97706', fontWeight: '600', fontSize: 15 }}>
                        Report an Issue
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>
                        Describe your issue
                      </Text>
                      <TextInput
                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#111827' }}
                        multiline
                        placeholder="What went wrong?"
                        placeholderTextColor="#9CA3AF"
                        value={issueText}
                        onChangeText={setIssueText}
                        editable={!isSubmittingIssue}
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 }}>
                        <TouchableOpacity onPress={() => setIsReportingIssue(false)} disabled={isSubmittingIssue}>
                          <Text style={{ color: '#6B7280', fontWeight: '600', padding: 8 }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={{ backgroundColor: '#D97706', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, opacity: isSubmittingIssue || !issueText.trim() ? 0.6 : 1 }}
                          onPress={submitIssue}
                          disabled={isSubmittingIssue || !issueText.trim()}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>
                            {isSubmittingIssue ? 'Sending...' : 'Submit'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  container: { flex: 1, backgroundColor: '#FAFAFA' },

  // Header
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  backButton: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  pageTitleText: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },

  // Tabs
  tabsContainer: { paddingHorizontal: 16, marginBottom: 14 },
  tabItem: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: { borderBottomColor: '#FF6B00' },
  tabText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  activeTabText: { color: '#FF6B00', fontWeight: '700' },

  // Stats strip
  statsStripContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statModuleCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    marginHorizontal: 3,
  },
  statValueText: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  statLabelMain: { fontSize: 10, color: '#8E8E93', fontWeight: '500', marginTop: 2 },

  // Empty state
  emptyContainer: { alignItems: 'center', padding: 32, gap: 10 },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FFF5EE', borderWidth: 1, borderColor: '#FFE5D4',
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  emptySubtitle: { fontSize: 12, color: '#8E8E93', textAlign: 'center' },
  emptyCtaButton: {
    marginTop: 8, backgroundColor: '#FF6B00',
    paddingHorizontal: 20, paddingVertical: 9, borderRadius: 22,
  },
  emptyCtaButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  // Section
  sectionContainer: { paddingHorizontal: 16, marginBottom: 8 },

  // Order card — same layout language as listings (wide/short image left, metadata right)
  orderCardItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    marginBottom: 12,
  },
  cardImageContainer: {
    position: 'relative',
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E5E5EA',
  },
  cardMainAssetImage: { width: '100%', height: '100%' },

  // Date ribbon
  dateRibbonBadge: {
    position: 'absolute',
    top: 6, left: 6,
    backgroundColor: '#FF6B00',
    borderRadius: 6,
    paddingVertical: 3, paddingHorizontal: 6,
    alignItems: 'center',
    minWidth: 34,
  },
  dateDayText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', lineHeight: 14 },
  dateMonthText: { fontSize: 8, fontWeight: '700', color: '#FFFFFF', marginTop: 1 },

  cardMetadataBlock: { flex: 1, marginLeft: 12 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  cardMainTitleText: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', flex: 1 },
  statusMicroPillFrame: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusMicroPillValueText: { fontSize: 10, fontWeight: '700' },

  cardInfoLine: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  cardMetaText: { fontSize: 11, color: '#8E8E93' },
  cardCouponCode: { fontSize: 10, color: '#9A3412', fontWeight: '700', marginTop: 5 },

  cardFooterRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8,
  },
  priceNumericalText: { fontSize: 14, fontWeight: '800', color: '#1C1C1E' },

  detailsButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#FF6B00',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  detailsButtonText: { color: '#FF6B00', fontSize: 11, fontWeight: '700' },

  // Support banner
  supportBannerWrapper: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#F2F2F7',
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  supportIconBox: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF0E5',
    justifyContent: 'center', alignItems: 'center',
  },
  supportTextContent: { marginLeft: 12, flex: 1 },
  supportTitleText: { fontSize: 13, fontWeight: '700', color: '#1C1C1E' },
  supportSubtitleText: { fontSize: 11, color: '#8E8E93', marginTop: 1 },
  supportActionLink: { flexDirection: 'row', alignItems: 'center' },
  supportActionText: { fontSize: 12, color: '#FF6B00', fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  modalTitleText: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  modalOrderId: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  modalDateText: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  modalStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 },
  modalPaymentText: { fontSize: 12, color: '#8E8E93' },
  modalItemRow: {
    flexDirection: 'row', gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  modalItemImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F2F2F7' },
  modalItemQty: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  modalCouponCode: {
    alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4,
    borderRadius: 5, overflow: 'hidden', backgroundColor: '#FFF0E5', color: '#9A3412',
    fontSize: 11, fontWeight: '800', letterSpacing: 0.4,
  },
  couponCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  copyCouponButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 5, borderWidth: 1, borderColor: '#FED7AA',
  },
  copyCouponButtonText: { fontSize: 11, fontWeight: '800', color: '#9A3412' },
  modalTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 16,
  },
  modalTotalLabel: { fontSize: 16, fontWeight: '800', color: '#1C1C1E' },
  modalTotalValue: { fontSize: 18, fontWeight: '800', color: '#FF6B00' },
});
