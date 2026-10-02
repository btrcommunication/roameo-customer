// app/(tabs)/listings.tsx
import { WishlistNotice } from '../../components/WishlistNotice';
import { couponImageUrl, isApprovedCoupon } from '../../constants/couponMedia';
import { formatCouponPrice } from '../../constants/couponPrice';
import { useWishlist } from '../../hooks/useWishlist';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { addCartItem, readCart, subscribeCartChanges } from '../../constants/cart';

const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;
const { width, height } = Dimensions.get('window');

const HARDCODED_DISCOUNTS = ['20% OFF', '15% OFF', '15% OFF', '10% OFF', '10% OFF', '25% OFF', '30% OFF', '5% OFF'];
const HARDCODED_RATINGS = [
  { rating: 4.6, reviews: 230 },
  { rating: 4.8, reviews: 120 },
  { rating: 4.5, reviews: 310 },
  { rating: 4.3, reviews: 120 },
  { rating: 4.2, reviews: 80 },
  { rating: 4.7, reviews: 190 },
  { rating: 4.4, reviews: 150 },
  { rating: 4.9, reviews: 95 },
];
const HARDCODED_DISTANCES = ['1.2 km away', '800 m away', '2.3 km away', '1.5 km away', '3.1 km away', '2.0 km away', '4.2 km away', '0.9 km away'];
const HARDCODED_MAP_AREA = ['Salt Lake', 'Park Street', 'New Town', 'Ballygunge', 'Howrah', 'Behala', 'Garia', 'Dum Dum'];

const CATEGORY_VISIBLE_COUNT = 4;

const PRICE_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: '$0 - $200', min: 0, max: 200 },
  { label: '$200 - $500', min: 200, max: 500 },
  { label: '$500 - $1000', min: 500, max: 1000 },
  { label: '$1000+', min: 1000, max: Infinity },
];

const SORT_OPTIONS = [
  { label: 'Default', value: 'Default' },
  { label: 'Newest', value: 'Newest' },
  { label: 'Price: Low to High', value: 'Price Low-High' },
  { label: 'Price: High to Low', value: 'Price High-Low' },
  { label: 'Customer Rating: High to Low', value: 'Rating High-Low' },
  { label: 'Title: A to Z', value: 'Title A-Z' },
];

const RATING_OPTIONS = [
  { label: 'All Ratings', value: 'All' },
  { label: '4.5 ★ & above', value: '4.5+' },
  { label: '4.0 ★ & above', value: '4.0+' },
  { label: '3.5 ★ & above', value: '3.5+' },
  { label: '3.0 ★ & above', value: '3.0+' },
];

const LIST_IMAGE_WIDTH = Math.round(width * 0.38);
const LIST_IMAGE_HEIGHT = 92;

export default function ListingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    search?: string;
    category?: string;
    category_id?: string;
    category_ids?: string;
    coupon_ids?: string;
    vendor_id?: string;
  }>();
  const wishlist = useWishlist();
  const [cartMessage, setCartMessage] = useState('');
  const addingRef = useRef(false);

  const [listings, setListings] = useState<any[]>([]);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [newlyAdded, setNewlyAdded] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter States
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<number[]>([]);
  const [selectedCouponIds, setSelectedCouponIds] = useState<number[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedRating, setSelectedRating] = useState<string>('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('All');
  const [sortBy, setSortBy] = useState('Default');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // E-Commerce Filter Modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState<'sort' | 'price' | 'vendor' | 'category' | 'rating' | 'location'>('sort');
  const [vendorSearch, setVendorSearch] = useState('');

  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<Set<number>>(new Set());
  const [addingToCart, setAddingToCart] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(CATEGORY_VISIBLE_COUNT);
  const [selectedMapMarker, setSelectedMapMarker] = useState<number | null>(null);

  const getCategoryIcon = (categoryName: string) => {
    const iconMap: { [key: string]: { icon: string; library: string } } = {
      'Restaurants': { icon: 'utensils', library: 'FontAwesome5' },
      'restaurants': { icon: 'utensils', library: 'FontAwesome5' },
      'Spa & Wellness': { icon: 'flower-poppy', library: 'MaterialCommunityIcons' },
      'spa': { icon: 'flower-poppy', library: 'MaterialCommunityIcons' },
      'Hotels': { icon: 'hotel', library: 'FontAwesome5' },
      'hotels': { icon: 'hotel', library: 'FontAwesome5' },
      'Lifestyle': { icon: 'shopping-bag', library: 'FontAwesome5' },
      'lifestyle': { icon: 'shopping-bag', library: 'FontAwesome5' },
      'Cafe': { icon: 'coffee', library: 'FontAwesome5' },
      'cafe': { icon: 'coffee', library: 'FontAwesome5' },
      'Pizza': { icon: 'pizza', library: 'FontAwesome5' },
      'pizza': { icon: 'pizza', library: 'FontAwesome5' },
      'Chinese': { icon: 'bowl-food', library: 'MaterialCommunityIcons' },
      'Indian': { icon: 'food-curry', library: 'MaterialCommunityIcons' },
      'Burgers': { icon: 'hamburger', library: 'FontAwesome5' },
      'Activities': { icon: 'bicycle', library: 'FontAwesome5' },
      'Outdoor': { icon: 'tree', library: 'FontAwesome5' },
      'Water Sports': { icon: 'swimmer', library: 'FontAwesome5' },
      'Fitness': { icon: 'dumbbell', library: 'MaterialCommunityIcons' },
      'Yoga': { icon: 'human', library: 'MaterialCommunityIcons' },
      'Massage': { icon: 'spa', library: 'MaterialCommunityIcons' },
    };
    if (iconMap[categoryName]) return iconMap[categoryName];
    const lowerKey = categoryName.toLowerCase();
    for (const key in iconMap) {
      if (key.toLowerCase() === lowerKey) return iconMap[key];
    }
    return { icon: 'grid', library: 'Ionicons' };
  };

  const getImageUrl = (imagePath: string | null | undefined): string | null => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    if (imagePath.startsWith('/uploads')) return `${API_BASE_URL}${imagePath}`;
    if (imagePath.startsWith('uploads')) return `${API_BASE_URL}/${imagePath}`;
    return `${API_BASE_URL}/${imagePath}`;
  };

  const mapCouponToListing = (coupon: any) => ({
    id: coupon.id,
    title: coupon.title || 'Coupon Offer',
    type: 'Coupon',
    description: coupon.subtitle || '',
    price: coupon.price,
    coupon_code: coupon.coupon_code,
    distance: coupon.vendor_name || 'Vendor',
    status: coupon.is_active === 1 ? 'Open' : 'Closed',
    image: couponImageUrl(coupon.banner_image_url || coupon.banner_image),
    city: coupon.city || '',
    district: '',
    category: coupon.category_name || 'Uncategorized',
    category_id: coupon.category_id,
    vendor_id: coupon.vendor_id,
    vendor_name: coupon.vendor_name,
    is_active: coupon.is_active,
    expiry: coupon.expiry || coupon.valid_until,
    valid_from: coupon.valid_from,
    priority: coupon.priority,
    max_quantity: coupon.max_quantity || 1,
    created_at: coupon.created_at,
    latitude: coupon.latitude || (22.5726 + (coupon.id % 20 - 10) * 0.02),
    longitude: coupon.longitude || (88.3639 + (coupon.id % 30 - 15) * 0.02),
    original: coupon,
  });

  const locations: string[] = ['All', ...new Set<string>(allListings.map(item => item.city).filter(Boolean))].sort();

  // Dynamic Vendors (Brands) list
  const vendorsList = Array.from(
    new Map(
      allListings
        .filter(item => item.vendor_id && item.vendor_name)
        .map(item => [Number(item.vendor_id), { id: Number(item.vendor_id), name: String(item.vendor_name) }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Handle URL Params
  useEffect(() => {
    if (params.search !== undefined) {
      setSearchQuery(params.search || '');
      setShowSearchResults(Boolean(params.search));
    }
  }, [params.search]);

  useEffect(() => {
    if (params.vendor_id) {
      const vId = Number(params.vendor_id);
      if (!isNaN(vId) && vId > 0) {
        setSelectedVendors([vId]);
      }
    }
    if (params.coupon_ids) {
      const cIds = params.coupon_ids.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      if (cIds.length > 0) setSelectedCouponIds(cIds);
    }
    if (params.category_ids) {
      const catIds = params.category_ids.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      if (catIds.length > 0) {
        setSelectedCategoryIds(catIds);
        setSelectedCategoryId(catIds[0]);
      }
    } else if (params.category_id) {
      const catId = Number(params.category_id);
      if (!isNaN(catId) && catId > 0) {
        setSelectedCategoryIds([catId]);
        setSelectedCategoryId(catId);
      }
    } else if (params.category && allListings.length > 0) {
      const found = allListings.find(item => String(item.category).toLowerCase() === String(params.category).toLowerCase());
      if (found && found.category_id) {
        setSelectedCategoryIds([Number(found.category_id)]);
        setSelectedCategoryId(Number(found.category_id));
        setSelectedCategory(params.category);
      }
    }
  }, [params.vendor_id, params.coupon_ids, params.category_ids, params.category_id, params.category, allListings.length]);

  // Main Filter Pipeline
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const priceRange = PRICE_RANGES.find(p => p.label === selectedPriceRange) || PRICE_RANGES[0];

    const filtered = allListings.filter(item => {
      // Category filter (multi-select or single)
      if (selectedCategoryIds.length > 0) {
        if (!selectedCategoryIds.includes(Number(item.category_id))) return false;
      } else if (selectedCategoryId > 0 && Number(item.category_id) !== Number(selectedCategoryId)) {
        return false;
      }

      // Vendor / Brand filter (multi-select)
      if (selectedVendors.length > 0 && !selectedVendors.includes(Number(item.vendor_id))) {
        return false;
      }

      // Targeted Coupon IDs
      if (selectedCouponIds.length > 0 && !selectedCouponIds.includes(Number(item.id))) {
        return false;
      }

      // Featured only
      if (featuredOnly && Number(item.priority) <= 0) {
        return false;
      }

      // Location / City
      if (selectedLocation !== 'All' && item.city !== selectedLocation) {
        return false;
      }

      // Rating
      if (selectedRating !== 'All') {
        const ratingThreshold = Number(selectedRating.replace('+', ''));
        const itemRating = HARDCODED_RATINGS[Number(item.id) % HARDCODED_RATINGS.length].rating;
        if (itemRating < ratingThreshold) return false;
      }

      // Price Range
      const itemPrice = Number(item.price) || 0;
      if (itemPrice < priceRange.min || itemPrice > priceRange.max) {
        return false;
      }

      // Search query
      if (query) {
        const match = [item.title, item.vendor_name, item.category, item.type, item.description, item.coupon_code]
          .some(val => String(val || '').toLowerCase().includes(query));
        if (!match) return false;
      }

      return true;
    });

    const dateValue = (value: string, fallback: number) => {
      const time = Date.parse(value);
      return Number.isFinite(time) ? time : fallback;
    };

    if (sortBy === 'Newest') filtered.sort((a, b) => dateValue(b.created_at, 0) - dateValue(a.created_at, 0));
    else if (sortBy === 'Expiring Soon') filtered.sort((a, b) => dateValue(a.expiry, Infinity) - dateValue(b.expiry, Infinity));
    else if (sortBy === 'Title A-Z') filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sortBy === 'Price High-Low') filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    else if (sortBy === 'Price Low-High') filtered.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    else if (sortBy === 'Rating High-Low') {
      filtered.sort((a, b) => {
        const rA = HARDCODED_RATINGS[Number(a.id) % HARDCODED_RATINGS.length].rating;
        const rB = HARDCODED_RATINGS[Number(b.id) % HARDCODED_RATINGS.length].rating;
        return rB - rA;
      });
    }

    setListings(filtered);
    setSearchResults(filtered);
  }, [allListings, searchQuery, selectedCategoryIds, selectedCategoryId, selectedVendors, selectedCouponIds, featuredOnly, sortBy, selectedLocation, selectedRating, selectedPriceRange]);

  const activeFiltersCount = (
    (sortBy !== 'Default' ? 1 : 0) +
    (selectedPriceRange !== 'All' ? 1 : 0) +
    selectedVendors.length +
    selectedCategoryIds.length +
    (selectedRating !== 'All' ? 1 : 0) +
    (selectedLocation !== 'All' ? 1 : 0) +
    (featuredOnly ? 1 : 0)
  );

  const resetFilters = () => {
    setSelectedCategory('All');
    setSelectedCategoryId(0);
    setSelectedCategoryIds([]);
    setSelectedVendors([]);
    setSelectedCouponIds([]);
    setSearchQuery('');
    setShowSearchResults(false);
    setFeaturedOnly(false);
    setSortBy('Default');
    setSelectedLocation('All');
    setSelectedRating('All');
    setSelectedPriceRange('All');
  };

  const toggleVendorFilter = (vId: number) => {
    setSelectedVendors(prev => {
      if (prev.includes(vId)) return prev.filter(id => id !== vId);
      return [...prev, vId];
    });
  };

  const toggleCategoryMultiFilter = (catId: number) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(catId)) return prev.filter(id => id !== catId);
      return [...prev, catId];
    });
  };

  useEffect(() => {
    fetchData();
    fetchCartItems();
    return subscribeCartChanges(fetchCartItems);
  }, []);

  const fetchCartItems = async () => {
    try {
      const items = await readCart();
      setCartItems(new Set(items.map((item) => item.listing_id)));
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const refreshCartCount = async () => {
    try {
      const items = await readCart();
      await AsyncStorage.setItem('cartCount', String(items.reduce((sum, item) => sum + item.quantity, 0)));
    } catch (error) {
      console.error('Error refreshing cart count:', error);
    }
  };

  const addToCart = async (coupon: any) => {
    if (addingRef.current) return;
    addingRef.current = true;
    setAddingToCart(coupon.id);
    try {
      await addCartItem({
        id: coupon.id,
        listing_id: coupon.id,
        title: coupon.title,
        price: coupon.price,
        image_url: coupon.image,
        quantity: 1,
        vendor_id: coupon.vendor_id,
        vendor_name: coupon.vendor_name,
        category: coupon.category,
      }, params.ad_id ? Number(params.ad_id) : undefined);
      const updatedCart = await readCart();
      setCartItems(new Set(updatedCart.map((item: any) => item.listing_id)));
      await AsyncStorage.setItem('cartCount', String(updatedCart.reduce((sum: number, item: any) => sum + item.quantity, 0)));
      setCartMessage(`Added "${coupon.title}" to cart!`);
      setTimeout(() => setCartMessage(''), 3000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      setCartMessage('Failed to add coupon to cart.');
    } finally {
      setAddingToCart(null);
      addingRef.current = false;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCategories(), fetchCoupons(), fetchNewlyAdded()]);
    } catch (error) {
      console.error('Error fetching listings screen data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || data.categories || []);
      }
    } catch (error) { console.error('Error fetching categories:', error); }
  };

  const fetchCoupons = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coupons`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          const activeCoupons = (data.data || []).filter(isApprovedCoupon);
          setAllListings(activeCoupons.map(mapCouponToListing));
        }
      }
    } catch (error) { console.error('Error fetching coupons:', error); }
  };

  const fetchNewlyAdded = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coupons`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          const sorted = [...(data.data || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setNewlyAdded(sorted.filter(isApprovedCoupon).slice(0, 5).map(mapCouponToListing));
        }
      }
    } catch (error) { console.error('Error fetching newly added:', error); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await fetchCartItems();
    await refreshCartCount();
    setRefreshing(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setShowSearchResults(text.trim().length > 0);
  };
  const clearSearch = () => handleSearch('');

  const handleCategoryFilter = (categoryId: number, categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedCategoryId(categoryId);
    if (categoryId === 0) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds([categoryId]);
    }
  };

  const getCategoriesList = () => {
    const categoryList = [{ name: 'All', id: 0, icon: 'grid', library: 'Ionicons', image_url: null }];
    const addedIds = new Set([0]);
    const flattenCategories = (cats: any[]) => {
      cats.forEach((cat) => {
        if (cat.id && !addedIds.has(cat.id)) {
          addedIds.add(cat.id);
          const iconInfo = getCategoryIcon(cat.category_name);
          categoryList.push({
            name: cat.category_name,
            id: cat.id,
            icon: iconInfo.icon,
            library: iconInfo.library,
            image_url: cat.image_url || cat.image || cat.icon || null,
          });
        }
        if (cat.sub_divisions && Array.isArray(cat.sub_divisions)) flattenCategories(cat.sub_divisions);
      });
    };
    flattenCategories(categories);
    return categoryList;
  };

  const displayCategories = getCategoriesList();
  const visibleCategories = displayCategories.slice(0, visibleCategoryCount);
  const hasMoreCategories = displayCategories.length > visibleCategoryCount;

  const handleMoreCategories = () => {
    if (hasMoreCategories) setVisibleCategoryCount(prev => Math.min(prev + CATEGORY_VISIBLE_COUNT, displayCategories.length));
    else setVisibleCategoryCount(CATEGORY_VISIBLE_COUNT);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading coupons...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeMapIndex = selectedMapMarker ?? 0;
  const activeMapListing = listings[activeMapIndex % Math.max(listings.length, 1)];

  return (
    <SafeAreaView style={styles.safeArea}>
      <WishlistNotice error={wishlist.error} needsLogin={wishlist.needsLogin} retry={wishlist.refresh} />
      {!!cartMessage && (
        <View accessibilityLiveRegion="polite" style={styles.cartMessage}>
          <Text style={styles.cartMessageText}>{cartMessage}</Text>
          <TouchableOpacity onPress={() => setCartMessage('')} accessibilityLabel="Dismiss cart message">
            <Text style={styles.cartMessageDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ============================================================== */}
      {/* COMPREHENSIVE E-COMMERCE FILTER MODAL (AMAZON / MYNTRA STYLE) */}
      {/* ============================================================== */}
      <Modal
        visible={isFilterModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <SafeAreaView style={styles.filterModalContainer}>
          {/* Modal Header */}
          <View style={styles.filterModalHeader}>
            <TouchableOpacity onPress={() => setIsFilterModalOpen(false)} style={{ padding: 6 }}>
              <Ionicons name="close" size={24} color="#1C1C1E" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.filterModalHeaderTitle}>Filters</Text>
              {activeFiltersCount > 0 && (
                <View style={styles.filterActiveCountBadge}>
                  <Text style={styles.filterActiveCountText}>{activeFiltersCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={resetFilters} style={{ padding: 6 }}>
              <Text style={styles.filterResetAllText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          {/* 2-Column Body */}
          <View style={styles.filterModalBody}>
            {/* Left Column: Categories */}
            <View style={styles.filterLeftSidebar}>
              <TouchableOpacity
                style={[styles.filterSidebarTab, activeFilterTab === 'sort' && styles.filterSidebarTabActive]}
                onPress={() => setActiveFilterTab('sort')}
              >
                <Text style={[styles.filterSidebarTabText, activeFilterTab === 'sort' && styles.filterSidebarTabTextActive]}>
                  Sort By
                </Text>
                {sortBy !== 'Default' && <View style={styles.filterTabDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterSidebarTab, activeFilterTab === 'price' && styles.filterSidebarTabActive]}
                onPress={() => setActiveFilterTab('price')}
              >
                <Text style={[styles.filterSidebarTabText, activeFilterTab === 'price' && styles.filterSidebarTabTextActive]}>
                  Price
                </Text>
                {selectedPriceRange !== 'All' && <View style={styles.filterTabDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterSidebarTab, activeFilterTab === 'vendor' && styles.filterSidebarTabActive]}
                onPress={() => setActiveFilterTab('vendor')}
              >
                <Text style={[styles.filterSidebarTabText, activeFilterTab === 'vendor' && styles.filterSidebarTabTextActive]}>
                  Brand / Vendor
                </Text>
                {selectedVendors.length > 0 && (
                  <View style={styles.filterTabBadge}>
                    <Text style={styles.filterTabBadgeText}>{selectedVendors.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterSidebarTab, activeFilterTab === 'category' && styles.filterSidebarTabActive]}
                onPress={() => setActiveFilterTab('category')}
              >
                <Text style={[styles.filterSidebarTabText, activeFilterTab === 'category' && styles.filterSidebarTabTextActive]}>
                  Category
                </Text>
                {selectedCategoryIds.length > 0 && (
                  <View style={styles.filterTabBadge}>
                    <Text style={styles.filterTabBadgeText}>{selectedCategoryIds.length}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterSidebarTab, activeFilterTab === 'rating' && styles.filterSidebarTabActive]}
                onPress={() => setActiveFilterTab('rating')}
              >
                <Text style={[styles.filterSidebarTabText, activeFilterTab === 'rating' && styles.filterSidebarTabTextActive]}>
                  Rating
                </Text>
                {selectedRating !== 'All' && <View style={styles.filterTabDot} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterSidebarTab, activeFilterTab === 'location' && styles.filterSidebarTabActive]}
                onPress={() => setActiveFilterTab('location')}
              >
                <Text style={[styles.filterSidebarTabText, activeFilterTab === 'location' && styles.filterSidebarTabTextActive]}>
                  Location
                </Text>
                {selectedLocation !== 'All' && <View style={styles.filterTabDot} />}
              </TouchableOpacity>
            </View>

            {/* Right Column: Option List */}
            <ScrollView style={styles.filterRightContent} showsVerticalScrollIndicator={false}>
              {/* SORT BY OPTIONS */}
              {activeFilterTab === 'sort' && (
                <View style={styles.filterOptionGroup}>
                  {SORT_OPTIONS.map(opt => {
                    const isSelected = sortBy === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={styles.filterOptionRow}
                        onPress={() => setSortBy(opt.value)}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#FF6B00' : '#8E8E93'}
                        />
                        <Text style={[styles.filterOptionLabel, isSelected && styles.filterOptionLabelActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* PRICE OPTIONS */}
              {activeFilterTab === 'price' && (
                <View style={styles.filterOptionGroup}>
                  {PRICE_RANGES.map(opt => {
                    const isSelected = selectedPriceRange === opt.label;
                    return (
                      <TouchableOpacity
                        key={opt.label}
                        style={styles.filterOptionRow}
                        onPress={() => setSelectedPriceRange(opt.label)}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#FF6B00' : '#8E8E93'}
                        />
                        <Text style={[styles.filterOptionLabel, isSelected && styles.filterOptionLabelActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* VENDOR / BRAND OPTIONS */}
              {activeFilterTab === 'vendor' && (
                <View style={styles.filterOptionGroup}>
                  <View style={styles.vendorSearchBox}>
                    <Ionicons name="search" size={16} color="#8E8E93" />
                    <TextInput
                      placeholder="Search brands / vendors..."
                      value={vendorSearch}
                      onChangeText={setVendorSearch}
                      style={styles.vendorSearchInput}
                      placeholderTextColor="#8E8E93"
                    />
                    {vendorSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setVendorSearch('')}>
                        <Ionicons name="close-circle" size={16} color="#8E8E93" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {vendorsList
                    .filter(v => !vendorSearch || v.name.toLowerCase().includes(vendorSearch.toLowerCase()))
                    .map(v => {
                      const isSelected = selectedVendors.includes(v.id);
                      const couponCount = allListings.filter(i => Number(i.vendor_id) === v.id).length;
                      return (
                        <TouchableOpacity
                          key={v.id}
                          style={styles.filterOptionRow}
                          onPress={() => toggleVendorFilter(v.id)}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSelected ? '#FF6B00' : '#8E8E93'}
                          />
                          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.filterOptionLabel, isSelected && styles.filterOptionLabelActive]}>
                              {v.name}
                            </Text>
                            <Text style={styles.filterOptionBadge}>{couponCount}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  {vendorsList.length === 0 && (
                    <Text style={styles.emptyFilterListText}>No vendors found</Text>
                  )}
                </View>
              )}

              {/* CATEGORY OPTIONS */}
              {activeFilterTab === 'category' && (
                <View style={styles.filterOptionGroup}>
                  {displayCategories
                    .filter(c => c.id !== 0)
                    .map(c => {
                      const isSelected = selectedCategoryIds.includes(c.id);
                      const count = allListings.filter(i => Number(i.category_id) === c.id).length;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.filterOptionRow}
                          onPress={() => toggleCategoryMultiFilter(c.id)}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSelected ? '#FF6B00' : '#8E8E93'}
                          />
                          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.filterOptionLabel, isSelected && styles.filterOptionLabelActive]}>
                              {c.name}
                            </Text>
                            <Text style={styles.filterOptionBadge}>{count}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              )}

              {/* RATING OPTIONS */}
              {activeFilterTab === 'rating' && (
                <View style={styles.filterOptionGroup}>
                  {RATING_OPTIONS.map(opt => {
                    const isSelected = selectedRating === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={styles.filterOptionRow}
                        onPress={() => setSelectedRating(opt.value)}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#FF6B00' : '#8E8E93'}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.filterOptionLabel, isSelected && styles.filterOptionLabelActive]}>
                            {opt.label}
                          </Text>
                          {opt.value !== 'All' && <Ionicons name="star" size={14} color="#F5A623" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* LOCATION OPTIONS */}
              {activeFilterTab === 'location' && (
                <View style={styles.filterOptionGroup}>
                  {locations.map(loc => {
                    const isSelected = selectedLocation === loc;
                    return (
                      <TouchableOpacity
                        key={loc}
                        style={styles.filterOptionRow}
                        onPress={() => setSelectedLocation(loc)}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={isSelected ? '#FF6B00' : '#8E8E93'}
                        />
                        <Text style={[styles.filterOptionLabel, isSelected && styles.filterOptionLabelActive]}>
                          {loc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          </View>

          {/* Modal Footer */}
          <View style={styles.filterModalFooter}>
            <TouchableOpacity
              style={styles.filterModalCloseBtn}
              onPress={() => setIsFilterModalOpen(false)}
            >
              <Text style={styles.filterModalCloseText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterModalApplyBtn}
              onPress={() => setIsFilterModalOpen(false)}
            >
              <Text style={styles.filterModalApplyText}>
                Apply Filters ({listings.length})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
          </TouchableOpacity>
          <Image source={require('../../assets/images/Roameo-logo.png')} style={styles.headerLogo} resizeMode="contain" />
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="#000" />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B00']} />}
      >
        {/* Search + Filters Button */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search restaurants, spa, hotels & more..."
              style={styles.searchInput}
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
            onPress={() => setIsFilterModalOpen(true)}
          >
            <Ionicons name="options-outline" size={16} color={activeFiltersCount > 0 ? '#fff' : '#FF6B00'} />
            <Text style={[styles.filterButtonText, activeFiltersCount > 0 && { color: '#fff' }]}>
              Filters{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchResultInfo}>
            <Text style={styles.searchResultInfoText}>
              Found {searchResults.length} result{searchResults.length > 1 ? 's' : ''} for "{searchQuery}"
            </Text>
          </View>
        )}
        {showSearchResults && searchResults.length === 0 && searchQuery.length > 0 && (
          <View style={styles.searchResultInfo}>
            <Text style={styles.searchResultInfoText}>No results found for "{searchQuery}"</Text>
          </View>
        )}

        {/* Categories Bar */}
        {displayCategories.length > 1 && !showSearchResults && (
          <View style={styles.categoriesRow}>
            {visibleCategories.map((cat, idx) => {
              const categoryImageUrl = getImageUrl(cat.image_url);
              const isActive = (cat.id === 0 && selectedCategoryIds.length === 0) || selectedCategoryIds.includes(cat.id);
              return (
                <TouchableOpacity key={idx} style={styles.categoryItem} onPress={() => handleCategoryFilter(cat.id, cat.name)}>
                  <View style={[styles.categoryIconBox, isActive && styles.categoryIconBoxActive]}>
                    {categoryImageUrl ? (
                      <Image source={{ uri: categoryImageUrl }} style={styles.categoryImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.categoryImagePlaceholder}>
                        {cat.library === 'FontAwesome5' && (
                          <FontAwesome5 name={cat.icon} size={20} color={isActive ? '#FF6B00' : '#6C6C70'} />
                        )}
                        {cat.library === 'MaterialCommunityIcons' && (
                          <MaterialCommunityIcons name={cat.icon as any} size={24} color={isActive ? '#FF6B00' : '#6C6C70'} />
                        )}
                        {cat.library === 'Ionicons' && (
                          <Ionicons name={cat.icon as any} size={22} color={isActive ? '#FF6B00' : '#6C6C70'} />
                        )}
                      </View>
                    )}
                  </View>
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {(hasMoreCategories || visibleCategoryCount > CATEGORY_VISIBLE_COUNT) && (
              <TouchableOpacity style={styles.categoryItem} onPress={handleMoreCategories}>
                <View style={styles.categoryIconBox}>
                  <View style={styles.categoryImagePlaceholder}>
                    <Ionicons name="grid-outline" size={22} color="#6C6C70" />
                  </View>
                </View>
                <Text style={styles.categoryText} numberOfLines={1}>More</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Horizontal Quick Filter Chips */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {/* Sort Chip */}
            <TouchableOpacity
              style={[styles.filterChip, sortBy !== 'Default' && styles.filterChipSelected]}
              onPress={() => { setActiveFilterTab('sort'); setIsFilterModalOpen(true); }}
            >
              <Text style={styles.filterChipLabel}>Sort By</Text>
              <Text style={[styles.filterChipValue, sortBy !== 'Default' && { color: '#FF6B00' }]}>
                {sortBy} <Ionicons name="chevron-down" size={11} color={sortBy !== 'Default' ? '#FF6B00' : '#1C1C1E'} />
              </Text>
            </TouchableOpacity>

            {/* Price Chip */}
            <TouchableOpacity
              style={[styles.filterChip, selectedPriceRange !== 'All' && styles.filterChipSelected]}
              onPress={() => { setActiveFilterTab('price'); setIsFilterModalOpen(true); }}
            >
              <Text style={styles.filterChipLabel}>Price</Text>
              <Text style={[styles.filterChipValue, selectedPriceRange !== 'All' && { color: '#FF6B00' }]}>
                {selectedPriceRange} <Ionicons name="chevron-down" size={11} color={selectedPriceRange !== 'All' ? '#FF6B00' : '#1C1C1E'} />
              </Text>
            </TouchableOpacity>

            {/* Brands / Vendors Chip */}
            <TouchableOpacity
              style={[styles.filterChip, selectedVendors.length > 0 && styles.filterChipSelected]}
              onPress={() => { setActiveFilterTab('vendor'); setIsFilterModalOpen(true); }}
            >
              <Text style={styles.filterChipLabel}>Brand</Text>
              <Text style={[styles.filterChipValue, selectedVendors.length > 0 && { color: '#FF6B00' }]}>
                {selectedVendors.length > 0 ? `${selectedVendors.length} selected` : 'All'}{' '}
                <Ionicons name="chevron-down" size={11} color={selectedVendors.length > 0 ? '#FF6B00' : '#1C1C1E'} />
              </Text>
            </TouchableOpacity>

            {/* Rating Chip */}
            <TouchableOpacity
              style={[styles.filterChip, selectedRating !== 'All' && styles.filterChipSelected]}
              onPress={() => { setActiveFilterTab('rating'); setIsFilterModalOpen(true); }}
            >
              <Text style={styles.filterChipLabel}>Rating</Text>
              <Text style={[styles.filterChipValue, selectedRating !== 'All' && { color: '#FF6B00' }]}>
                {selectedRating} <Ionicons name="chevron-down" size={11} color={selectedRating !== 'All' ? '#FF6B00' : '#1C1C1E'} />
              </Text>
            </TouchableOpacity>

            {/* Location Chip */}
            <TouchableOpacity
              style={[styles.filterChip, selectedLocation !== 'All' && styles.filterChipSelected]}
              onPress={() => { setActiveFilterTab('location'); setIsFilterModalOpen(true); }}
            >
              <Text style={styles.filterChipLabel}>Location</Text>
              <Text style={[styles.filterChipValue, selectedLocation !== 'All' && { color: '#FF6B00' }]}>
                {selectedLocation} <Ionicons name="chevron-down" size={11} color={selectedLocation !== 'All' ? '#FF6B00' : '#1C1C1E'} />
              </Text>
            </TouchableOpacity>

            {/* Clear All Chip */}
            {activeFiltersCount > 0 && (
              <TouchableOpacity style={styles.filterClearChip} onPress={resetFilters}>
                <Ionicons name="refresh-outline" size={14} color="#FF6B00" />
                <Text style={styles.filterClearChipText}>Reset</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Results header + view toggle */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>{listings.length} Results Found</Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list-outline" size={16} color={viewMode === 'list' ? '#FF6B00' : '#8E8E93'} />
              <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons name="map-outline" size={16} color={viewMode === 'map' ? '#FF6B00' : '#8E8E93'} />
              <Text style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}>Map View</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================== MAP VIEW ============================== */}
        {viewMode === 'map' && (
          <View style={styles.mapWrapper}>
            <View style={styles.mapImage}>
              <MapView
                provider="google"
                style={{ flex: 1 }}
                initialRegion={(() => {
                  if (listings.length === 0) return { latitude: 22.5726, longitude: 88.3639, latitudeDelta: 0.05, longitudeDelta: 0.05 };
                  const validItem = listings.find(i => i.latitude && i.longitude);
                  return {
                    latitude: Number(validItem?.latitude) || 22.5726,
                    longitude: Number(validItem?.longitude) || 88.3639,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  };
                })()}
              >
                {listings.map((item, index) => {
                  const lat = Number(item.latitude);
                  const lng = Number(item.longitude);
                  if (isNaN(lat) || isNaN(lng)) return null;
                  const isActive = index === activeMapIndex;
                  return (
                    <Marker
                      key={item.id}
                      coordinate={{ latitude: lat, longitude: lng }}
                      onPress={() => setSelectedMapMarker(index)}
                      pinColor={isActive ? '#C1121F' : '#FF3B30'}
                    >
                      <Callout
                        tooltip
                        onPress={() =>
                          router.push({ pathname: '/listing-details', params: { id: String(item.id), ad_id: params.ad_id ? String(params.ad_id) : undefined } })
                        }
                      >
                        <View style={styles.mapCalloutContainer}>
                          <Text style={styles.mapCalloutTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.mapCalloutSubtitle} numberOfLines={1}>{item.category} • {formatCouponPrice(item.price)}</Text>
                          <Text style={styles.mapCalloutTap}>Tap to view offer</Text>
                        </View>
                      </Callout>
                    </Marker>
                  );
                })}
              </MapView>

              <TouchableOpacity style={styles.mapLayersBtn}>
                <Ionicons name="layers-outline" size={16} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            {activeMapListing && (
              <TouchableOpacity
                style={styles.mapPreviewCard}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({ pathname: '/listing-details', params: { id: String(activeMapListing.id), ad_id: params.ad_id ? String(params.ad_id) : undefined } })
                }
              >
                <Image
                  source={
                    activeMapListing.image
                      ? { uri: activeMapListing.image }
                      : require('../../assets/images/Roameo-logo.png')
                  }
                  style={styles.mapPreviewImage}
                  resizeMode="cover"
                />
                <View style={styles.mapPreviewBody}>
                  <View style={styles.mapPreviewTitleRow}>
                    <Text style={styles.mapPreviewTitle} numberOfLines={1}>
                      {activeMapListing.title}
                    </Text>
                    <View style={[styles.statusBadge, activeMapListing.status?.toLowerCase() === 'open' ? styles.openBadge : styles.closedBadge]}>
                      <Text style={[styles.statusText, activeMapListing.status?.toLowerCase() === 'open' ? styles.openText : styles.closedText]}>
                        {activeMapListing.status || 'Open'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.mapPreviewSub} numberOfLines={1}>
                    {activeMapListing.category} • {activeMapListing.city || 'Downtown'}
                  </Text>
                  <View style={styles.mapPreviewMetaRow}>
                    <Ionicons name="star" size={12} color="#F5A623" />
                    <Text style={styles.mapPreviewRating}>
                      {HARDCODED_RATINGS[activeMapIndex % HARDCODED_RATINGS.length].rating.toFixed(1)}
                    </Text>
                    <Text style={styles.mapPreviewReviews}>
                      ({HARDCODED_RATINGS[activeMapIndex % HARDCODED_RATINGS.length].reviews} reviews)
                    </Text>
                    <Text style={styles.mapPreviewPrice}>{formatCouponPrice(activeMapListing.price)}</Text>
                  </View>
                  <View style={styles.mapPreviewActions}>
                    <TouchableOpacity
                      style={styles.mapPreviewDetailsBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: '/listing-details', params: { id: String(activeMapListing.id), ad_id: params.ad_id ? String(params.ad_id) : undefined } });
                      }}
                    >
                      <Ionicons name="eye-outline" size={13} color="#FF6B00" />
                      <Text style={styles.mapPreviewDetailsText}>View Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.mapPreviewCartBtn, cartItems.has(activeMapListing.id) && styles.cartButtonAdded]}
                      onPress={(e) => {
                        e.stopPropagation();
                        void addToCart(activeMapListing);
                      }}
                      disabled={addingToCart === activeMapListing.id || cartItems.has(activeMapListing.id)}
                    >
                      {addingToCart === activeMapListing.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons
                            name={cartItems.has(activeMapListing.id) ? 'checkmark-circle' : 'cart-outline'}
                            size={13}
                            color="#FFF"
                          />
                          <Text style={styles.mapPreviewCartText}>
                            {cartItems.has(activeMapListing.id) ? 'Added' : 'Add to Cart'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            <Text style={styles.mapNearbyTitle}>Nearby Places</Text>
            {listings.slice(0, 6).map((item, index) => {
              const ratingInfo = HARDCODED_RATINGS[index % HARDCODED_RATINGS.length];
              const distance = HARDCODED_DISTANCES[index % HARDCODED_DISTANCES.length];
              const isActive = index === activeMapIndex;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.mapNearbyCard, isActive && styles.mapNearbyCardActive]}
                  onPress={() => setSelectedMapMarker(index)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={item.image ? { uri: item.image } : require('../../assets/images/Roameo-logo.png')}
                    style={styles.mapNearbyImage}
                    resizeMode="cover"
                  />
                  <View style={styles.mapNearbyBody}>
                    <View style={styles.mapNearbyTitleRow}>
                      <Text style={styles.mapNearbyName} numberOfLines={1}>{item.title}</Text>
                      <View style={[styles.statusBadge, item.status?.toLowerCase() === 'open' ? styles.openBadge : styles.closedBadge]}>
                        <Text style={[styles.statusText, item.status?.toLowerCase() === 'open' ? styles.openText : styles.closedText]}>
                          {item.status || 'Open'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.mapNearbySub} numberOfLines={1}>
                      {item.category} • {item.city || 'Downtown'}
                    </Text>
                    <View style={styles.mapNearbyMeta}>
                      <Ionicons name="star" size={11} color="#F5A623" />
                      <Text style={styles.mapNearbyRating}>{ratingInfo.rating.toFixed(1)}</Text>
                      <Text style={styles.mapNearbyReviews}>({ratingInfo.reviews})</Text>
                      <Text style={styles.mapNearbyDot}>•</Text>
                      <Text style={styles.mapNearbyDistance}>{distance}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ============================== LIST VIEW ============================== */}
        {viewMode === 'list' &&
          listings.map((item, index) => {
            const ratingInfo = HARDCODED_RATINGS[Number(item.id) % HARDCODED_RATINGS.length];
            const distance = HARDCODED_DISTANCES[Number(item.id) % HARDCODED_DISTANCES.length];
            const discount = HARDCODED_DISCOUNTS[Number(item.id) % HARDCODED_DISCOUNTS.length];

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.listingCard}
                onPress={() => router.push({ pathname: '/listing-details', params: { id: String(item.id), ad_id: params.ad_id ? String(params.ad_id) : undefined } })}
                activeOpacity={0.9}
              >
                {/* LEFT: Image */}
                <View style={styles.imageContainer}>
                  <Image
                    source={
                      item.image
                        ? { uri: item.image }
                        : require('../../assets/images/Roameo-logo.png')
                    }
                    style={styles.listingImage}
                    resizeMode="cover"
                  />
                  <View style={styles.discountTag}>
                    <Text style={styles.discountTagText}>{discount}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.loveButton}
                    accessibilityRole="button"
                    accessibilityLabel={`${wishlist.isSaved(item.id) ? 'Remove' : 'Save'} ${item.title} ${wishlist.isSaved(item.id) ? 'from' : 'to'} wishlist`}
                    accessibilityState={{ selected: wishlist.isSaved(item.id) }}
                    disabled={wishlist.loading || wishlist.pending !== null || !wishlist.ready}
                    onPress={event => { event.stopPropagation(); void wishlist.toggle(Number(item.id)); }}
                  >
                    <Ionicons
                      name={wishlist.isSaved(item.id) ? 'heart' : 'heart-outline'}
                      size={16}
                      color={wishlist.isSaved(item.id) ? '#FF6B00' : '#fff'}
                    />
                  </TouchableOpacity>
                </View>

                {/* RIGHT: content */}
                <View style={styles.listingContent}>
                  <View style={styles.titleRow}>
                    <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
                    <Ionicons name="checkmark-circle" size={14} color="#FF6B00" />
                    <View style={[styles.statusBadge, item.status?.toLowerCase() === 'open' ? styles.openBadge : styles.closedBadge]}>
                      <Text style={[styles.statusText, item.status?.toLowerCase() === 'open' ? styles.openText : styles.closedText]}>
                        {item.status || 'Open'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.listingType} numberOfLines={1}>
                    {item.category || 'Uncategorized'} • {item.vendor_name ? `${item.vendor_name} • ` : ''}{item.city || 'Downtown'}
                  </Text>

                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F5A623" />
                    <Text style={styles.ratingText}>
                      {ratingInfo.rating.toFixed(1)}
                      <Text style={styles.ratingReviews}> ({ratingInfo.reviews} reviews)</Text>
                    </Text>
                    <Text style={styles.ratingPrice}> • {formatCouponPrice(item.price)}</Text>
                  </View>

                  <View style={styles.distanceRow}>
                    <Ionicons name="location-outline" size={12} color="#8E8E93" />
                    <Text style={styles.distanceText}>{distance}</Text>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.detailsButton}
                      onPress={event => {
                        event.stopPropagation();
                        router.push({ pathname: '/listing-details', params: { id: String(item.id), ad_id: params.ad_id ? String(params.ad_id) : undefined } });
                      }}
                    >
                      <Ionicons name="eye-outline" size={12} color="#FF6B00" />
                      <Text style={styles.detailsButtonText}>View Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cartButton, cartItems.has(item.id) && styles.cartButtonAdded]}
                      onPress={event => { event.stopPropagation(); void addToCart(item); }}
                      disabled={addingToCart === item.id || cartItems.has(item.id)}
                    >
                      {addingToCart === item.id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons
                            name={cartItems.has(item.id) ? 'checkmark-circle' : 'cart-outline'}
                            size={12}
                            color="#FFF"
                          />
                          <Text style={styles.cartButtonText}>
                            {cartItems.has(item.id) ? 'Added' : 'Add to Cart'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

        {viewMode === 'list' && listings.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#D1D1D6" />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySubtitle}>Try adjusting your search or filters</Text>
            <TouchableOpacity style={styles.emptyResetBtn} onPress={resetFilters}>
              <Text style={styles.emptyResetBtnText}>Reset All Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.suggestContainer}>
          <Text style={styles.suggestText}>Can't find what you're looking for?</Text>
          <TouchableOpacity style={styles.suggestButton}>
            <Text style={styles.suggestLink}>Suggest a Place</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#8E8E93', fontSize: 14 },
  cartMessage: { padding: 12, backgroundColor: '#FFF3E8' },
  cartMessageText: { color: '#713500' },
  cartMessageDismiss: { color: '#713500', marginTop: 6 },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  backButton: { padding: 4 },
  headerLogo: { width: 150, height: 52 },
  notificationButton: { padding: 4, position: 'relative' },
  notificationDot: {
    position: 'absolute', top: 4, right: 5, width: 8, height: 8,
    borderRadius: 4, backgroundColor: '#FF6B00',
  },

  // Search
  searchRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 14 },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F2F2F7', borderRadius: 22,
    paddingHorizontal: 14, height: 44, marginRight: 10, position: 'relative',
  },
  searchInput: { flex: 1, fontSize: 13, color: '#000', paddingRight: 30 },
  clearButton: { position: 'absolute', right: 14, padding: 2 },
  filterButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: '#FF6B00', backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  filterButtonText: { color: '#FF6B00', fontWeight: '700', fontSize: 13 },

  searchResultInfo: { paddingHorizontal: 16, paddingBottom: 12 },
  searchResultInfoText: { fontSize: 13, color: '#8E8E93' },

  // Categories
  categoriesRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, marginBottom: 12,
  },
  categoryItem: { width: (width - 24) / 5, alignItems: 'center', marginBottom: 12 },
  categoryIconBox: {
    width: 54, height: 54, borderRadius: 12,
    backgroundColor: '#F8F8FA',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E5EA',
    marginBottom: 6, overflow: 'hidden',
  },
  categoryIconBoxActive: { backgroundColor: '#FFF5EE', borderColor: '#FF6B00' },
  categoryImage: { width: '100%', height: '100%' },
  categoryImagePlaceholder: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8F8FA',
  },
  categoryText: { fontSize: 10, color: '#6C6C70', fontWeight: '500', textAlign: 'center' },
  categoryTextActive: { color: '#FF6B00' },

  // Filter chips
  filterContainer: { paddingHorizontal: 16, marginBottom: 12 },
  filterScroll: { paddingRight: 16, alignItems: 'center' },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, marginRight: 8,
    borderWidth: 1, borderColor: '#E5E5EA',
    minWidth: 90,
  },
  filterChipSelected: {
    borderColor: '#FF6B00',
    backgroundColor: '#FFF8F2',
  },
  filterChipLabel: { fontSize: 10, color: '#8E8E93' },
  filterChipValue: { fontSize: 12, color: '#1C1C1E', fontWeight: '700', marginTop: 2 },
  filterClearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  filterClearChipText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '700',
  },

  // Results header
  resultsHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
  },
  resultsCount: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  viewToggle: { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 20, padding: 3 },
  viewToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
  },
  viewToggleBtnActive: { backgroundColor: '#FFFFFF' },
  viewToggleText: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  viewToggleTextActive: { color: '#FF6B00' },

  // MAP VIEW
  mapWrapper: { paddingHorizontal: 16, marginBottom: 12 },
  mapImage: {
    height: 280,
    borderRadius: 14,
    backgroundColor: '#E4EDDD',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D0DCC5',
  },
  mapLayersBtn: {
    position: 'absolute', bottom: 12, right: 10,
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E5EA',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  mapCalloutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    width: 160,
  },
  mapCalloutTitle: { fontSize: 12, fontWeight: '700', color: '#1C1C1E' },
  mapCalloutSubtitle: { fontSize: 10, color: '#8E8E93', marginTop: 2 },
  mapCalloutTap: { fontSize: 9, color: '#FF6B00', fontWeight: '600', marginTop: 4 },

  mapPreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#F2F2F7',
    overflow: 'hidden', padding: 10, gap: 10,
  },
  mapPreviewImage: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#F2F2F7' },
  mapPreviewBody: { flex: 1, justifyContent: 'space-between' },
  mapPreviewTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapPreviewTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', flexShrink: 1 },
  mapPreviewSub: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  mapPreviewMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  mapPreviewRating: { fontSize: 12, fontWeight: '700', color: '#1C1C1E', marginLeft: 3 },
  mapPreviewReviews: { fontSize: 11, color: '#8E8E93' },
  mapPreviewPrice: { fontSize: 12, fontWeight: '700', color: '#FF6B00', marginLeft: 'auto' },
  mapPreviewActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  mapPreviewDetailsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, flex: 1,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FF6B00',
    paddingVertical: 7, borderRadius: 6,
  },
  mapPreviewDetailsText: { color: '#FF6B00', fontSize: 11, fontWeight: '700' },
  mapPreviewCartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, flex: 1,
    backgroundColor: '#FF6B00',
    paddingVertical: 7, borderRadius: 6,
  },
  mapPreviewCartText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  mapNearbyTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginTop: 16, marginBottom: 8 },
  mapNearbyCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
    gap: 10,
  },
  mapNearbyCardActive: { backgroundColor: '#FFF9F2' },
  mapNearbyImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#F2F2F7' },
  mapNearbyBody: { flex: 1 },
  mapNearbyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mapNearbyName: { fontSize: 13, fontWeight: '700', color: '#1C1C1E', flexShrink: 1 },
  mapNearbySub: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  mapNearbyMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 },
  mapNearbyRating: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', marginLeft: 3 },
  mapNearbyReviews: { fontSize: 10, color: '#8E8E93' },
  mapNearbyDot: { fontSize: 10, color: '#8E8E93' },
  mapNearbyDistance: { fontSize: 10, color: '#8E8E93' },

  // LIST VIEW
  listingCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    alignItems: 'flex-start',
  },
  imageContainer: { position: 'relative', width: LIST_IMAGE_WIDTH },
  listingImage: {
    width: LIST_IMAGE_WIDTH,
    height: LIST_IMAGE_HEIGHT,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  discountTag: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: '#FF6B00', paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 4,
  },
  discountTagText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  loveButton: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
  },
  listingContent: { flex: 1, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listingTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', flexShrink: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 'auto' },
  openBadge: { backgroundColor: '#E8F5E9' },
  closedBadge: { backgroundColor: '#FFEBEE' },
  statusText: { fontSize: 9, fontWeight: '700' },
  openText: { color: '#2E7D32' },
  closedText: { color: '#C62828' },
  listingType: { fontSize: 11, color: '#8E8E93', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { fontSize: 11, fontWeight: '700', color: '#1C1C1E', marginLeft: 3 },
  ratingReviews: { fontWeight: '400', color: '#8E8E93' },
  ratingPrice: { fontSize: 11, color: '#8E8E93', fontWeight: '600' },
  distanceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  distanceText: { fontSize: 11, color: '#8E8E93', marginLeft: 3 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  detailsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, flex: 1,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FF6B00',
    paddingVertical: 7, borderRadius: 6,
  },
  detailsButtonText: { color: '#FF6B00', fontSize: 11, fontWeight: '700' },
  cartButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, flex: 1,
    backgroundColor: '#FF6B00',
    paddingVertical: 7, borderRadius: 6,
  },
  cartButtonAdded: { backgroundColor: '#22C55E' },
  cartButtonText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  emptyResetBtn: {
    marginTop: 16,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyResetBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  suggestContainer: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16,
    marginBottom: 20, gap: 12,
  },
  suggestText: { fontSize: 13, color: '#1C1C1E', flex: 1 },
  suggestButton: {
    borderWidth: 1.5, borderColor: '#FF6B00',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 22,
    backgroundColor: '#FFFFFF',
  },
  suggestLink: { fontSize: 13, color: '#FF6B00', fontWeight: '700' },

  // ===================================
  // E-COMMERCE FILTER MODAL STYLES
  // ===================================
  filterModalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterModalHeaderTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  filterActiveCountBadge: {
    backgroundColor: '#FF6B00',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  filterActiveCountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  filterResetAllText: { color: '#FF6B00', fontWeight: '700', fontSize: 14 },

  filterModalBody: { flex: 1, flexDirection: 'row' },
  filterLeftSidebar: {
    width: '38%',
    backgroundColor: '#F8F8FA',
    borderRightWidth: 1,
    borderRightColor: '#E5E5EA',
  },
  filterSidebarTab: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterSidebarTabActive: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B00',
  },
  filterSidebarTabText: { fontSize: 13, color: '#6C6C70', fontWeight: '500' },
  filterSidebarTabTextActive: { color: '#FF6B00', fontWeight: '700' },
  filterTabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF6B00' },
  filterTabBadge: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  filterTabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  filterRightContent: { flex: 1, padding: 16 },
  filterOptionGroup: { paddingBottom: 20 },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  filterOptionLabel: { fontSize: 14, color: '#1C1C1E', flex: 1 },
  filterOptionLabelActive: { color: '#FF6B00', fontWeight: '700' },
  filterOptionBadge: { fontSize: 12, color: '#8E8E93', backgroundColor: '#F2F2F7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  emptyFilterListText: { color: '#8E8E93', fontSize: 13, fontStyle: 'italic', marginTop: 20, textAlign: 'center' },

  vendorSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 10,
    gap: 6,
  },
  vendorSearchInput: { flex: 1, fontSize: 13, color: '#000' },

  filterModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  filterModalCloseBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalCloseText: { color: '#1C1C1E', fontWeight: '700', fontSize: 14 },
  filterModalApplyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModalApplyText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
