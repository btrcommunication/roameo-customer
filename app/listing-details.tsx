import { couponImageUrl, isApprovedCoupon } from '../constants/couponMedia';
import { formatCouponPrice } from '../constants/couponPrice';
import { addCartItem, readCart } from '../constants/cart';
import { useWishlist } from '../hooks/useWishlist';
import { WishlistNotice } from '../components/WishlistNotice';
// app/listing-details.tsx
import { AntDesign, Feather, FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Linking, Share, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');
const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

export default function ListingDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const listingId = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [similarListings, setSimilarListings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('Overview');

  const wishlist = useWishlist();
  const [actionMessage, setActionMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setListing(null);
    setSimilarListings([]);
    setActionMessage('');
    setActiveTab('Overview');
    setLoading(true);
    setError(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const load = async () => {
      try {
        if (!/^\d+$/.test(listingId || '') || Number(listingId) <= 0) throw new Error('Invalid coupon');
        const response = await fetch(`${API_BASE_URL}/api/coupons/${encodeURIComponent(listingId)}`);
        const result = await response.json();
        if (!response.ok || result.status !== 'success' || !result.data) throw new Error('Coupon unavailable');
        const coupon = result.data;
        if (!active) return;
        setListing({ ...coupon,
          category: coupon.category_name || 'Uncategorized',
          thumbnail: couponImageUrl(coupon.banner_image_url || coupon.banner_image),
          expiry: coupon.valid_until || coupon.expiry,
        });
        setLoading(false);
        try {
          const relatedResponse = await fetch(`${API_BASE_URL}/api/coupons?is_active=1&is_approved=1`);
          const related = await relatedResponse.json();
          if (active && relatedResponse.ok && Array.isArray(related.data)) {
            setSimilarListings(related.data.filter((item: any) => String(item.id) !== String(coupon.id)
              && isApprovedCoupon(item) && (!coupon.category_id || String(item.category_id) === String(coupon.category_id)))
              .slice(0, 4).map((item: any) => ({ ...item,
                image: couponImageUrl(item.banner_image_url || item.banner_image),
                type: item.category_name || 'Uncategorized',
              })));
          }
        } catch { /* Related coupons are optional. */ }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [listingId, retry]);

  const getPriceDisplay = () => formatCouponPrice(listing?.price);
  const getDiscountDisplay = () => listing?.coupon_code || listing?.subtitle || null;
  const getStatus = () => {
    if (!listing || !isApprovedCoupon(listing)) return 'Unavailable';
    if (listing.valid_from && new Date(listing.valid_from).getTime() > Date.now()) return 'Not started';
    if (listing.expiry && new Date(listing.expiry).getTime() < Date.now()) return 'Expired';
    return 'Available';
  };
  const getLocation = () => [listing?.city, listing?.district].filter(Boolean).join(', ') || 'Location not specified';
  const getVendorName = () => listing?.vendor_name || listing?.vendor?.name || 'Vendor not specified';
  const getVendorPhone = () => listing?.vendor_phone || listing?.vendor?.phone || '';
  const formatDate = (value: string) => value && !Number.isNaN(new Date(value).getTime())
    ? new Date(value).toLocaleDateString() : 'Not specified';
  const checkout = async () => {
    if (addingRef.current || getStatus() !== 'Available') return;
    addingRef.current = true;
    setAdding(true);
    setActionMessage('');
    try {
      const cart = await readCart();
      if (!cart.some(item => Number(item.coupon_id ?? item.listing_id) === Number(listing.id))) {
        await addCartItem(listing, params.ad_id ? Number(params.ad_id) : undefined);
      }
      router.push({ pathname: '/(tabs)/cart', params: { checkout: String(Date.now()) } });
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Unable to add coupon to cart.');
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Ionicons name="sad-outline" size={64} color="#D1D1D6" />
          <Text style={styles.loadingText}>Coupon details unavailable</Text>
          <Text style={styles.errorSubtext}>This coupon could not be loaded. Please retry or return to coupons.</Text>
          <TouchableOpacity onPress={() => setRetry(value => value + 1)} style={styles.backButtonLarge}><Text style={styles.backButtonText}>Retry</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonLarge}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const discountDisplay = getDiscountDisplay();
  const status = getStatus();
  const location = getLocation();
  const vendorName = getVendorName();
  const vendorPhone = getVendorPhone();
  const priceDisplay = getPriceDisplay();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Floating Header Actions atop Banner */}
      <View style={styles.floatingHeader}>
        <TouchableOpacity style={styles.circleActionButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <View style={styles.rightHeaderActions}>
          <TouchableOpacity accessibilityLabel="Save coupon to wishlist" disabled={wishlist.loading || !wishlist.ready || wishlist.pending !== null} onPress={() => wishlist.toggle(Number(listing.id))} style={[styles.circleActionButton, { marginRight: 12 }]}>
            <Ionicons name={wishlist.isSaved(listing.id) ? "heart" : "heart-outline"} size={22} color="#1C1C1E" />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Share coupon" style={styles.circleActionButton} onPress={() => {
            Share.share({ message: `${listing.title} - ${formatCouponPrice(listing.price)}${listing.coupon_code ? ` - Code: ${listing.coupon_code}` : ''}` })
              .catch(() => setActionMessage('Unable to share coupon.'));
          }}>
            <Ionicons name="share-social-outline" size={22} color="#1C1C1E" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
        {/* Banner Media Block */}
        <View style={styles.mediaBannerContainer}>
          <Image
            source={listing.thumbnail ? { uri: listing.thumbnail } : require('../assets/images/Roameo-logo.png')}
            style={styles.mainBannerImage}
          />{/* Brand Logo Floating Badge */}
          <View style={styles.brandLogoWrapper}>
            <Text style={styles.brandLogoMiniText}>COUPON</Text>
            <Text style={styles.brandLogoMainText} numberOfLines={2}>{vendorName}</Text>
            <Text style={styles.brandLogoSubText}>{listing.category}</Text>
          </View>{!!listing.thumbnail && <TouchableOpacity style={styles.thumbnailTrack}
            accessibilityLabel="View coupon photo"
            onPress={() => { setActiveTab('Photos'); scrollRef.current?.scrollTo({ y: sectionOffsets.current.Photos || 0, animated: true }); }}>
            <Image source={{ uri: listing.thumbnail }} style={styles.thumbImage} />
          </TouchableOpacity>}
        </View>

        {/* Title Meta block - DYNAMIC */}
        <WishlistNotice error={wishlist.error} needsLogin={wishlist.needsLogin} retry={wishlist.refresh} />
        {!!actionMessage && <Text accessibilityRole="alert" style={{ padding: 16, color: '#B91C1C' }}>{actionMessage}</Text>}
        <View style={styles.metaContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.mainTitleText}>{listing.title}</Text>
            <MaterialCommunityIcons name="ticket-percent-outline" size={18} color="#FF6B00" style={{ marginLeft: 6, marginTop: 4 }} />
          </View>
          <Text style={styles.categorySubtext}>{listing.category} • {listing.city || 'Location'}</Text>
          <Text style={styles.ratingText}>{priceDisplay}</Text>
          <Text style={styles.categorySubtext}>{vendorName}</Text>
          {!!listing.subtitle && <Text style={styles.bodyDescriptionText}>{listing.subtitle}</Text>}
        </View>

        {/* Promotional Ticket Block - DYNAMIC */}
        {discountDisplay && (
          <View style={styles.couponContainer}>
            <View style={styles.couponLeftBlock}>
              <View style={styles.couponIconBox}>
                <MaterialCommunityIcons name="percent" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.couponTextBlock}>
                <Text style={styles.couponTitleText}>{discountDisplay}</Text>
                <Text style={styles.couponValidityText}>
                  {listing.expiry ? `Valid until ${new Date(listing.expiry).toLocaleDateString()}` : 'Limited time offer'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.claimCouponTrigger} onPress={checkout} disabled={adding || status !== 'Available'}>
              <Text style={styles.claimCouponText}>{adding ? 'ADDING...' : 'GET COUPON'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Segment Tabs Navigation */}
        <View style={styles.tabsStrip}>
          {['Overview', 'Details', 'Reviews', 'Photos'].map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tabElement, activeTab === tab && styles.activeTabElement]}
              onPress={() => { setActiveTab(tab); scrollRef.current?.scrollTo({ y: sectionOffsets.current[tab] || 0, animated: true }); }}
            >
              <Text style={[styles.tabLabelText, activeTab === tab && styles.activeTabLabelText]}>
                {tab} {tab === 'Reviews' && `(${listing.review_count || 0})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dynamic Context Split Panel */}
        <View style={styles.splitBodyContainer} onLayout={event => { sectionOffsets.current.Overview = event.nativeEvent.layout.y; }}>
          <View style={styles.leftDetailColumn}>
            <Text style={styles.blockHeading}>Description</Text>
            <Text style={styles.bodyDescriptionText}>{listing.description || 'No description available for this listing.'}</Text>

            <Text style={[styles.blockHeading, { marginTop: 16 }]}>Location</Text>
            <Text style={styles.locationBodyText}>{location}</Text>
            <Text style={styles.distanceValueText}>{listing.distance || ''}</Text>
            <TouchableOpacity style={styles.directionsPillButton} disabled={!listing.city} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`).catch(() => setActionMessage('Unable to open directions.'))}>
              <Feather name="compass" size={14} color="#FF6B00" />
              <Text style={styles.directionsPillText}>Directions</Text>
            </TouchableOpacity>
          </View>

          {/* Map Canvas */}
          <View style={styles.rightMapColumn}>
            <View style={styles.mapCanvasWrapper}>
              <View style={styles.mapGridLineH} />
              <View style={[styles.mapGridLineV, { left: '35%' }]} />
              <View style={[styles.mapGridLineV, { left: '75%' }]} />
              <View style={{ position: 'absolute', top: 20, left: 10, transform: [{ rotate: '-45deg' }] }}><Text style={styles.mapLabelRoute}>Main St</Text></View>
              <View style={{ position: 'absolute', top: 12, right: 15 }}><Text style={styles.mapLabelRoute}>Park Ave</Text></View>
              <View style={styles.mapPoiContainer}>
                <Ionicons name="library" size={10} color="#007AFF" />
                <Text style={styles.mapPoiText}>Nearby Landmark</Text>
              </View>
              <View style={[styles.mapPoiContainer, { top: 95 }]}>
                <Ionicons name="business" size={10} color="#007AFF" />
                <Text style={styles.mapPoiText}>Business District</Text>
              </View>
              <View style={styles.mapPinAbsoluteAnchor}>
                <Ionicons name="location" size={32} color="#E53935" />
                <View style={styles.mapPinPulseRing} />
              </View>
              <View style={styles.mapLocationTargetButton}>
                <MaterialCommunityIcons name="target" size={18} color="#1C1C1E" />
              </View>
              <View style={{ position: 'absolute', bottom: 4, right: 6 }}><Text style={styles.googleWatermark}>Google</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.perksSectionContainer} onLayout={event => { sectionOffsets.current.Details = event.nativeEvent.layout.y; }}>
          <Text style={styles.blockHeading}>Coupon Details</Text>
          <Text style={styles.bodyDescriptionText}>Vendor: {vendorName}</Text>
          <Text style={styles.bodyDescriptionText}>Category: {listing.category}</Text>
          <Text style={styles.bodyDescriptionText}>Price: {priceDisplay}</Text>
          <Text style={styles.bodyDescriptionText}>Code: {listing.coupon_code || 'Not provided'}</Text>
          <Text style={styles.bodyDescriptionText}>Maximum quantity: {listing.max_quantity ?? 'Not specified'}</Text>
          <Text style={styles.bodyDescriptionText}>Valid from: {formatDate(listing.valid_from)}</Text>
          <Text style={styles.bodyDescriptionText}>Valid until: {formatDate(listing.expiry)}</Text>
        </View>

        {/* Status Indicators */}
        <View style={styles.statusDualRow}>
          <View style={styles.statusSquareInfoCard}>
            <View style={styles.statusSquareTopLine}>
              <View style={[styles.statusCircleIconContainer, status === 'Available' ? { backgroundColor: '#E8F5E9' } : { backgroundColor: '#FFEBEE' }]}>
                <Feather name="clock" size={16} color={status === 'Available' ? '#2E7D32' : '#C62828'} />
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.statusLabelGreen, status === 'Available' ? { color: '#2E7D32' } : { color: '#C62828' }]}>
                  {status}
                </Text>
                <Text style={styles.statusSubtextMuted}>{listing.expiry ? `Ends ${formatDate(listing.expiry)}` : 'No end date provided'}</Text>
              </View>
            </View>
            <Ionicons name="chevron-down" size={16} color="#8E8E93" />
          </View>

          <View style={styles.statusSquareInfoCard}>
            <View style={styles.statusSquareTopLine}>
              <View style={[styles.statusCircleIconContainer, { backgroundColor: '#F2F2F7' }]}>
                <Feather name="phone" size={15} color="#1C1C1E" />
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.statusLabelBold}>Vendor phone</Text>
                <Text style={styles.statusSubtextMuted}>{vendorPhone || 'Not provided'}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.analyticsSection} onLayout={event => { sectionOffsets.current.Reviews = event.nativeEvent.layout.y; }}>
          <Text style={styles.blockHeading}>Reviews</Text>
          <Text style={styles.bodyDescriptionText}>{listing.rating != null
            ? `${listing.rating} / 5 (${listing.review_count ?? 0} reviews)` : 'No reviews available for this coupon.'}</Text>
        </View>
        <View style={styles.analyticsSection} onLayout={event => { sectionOffsets.current.Photos = event.nativeEvent.layout.y; }}>
          <Text style={styles.blockHeading}>Photos</Text>
          {!!listing.thumbnail ? <Image source={{ uri: listing.thumbnail }} style={[styles.mainBannerImage, { height: 180 }]} />
            : <Text style={styles.bodyDescriptionText}>No photos available.</Text>}
        </View>

        {/* Related Suggestions Section */}
        {similarListings.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeaderFlex}>
              <Text style={styles.blockHeading}>You Might Also Like</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/listings')}><Text style={styles.sectionActionText}>See All</Text></TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 16 }}>
              {similarListings.map((item) => (
                <TouchableOpacity 
                  key={item.id} 
                  style={styles.similarProductCard}
                  onPress={() => {
                    router.push({
                      pathname: '/listing-details',
                      params: { id: item.id }
                    });
                  }}
                >
                  <View style={styles.similarImageFrame}>
                    <Image source={item.image ? { uri: item.image } : require('../assets/images/Roameo-logo.png')} style={styles.similarCardImage} />
                    {item.discount && (
                      <View style={styles.similarRibbonBadge}>
                        <Text style={styles.similarRibbonText}>{item.discount}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.similarHeartFloatingButton} disabled={wishlist.loading || !wishlist.ready || wishlist.pending !== null} onPress={event => { event.stopPropagation(); void wishlist.toggle(Number(item.id)); }}>
                      <Ionicons name={wishlist.isSaved(item.id) ? "heart" : "heart-outline"} size={12} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.similarCardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.similarCardCategory} numberOfLines={1}>{item.type}</Text>
                  <View style={styles.similarCardRatingRow}>
                    <Ionicons name="star" size={10} color="#FFBB00" />
                    <Text style={styles.similarCardRatingText}>{formatCouponPrice(item.price)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Floating Sticky Bottom Primary CTA Box */}
      <View style={styles.stickyActionFooter}>
        <TouchableOpacity style={[styles.primaryActionButton, (adding || status !== 'Available') && { opacity: 0.5 }]} onPress={checkout} disabled={adding || status !== 'Available'}>
          <Text style={styles.primaryActionText}>{adding ? 'Adding...' : status === 'Available' ? `Get Coupon - ${priceDisplay}` : status}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 14,
  },
  errorSubtext: {
    marginTop: 8,
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  backButtonLarge: {
    marginTop: 16,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingHeader: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    zIndex: 99,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  circleActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rightHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mediaBannerContainer: {
    position: 'relative',
    height: 220,
    width: '100%',
    backgroundColor: '#F2F2F7',
  },
  mainBannerImage: {
    width: '100%',
    height: 190,
    resizeMode: 'cover',
  },
  brandLogoWrapper: {
    position: 'absolute',
    top: 110,
    left: 16,
    width: 80,
    height: 80,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  brandLogoMiniText: {
    fontSize: 8,
    color: '#8E8E93',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  brandLogoMainText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1C1C1E',
    lineHeight: 18,
  },
  brandLogoSubText: {
    fontSize: 9,
    color: '#555',
    fontWeight: '500',
    letterSpacing: 1,
  },
  thumbnailTrack: {
    position: 'absolute',
    bottom: 8,
    right: 16,
    flexDirection: 'row',
  },
  thumbImage: {
    width: 52,
    height: 42,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  morePhotosThumb: {
    width: 52,
    height: 42,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  morePhotosText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  metaContainer: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  categorySubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginLeft: 4,
  },
  reviewCountText: {
    fontWeight: '400',
    color: '#8E8E93',
  },
  couponContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F5',
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 18,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  couponLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  couponIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E65100',
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponTextBlock: {
    marginLeft: 12,
    flex: 1,
  },
  couponTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  couponValidityText: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  claimCouponTrigger: {
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  claimCouponText: {
    color: '#FF6B00',
    fontSize: 11,
    fontWeight: '700',
  },
  tabsStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabElement: {
    paddingVertical: 10,
    marginRight: 24,
  },
  activeTabElement: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B00',
  },
  tabLabelText: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '500',
  },
  activeTabLabelText: {
    color: '#FF6B00',
    fontWeight: '700',
  },
  splitBodyContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  leftDetailColumn: {
    flex: 0.52,
  },
  rightMapColumn: {
    flex: 0.44,
  },
  blockHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  bodyDescriptionText: {
    fontSize: 12,
    color: '#555555',
    lineHeight: 18,
  },
  readMoreAction: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  locationBodyText: {
    fontSize: 12,
    color: '#1C1C1E',
    lineHeight: 16,
  },
  distanceValueText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  directionsPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  directionsPillText: {
    color: '#FF6B00',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  mapCanvasWrapper: {
    width: '100%',
    height: 155,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  mapGridLineH: {
    position: 'absolute',
    top: '55%',
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: '#FFFFFF',
  },
  mapGridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 10,
    backgroundColor: '#FFFFFF',
  },
  mapLabelRoute: {
    position: 'absolute',
    fontSize: 8,
    color: '#8E8E93',
    fontWeight: '500',
  },
  mapPoiContainer: {
    position: 'absolute',
    top: 45,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '85%',
  },
  mapPoiText: {
    fontSize: 7,
    color: '#1976D2',
    fontWeight: '600',
    marginLeft: 2,
  },
  mapPinAbsoluteAnchor: {
    position: 'absolute',
    top: '40%',
    left: '60%',
    marginLeft: -16,
    marginTop: -26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinPulseRing: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -4,
  },
  mapLocationTargetButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  googleWatermark: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    fontSize: 11,
    fontWeight: '800',
    color: '#7F7F7F',
    opacity: 0.6,
  },
  perksSectionContainer: {
    marginTop: 20,
  },
  perksScrollTrack: {
    paddingLeft: 16,
    paddingVertical: 4,
  },
  perkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  perkPillText: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '500',
    marginLeft: 6,
  },
  statusDualRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    marginTop: 18,
  },
  statusSquareInfoCard: {
    flex: 0.485,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F2F2F7',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusSquareTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusCircleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabelGreen: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },
  statusLabelBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statusSubtextMuted: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  analyticsSection: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
  },
  analyticsFlexWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  aggregatedScoreBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 20,
  },
  bigScoreText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  starRowInline: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  ratingSubLabelCount: {
    fontSize: 11,
    color: '#8E8E93',
  },
  histogramColumn: {
    flex: 1,
    paddingLeft: 10,
  },
  histogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  histogramDigitLabel: {
    fontSize: 11,
    color: '#1C1C1E',
    fontWeight: '600',
    width: 8,
  },
  histogramBarTrack: {
    flex: 1,
    height: 5,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
  },
  histogramBarFill: {
    height: 5,
    backgroundColor: '#FF6B00',
    borderRadius: 3,
  },
  histogramCountText: {
    fontSize: 11,
    color: '#8E8E93',
    width: 26,
    textAlign: 'right',
  },
  footerLinkRowTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 6,
  },
  footerLinkText: {
    color: '#FF6B00',
    fontSize: 13,
    fontWeight: '700',
  },
  relatedSection: {
    marginTop: 24,
  },
  sectionHeaderFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionActionText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '700',
  },
  similarProductCard: {
    width: 140,
    marginRight: 12,
  },
  similarImageFrame: {
    width: '100%',
    height: 95,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F2F2F7',
  },
  similarCardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  similarRibbonBadge: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  similarRibbonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  similarHeartFloatingButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 6,
  },
  similarCardCategory: {
    fontSize: 11,
    color: '#8E8E93',
    marginVertical: 1,
  },
  similarCardRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarCardRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1C1C1E',
    marginLeft: 3,
  },
  stickyActionFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionButton: {
    backgroundColor: '#E65100',
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
