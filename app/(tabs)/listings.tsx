// app/(tabs)/listings.tsx
import { WishlistNotice } from '../../components/WishlistNotice';
import { couponImageUrl, isApprovedCoupon } from '../../constants/couponMedia';
import { formatCouponPrice } from '../../constants/couponPrice';
import { useWishlist } from '../../hooks/useWishlist';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
const { width } = Dimensions.get('window');

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

const MOCK_MAP_MARKERS = [
  { id: 1, top: '18%', left: '28%' },
  { id: 2, top: '30%', left: '62%' },
  { id: 3, top: '46%', left: '22%' },
  { id: 4, top: '58%', left: '72%' },
  { id: 5, top: '38%', left: '46%' },
  { id: 6, top: '66%', left: '40%' },
  { id: 7, top: '24%', left: '50%' },
  { id: 8, top: '52%', left: '58%' },
];

// KEY LAYOUT VALUES:
// Image: ~38% of screen width, but SHORT height (~92px) so it looks like the screenshot
const LIST_IMAGE_WIDTH = Math.round(width * 0.38);
const LIST_IMAGE_HEIGHT = 92;

export default function ListingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; category?: string }>();
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
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number>(0);
  const [sortBy, setSortBy] = useState('Default');
  const [filterPanel, setFilterPanel] = useState<string | null>(null);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<Set<number>>(new Set());
  const [addingToCart, setAddingToCart] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedActivity, setSelectedActivity] = useState<string>('All');
  const [selectedRating, setSelectedRating] = useState<string>('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('All');
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
  const activityNames = ['Activities', 'Outdoor', 'Water Sports', 'Fitness', 'Yoga', 'Spa & Wellness', 'Massage'];
  const activities: string[] = ['All', ...new Set<string>(
    allListings
      .map(item => item.category)
      .filter((cat): cat is string => Boolean(cat) && activityNames.some(a => a.toLowerCase() === cat.toLowerCase()))
  )].sort();

  useEffect(() => {
    setSearchQuery(params.search || '');
    setShowSearchResults(Boolean(params.search));
  }, [params.search]);

  useEffect(() => {
    const category = allListings.find(item => item.category === params.category);
    setSelectedCategory(params.category || 'All');
    setSelectedCategoryId(category ? Number(category.category_id) : 0);
  }, [params.category, allListings]);

  const hasFeatured = allListings.some(item => Number(item.priority) > 0);

  const filterOptions = [
    { label: 'Sort By', value: sortBy, icon: 'chevron-down' },
    { label: 'Price', value: selectedPriceRange === 'All' ? 'All' : selectedPriceRange, icon: 'chevron-down' },
    ...(activities.length > 1 ? [{ label: 'Activities', value: selectedActivity === 'All' ? 'All' : selectedActivity, icon: 'chevron-down' }] : []),
    ...(locations.length > 1 ? [{ label: 'Location', value: selectedLocation === 'All' ? 'All' : selectedLocation, icon: 'chevron-down' }] : []),
    { label: 'Rating', value: selectedRating === 'All' ? 'All' : selectedRating, icon: 'chevron-down' },
    { label: 'More Filters', value: featuredOnly ? 'Featured' : '', icon: 'chevron-down' },
  ];

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const priceRange = PRICE_RANGES.find(p => p.label === selectedPriceRange) || PRICE_RANGES[0];
    const filtered = allListings.filter(item =>
      (!selectedCategoryId || Number(item.category_id) === Number(selectedCategoryId)) &&
      (!featuredOnly || Number(item.priority) > 0) &&
      (selectedActivity === 'All' || item.category === selectedActivity) &&
      (selectedLocation === 'All' || item.city === selectedLocation) &&
      (selectedRating === 'All' || (HARDCODED_RATINGS[Number(item.id) % HARDCODED_RATINGS.length].rating >= Number(selectedRating.replace('+', '')))) &&
      ((Number(item.price) || 0) >= priceRange.min && (Number(item.price) || 0) <= priceRange.max) &&
      (!query || [item.title, item.vendor_name, item.category, item.type, item.description, item.coupon_code]
        .some(value => String(value || '').toLowerCase().includes(query)))
    );
    const dateValue = (value: string, fallback: number) => {
      const time = Date.parse(value);
      return Number.isFinite(time) ? time : fallback;
    };
    if (sortBy === 'Newest') filtered.sort((a, b) => dateValue(b.created_at, 0) - dateValue(a.created_at, 0));
    if (sortBy === 'Expiring Soon') filtered.sort((a, b) => dateValue(a.expiry, Infinity) - dateValue(b.expiry, Infinity));
    if (sortBy === 'Title A-Z') filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'Price High-Low') filtered.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    if (sortBy === 'Price Low-High') filtered.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    setListings(filtered);
    setSearchResults(filtered);
  }, [allListings, searchQuery, selectedCategoryId, featuredOnly, sortBy, selectedActivity, selectedLocation, selectedRating, selectedPriceRange]);

  const resetFilters = () => {
    setSelectedCategory('All'); setSelectedCategoryId(0); setSearchQuery('');
    setShowSearchResults(false); setFeaturedOnly(false); setSortBy('Default');
    setSelectedActivity('All'); setSelectedLocation('All');
    setSelectedRating('All'); setSelectedPriceRange('All');
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
      console.error('Refresh cart count error:', error);
    }
  };

  const addToCart = async (item: any) => {
    if (addingRef.current) return;
    addingRef.current = true;
    const listingId = Number(item.id);
    setCartMessage('');
    setAddingToCart(listingId);
    try {
      if (cartItems.has(listingId)) {
        setCartMessage('This coupon is already in your cart. Change its quantity in Cart.');
        return;
      }
      const added = await addCartItem(item);
      if (!added) {
        setCartMessage('This coupon is already in your cart.');
        return;
      }
      setCartItems(previous => new Set(previous).add(listingId));
      setCartMessage(`Added "${item.title}" to your cart.`);
    } catch (error) {
      setCartMessage(error instanceof Error ? error.message : 'Unable to add coupon. Please try again.');
    } finally {
      addingRef.current = false;
      setAddingToCart(null);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchCoupons(), fetchNewlyAdded()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) setCategories(data.data);
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
    setSelectedCategory(categoryName); setSelectedCategoryId(categoryId);
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

      <Modal visible={filterPanel !== null} transparent animationType="fade" onRequestClose={() => setFilterPanel(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{filterPanel}</Text>
            <ScrollView>
              {(filterPanel === 'Sort By'
                ? ['Default', ...(allListings.some(i => i.created_at) ? ['Newest'] : []), ...(allListings.some(i => i.expiry) ? ['Expiring Soon'] : []), 'Title A-Z']
                : filterPanel === 'Price' ? PRICE_RANGES.map(p => p.label)
                : filterPanel === 'Activities' ? ['All', ...activities.filter(a => a !== 'All')]
                : filterPanel === 'Location' ? ['All', ...locations.filter(l => l !== 'All')]
                : filterPanel === 'Rating' ? ['All', '4.0+', '4.5+', '4.8+']
                : [...(hasFeatured ? ['Featured only', 'All coupons'] : []), 'Reset Filters']
              ).map(option => {
                const selected =
                  filterPanel === 'Sort By' ? sortBy === option
                  : filterPanel === 'Price' ? selectedPriceRange === option
                  : filterPanel === 'Activities' ? selectedActivity === option
                  : filterPanel === 'Location' ? selectedLocation === option
                  : filterPanel === 'Rating' ? selectedRating === option
                  : option === (featuredOnly ? 'Featured only' : 'All coupons');
                return (
                  <TouchableOpacity
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={styles.modalOption}
                    onPress={() => {
                      if (filterPanel === 'Sort By') setSortBy(option);
                      else if (filterPanel === 'Price') setSelectedPriceRange(option);
                      else if (filterPanel === 'Activities') setSelectedActivity(option);
                      else if (filterPanel === 'Location') setSelectedLocation(option);
                      else if (filterPanel === 'Rating') setSelectedRating(option);
                      else if (option === 'Reset Filters') resetFilters();
                      else setFeaturedOnly(option === 'Featured only');
                      setFilterPanel(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, selected && styles.modalOptionTextActive]}>
                      {option}{selected ? ' (selected)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setFilterPanel(null)} style={{ paddingTop: 16 }}>
              <Text style={{ color: '#FF6B00', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        {/* Search + Filters */}
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
          <TouchableOpacity style={styles.filterButton} onPress={() => setFilterPanel('More Filters')}>
            <Ionicons name="options-outline" size={16} color="#FF6B00" />
            <Text style={styles.filterButtonText}>Filters</Text>
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

        {/* Categories */}
        {displayCategories.length > 1 && !showSearchResults && (
          <View style={styles.categoriesRow}>
            {visibleCategories.map((cat, idx) => {
              const categoryImageUrl = getImageUrl(cat.image_url);
              const isActive = selectedCategoryId === cat.id;
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

        {/* Filter chips */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {filterOptions.map((filter, idx) => (
              <TouchableOpacity key={idx} style={styles.filterChip} onPress={() => setFilterPanel(filter.label)}>
                <View>
                  <Text style={styles.filterChipLabel}>{filter.label}</Text>
                  <Text style={styles.filterChipValue}>
                    {filter.value || 'All'} <Ionicons name={filter.icon as any} size={12} color="#1C1C1E" />
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
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
                  const lats = listings.map(l => l.latitude);
                  const lngs = listings.map(l => l.longitude);
                  const minLat = Math.min(...lats);
                  const maxLat = Math.max(...lats);
                  const minLng = Math.min(...lngs);
                  const maxLng = Math.max(...lngs);
                  const padLat = Math.max((maxLat - minLat) * 0.3, 0.01);
                  const padLng = Math.max((maxLng - minLng) * 0.3, 0.01);
                  return {
                    latitude: (minLat + maxLat) / 2,
                    longitude: (minLng + maxLng) / 2,
                    latitudeDelta: (maxLat - minLat) + padLat,
                    longitudeDelta: (maxLng - minLng) + padLng,
                  };
                })()}
              >
                  {listings.map((item, idx) => (
                    <Marker
                      key={item.id}
                      coordinate={{ latitude: item.latitude, longitude: item.longitude }}
                      onPress={() => setSelectedMapMarker(idx)}
                    >
                      <View style={[styles.mapMarkerPin, idx === activeMapIndex && styles.mapMarkerPinActive]}>
                        <Ionicons name="location" size={16} color="#FFFFFF" />
                      </View>
                      <Callout tooltip>
                        <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 8, width: 200, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4 }} numberOfLines={1}>{item.title}</Text>
                          <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }} numberOfLines={1}>{item.category} • {item.city}</Text>
                          <Text style={{ fontSize: 12, color: '#FF6B00', fontWeight: 'bold' }}>${item.price}</Text>
                        </View>
                      </Callout>
                    </Marker>
                  ))}
                </MapView>

              <View style={styles.mapSearchPill}>
                <Ionicons name="search" size={12} color="#1C1C1E" />
                <Text style={styles.mapSearchPillText}>Search this area</Text>
              </View>

              <View style={styles.mapTopPills}>
                <View style={styles.mapTopPill}><Ionicons name="pricetag-outline" size={11} color="#1C1C1E" /><Text style={styles.mapTopPillText}>Price</Text></View>
                <View style={styles.mapTopPill}><Ionicons name="star-outline" size={11} color="#1C1C1E" /><Text style={styles.mapTopPillText}>Rating</Text></View>
                <View style={styles.mapTopPill}><Ionicons name="time-outline" size={11} color="#1C1C1E" /><Text style={styles.mapTopPillText}>Hours</Text></View>
                <View style={styles.mapTopPill}><Ionicons name="options-outline" size={11} color="#1C1C1E" /><Text style={styles.mapTopPillText}>All filters</Text></View>
              </View>

              <TouchableOpacity style={styles.mapLayersBtn}>
                <Ionicons name="layers-outline" size={16} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            {activeMapListing && (
              <TouchableOpacity
                style={styles.mapPreviewCard}
                activeOpacity={0.9}
                onPress={() =>
                  router.push({ pathname: '/listing-details', params: { id: String(activeMapListing.id) } })
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
                        router.push({ pathname: '/listing-details', params: { id: String(activeMapListing.id) } });
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
                      <Ionicons name="checkmark-circle" size={13} color="#FF6B00" />
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
                  <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ============================== LIST VIEW ============================== */}
        {viewMode === 'list' &&
          listings.map((item, index) => {
            const discount = HARDCODED_DISCOUNTS[index % HARDCODED_DISCOUNTS.length];
            const ratingInfo = HARDCODED_RATINGS[index % HARDCODED_RATINGS.length];
            const distance = HARDCODED_DISTANCES[index % HARDCODED_DISTANCES.length];

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.listingCard}
                activeOpacity={0.9}
                onPress={() => router.push({ pathname: '/listing-details', params: { id: String(item.id) } })}
              >
                {/* LEFT: WIDE but SHORT image */}
                <View style={styles.imageContainer}>
                  <Image
                    source={item.image ? { uri: item.image } : require('../../assets/images/Roameo-logo.png')}
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
                    {item.category || 'Uncategorized'} • {item.city || 'Downtown'}
                  </Text>

                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#F5A623" />
                    <Text style={styles.ratingText}>
                      {ratingInfo.rating.toFixed(1)}
                      <Text style={styles.ratingReviews}> ({ratingInfo.reviews} reviews)</Text>
                    </Text>
                    <Text style={styles.ratingPrice}> • $$</Text>
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
                        router.push({ pathname: '/listing-details', params: { id: String(item.id) } });
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
  filterScroll: { paddingRight: 16 },
  filterChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, marginRight: 8,
    borderWidth: 1, borderColor: '#E5E5EA',
    minWidth: 100,
  },
  filterChipLabel: { fontSize: 10, color: '#8E8E93' },
  filterChipValue: { fontSize: 12, color: '#1C1C1E', fontWeight: '700', marginTop: 2 },

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
  mapBlock: { position: 'absolute', backgroundColor: '#D3DFC6', borderRadius: 6 },
  mapAreaLabel: { position: 'absolute', fontSize: 9, color: '#7A8B6C', fontWeight: '600' },
  mapMarker: { position: 'absolute' },
  mapMarkerPin: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#FF3B30',
    borderWidth: 2, borderColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  mapMarkerPinActive: { backgroundColor: '#C1121F', transform: [{ scale: 1.2 }] },
  mapSearchPill: {
    position: 'absolute', top: 12, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, borderWidth: 1, borderColor: '#E5E5EA',
  },
  mapSearchPillText: { fontSize: 11, fontWeight: '600', color: '#1C1C1E' },
  mapTopPills: {
    position: 'absolute', bottom: 10, left: 10, right: 10,
    flexDirection: 'row', gap: 6, flexWrap: 'wrap',
  },
  mapTopPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA',
  },
  mapTopPillText: { fontSize: 10, fontWeight: '600', color: '#1C1C1E' },
  mapLayersBtn: {
    position: 'absolute', bottom: 52, right: 10,
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E5EA',
  },

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

  // LIST VIEW — image wide + SHORT (landscape thumbnail)
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
  listingContent: {
    flex: 1,
    marginLeft: 12,
  },
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

  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', marginTop: 4 },

  // Suggest
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

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalOption: { paddingVertical: 14 },
  modalOptionText: { color: '#1C1C1E', fontWeight: '400' },
  modalOptionTextActive: { color: '#FF6B00', fontWeight: '700' },
});