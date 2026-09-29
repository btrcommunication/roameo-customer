// app/(tabs)/wishlist.tsx
import { isApprovedCoupon } from '../../constants/couponMedia';
import { formatCouponPrice } from '../../constants/couponPrice';
import { useWishlist } from '../../hooks/useWishlist';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

const getImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/uploads')) return `${API_BASE_URL}${imagePath}`;
  if (imagePath.startsWith('uploads')) return `${API_BASE_URL}/${imagePath}`;
  return `${API_BASE_URL}/${imagePath}`;
};

export default function WishlistScreen() {
  const router = useRouter();
  const wishlist = useWishlist();

  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCoupons = useCallback(async () => {
    try {
      const url = `${API_BASE_URL}/api/coupons?is_approved=1`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          const activeCoupons = (result.data || []).filter(isApprovedCoupon);
          setCoupons(activeCoupons);
        }
      }
    } catch (error) {
      console.error('Error fetching wishlist coupons:', error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchCoupons();
      setLoading(false);
    })();
  }, [fetchCoupons]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([wishlist.refresh(), fetchCoupons()]);
    setRefreshing(false);
  };

  // Only show coupons the user has saved
  const savedItems = coupons.filter((coupon) =>
    wishlist.items.some((item) => Number(item.id) === Number(coupon.id))
  );

  const renderItem = ({ item }: { item: any }) => {
    const imageUrl = getImageUrl(item.banner_image_url || item.banner_image);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          router.push({ pathname: '/listing-details', params: { id: String(item.id) } })
        }
      >
        <View style={styles.imageWrapper}>
          <Image
            source={
              imageUrl
                ? { uri: imageUrl }
                : require('../../assets/images/Roameo-logo.png')
            }
            style={styles.cardImage}
          />
          <TouchableOpacity
            style={styles.favoriteButton}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.title} from wishlist`}
            disabled={wishlist.loading || wishlist.pending !== null || !wishlist.ready}
            onPress={(event) => {
              event.stopPropagation();
              void wishlist.toggle(Number(item.id));
            }}
          >
            <Ionicons name="heart" size={18} color="#FF6B00" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title || 'Coupon Offer'}
          </Text>
          <Text style={styles.cardVendor} numberOfLines={1}>
            {item.vendor_name || 'Vendor'}
          </Text>
          {/* <View style={styles.codeRow}>
            <Ionicons name="pricetag-outline" size={12} color="#8E8E93" />
            <Text style={styles.codeText} numberOfLines={1}>
              Code: {item.coupon_code}
            </Text>
          </View> */}
          <Text style={styles.cardPrice}>{formatCouponPrice(item.price)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading your wishlist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (savedItems.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="heart-outline" size={44} color="#FF6B00" />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptyDesc}>
            Tap the heart on any coupon to save it here for later.
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)/listings')}
          >
            <Text style={styles.browseButtonText}>Browse Coupons</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={savedItems}
        renderItem={renderItem}
        keyExtractor={(item, index) => `wishlist-${item.id || index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B00']}
          />
        }
        ListHeaderComponent={
          <Text style={styles.headerCount}>
            {savedItems.length} {savedItems.length === 1 ? 'item' : 'items'} saved
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 14,
  },
  // Empty state
  emptyIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF5EE',
    borderWidth: 1,
    borderColor: '#FFE5D4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  browseButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 22,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCount: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 10,
  },
  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    overflow: 'hidden',
  },
  imageWrapper: {
    position: 'relative',
    width: 110,
    height: 110,
    backgroundColor: '#F2F2F7',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardVendor: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  codeText: {
    fontSize: 10,
    color: '#1C1C1E',
    fontWeight: '600',
    marginLeft: 3,
  },
  cardPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF6B00',
    marginTop: 4,
  },
});