import { formatCouponPrice } from '../constants/couponPrice';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWishlist } from '../hooks/useWishlist';
import { WishlistNotice } from '../components/WishlistNotice';
import { addCartItem, readCart } from '../constants/cart';
import { WishlistCoupon } from '../constants/wishlist';

export default function WishlistScreen() {
  const router = useRouter();
  const wishlist = useWishlist();
  const [checkingOut, setCheckingOut] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const checkoutBusy = useRef(false);
  const checkout = async (coupon: WishlistCoupon) => {
    if (checkoutBusy.current) return;
    checkoutBusy.current = true;
    setCheckingOut(coupon.id);
    setCheckoutError('');
    try {
      const cart = await readCart();
      if (!cart.some(item => Number(item.coupon_id ?? item.listing_id) === coupon.id)) {
        await addCartItem(coupon);
      }
      router.push({ pathname: '/(tabs)/cart', params: { checkout: String(Date.now()) } });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Unable to start checkout. Please try again.');
    } finally {
      checkoutBusy.current = false;
      setCheckingOut(null);
    }
  };
  return <SafeAreaView style={styles.page}>
    <View style={styles.header}>
      <TouchableOpacity accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} style={{ padding: 8 }}>
        <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
      </TouchableOpacity>
      <Text style={styles.heading}>My Wishlist</Text>
      <Text>{wishlist.loading ? '...' : wishlist.ready ? wishlist.items.length : ''}</Text>
    </View>
    <WishlistNotice error={wishlist.error} needsLogin={wishlist.needsLogin} retry={wishlist.refresh} />
    {wishlist.ready && wishlist.items.length > 0 && <TouchableOpacity
      accessibilityRole="button" accessibilityLabel="Remove all wishlist items"
      disabled={checkingOut !== null || wishlist.pending !== null || wishlist.loading}
      onPress={wishlist.removeAll}
      style={[styles.button, { margin: 16, alignSelf: 'flex-end' },
        (checkingOut !== null || wishlist.pending !== null || wishlist.loading) && { opacity: 0.5 }]}>
      <Text style={styles.buttonText}>{wishlist.pending === 0 ? 'Removing all...' : 'Remove all'}</Text>
    </TouchableOpacity>}
    {!!checkoutError && <Text accessibilityRole="alert" style={{ padding: 12, color: '#B91C1C' }}>{checkoutError}</Text>}
    <ScrollView contentContainerStyle={{ padding: 16, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={wishlist.loading} onRefresh={wishlist.refresh} />}>
      {wishlist.loading && !wishlist.ready && <ActivityIndicator color="#FF6B00" />}
      {!wishlist.loading && wishlist.ready && !wishlist.items.length && <View style={styles.empty}>
        <Ionicons name="heart-outline" size={48} color="#FF6B00" />
        <Text style={styles.heading}>Your wishlist is empty</Text>
        <Text>Tap a coupon's heart to save it here.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/listings')}><Text style={styles.buttonText}>Browse coupons</Text></TouchableOpacity>
      </View>}
      {wishlist.items.map(item => <View key={item.id} style={styles.card}>
        <Image source={item.banner_image_url ? { uri: item.banner_image_url } : require('../assets/images/Roameo-logo.png')} style={styles.image} />
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={styles.heading}>{item.title}</Text>
          <Text>{formatCouponPrice(item.price)}</Text>
          {!!item.vendor_name && <Text>{item.vendor_name}</Text>}
          {!!item.category_name && <Text style={styles.muted}>{item.category_name}</Text>}
          {!!(item.description || item.subtitle) && <Text>{item.description || item.subtitle}</Text>}
          {!!(item.valid_until || item.expiry) && <Text style={styles.muted}>Valid until: {new Date(item.valid_until || item.expiry!).toLocaleDateString()}</Text>}
          {(Number(item.is_active) !== 1 || Number(item.is_approved) !== 1) && <Text style={styles.muted}>Currently unavailable</Text>}
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Checkout ${item.title}`}
            disabled={checkingOut !== null || wishlist.pending !== null || wishlist.loading || !wishlist.ready || Number(item.is_active) !== 1 || Number(item.is_approved) !== 1}
            style={[styles.checkoutButton, (checkingOut !== null || wishlist.pending !== null || wishlist.loading || !wishlist.ready || Number(item.is_active) !== 1 || Number(item.is_approved) !== 1) && { opacity: 0.5 }]}
            onPress={() => checkout(item)}>
            <Text style={styles.checkoutText}>{checkingOut === item.id ? 'Preparing checkout...' : 'Checkout'}</Text>
          </TouchableOpacity>
          <Text style={styles.muted}>Continue with this coupon and any items already in your cart.</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from wishlist`}
            disabled={checkingOut !== null || wishlist.pending !== null || wishlist.loading || !wishlist.ready} style={styles.button}
            onPress={() => wishlist.toggle(item.id)}>
            <Text style={styles.buttonText}>{wishlist.pending === item.id ? 'Removing...' : 'Remove from wishlist'}</Text>
          </TouchableOpacity>
        </View>
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F7F7FA' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#fff' },
  heading: { fontSize: 20, fontWeight: '700', color: '#1C1C1E' },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  image: { width: '100%', height: 180 },
  muted: { color: '#636366' },
  button: { padding: 12, backgroundColor: '#FFF0E5', borderRadius: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#B44900', fontWeight: '700' },
  checkoutButton: { padding: 14, backgroundColor: '#FF6B00', borderRadius: 10, alignItems: 'center' },
  checkoutText: { color: '#fff', fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
});
