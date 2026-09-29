import { WishlistNotice } from '../../components/WishlistNotice';
import { isApprovedCoupon } from '../../constants/couponMedia';
import { formatCouponPrice } from '../../constants/couponPrice';
import { getGooglePlaceDetails, GooglePlaceSuggestion, searchGooglePlaces } from '../../constants/googlePlaces';
import { useWishlist } from '../../hooks/useWishlist';
// app/(tabs)/index.tsx
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

// API Configuration
const API_KEY = 'a1f3378347d731fcc30c76efa73ea0325d7a72da53f6bdc4db72c814125dc3d3';
const BASE_URL = 'https://api.countrystatecity.in/v1';
const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

// Responsive Layout Constants
const PAGE_PADDING = 16;
const CARD_GAP = 12;
const VENDOR_CARD_WIDTH = width * 0.7;
const VENDOR_SNAP_INTERVAL = VENDOR_CARD_WIDTH + CARD_GAP;
const MARKETPLACE_CARD_WIDTH = width * 0.65;
const MARKETPLACE_SNAP_INTERVAL = MARKETPLACE_CARD_WIDTH + CARD_GAP;
const LISTING_CARD_WIDTH = (width - PAGE_PADDING * 2 - CARD_GAP * 3) / 3.3;
const LISTING_SNAP_INTERVAL = LISTING_CARD_WIDTH + CARD_GAP;
const CATEGORY_VISIBLE_COUNT = 4;

// Ad heights (compact)
const VENDOR_AD_HEIGHT = 100;
const MARKETPLACE_AD_HEIGHT = 70;

// Hardcoded ratings for listing cards
const HARDCODED_RATINGS = [
  { rating: 4.8, reviews: 230 },
  { rating: 4.7, reviews: 180 },
  { rating: 4.9, reviews: 310 },
  { rating: 4.6, reviews: 145 },
  { rating: 4.8, reviews: 205 },
  { rating: 4.7, reviews: 260 },
  { rating: 4.9, reviews: 190 },
  { rating: 4.6, reviews: 220 },
  { rating: 4.8, reviews: 175 },
  { rating: 4.7, reviews: 240 },
];

// Hardcoded % OFF badges
const HARDCODED_DISCOUNTS = ['20% OFF', '15% OFF', '30% OFF', '25% OFF', '10% OFF', '35% OFF'];

const getImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  if (imagePath.startsWith('/uploads')) return `${API_BASE_URL}${imagePath}`;
  if (imagePath.startsWith('uploads')) return `${API_BASE_URL}/${imagePath}`;
  return `${API_BASE_URL}/${imagePath}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const wishlist = useWishlist();

  const [userData, setUserData] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  const [locationDisplayName, setLocationDisplayName] = useState<string>('Detecting...');
  const [locationCity, setLocationCity] = useState<string>('');
  const [locationRegion, setLocationRegion] = useState<string>('');
  const [locationLocality, setLocationLocality] = useState<string>('');
  const [locationError, setLocationError] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const [selectedState, setSelectedState] = useState<any>(null);
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [countries, setCountries] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'country' | 'state' | 'city'>('country');
  const [loading, setLoading] = useState(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<GooglePlaceSuggestion[]>([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState('');
  const [deviceCoordinates, setDeviceCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const placeSearchSession = useRef(`roameo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [refreshing, setRefreshing] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [recommended, setRecommended] = useState<any[]>([]);
  const [newlyListed, setNewlyListed] = useState<any[]>([]);
  const [popularActivities, setPopularActivities] = useState<any[]>([]);
  const [homeLoading, setHomeLoading] = useState(true);

  const [vendorAds, setVendorAds] = useState<any[]>([]);
  const [marketplaceAds, setMarketplaceAds] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [currentVendorIndex, setCurrentVendorIndex] = useState(0);
  const vendorCarouselRef = useRef<FlatList>(null);
  const vendorAutoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  const [isVendorDragging, setIsVendorDragging] = useState(false);

  const [currentMarketplaceIndex, setCurrentMarketplaceIndex] = useState(0);
  const marketplaceCarouselRef = useRef<FlatList>(null);
  const marketplaceAutoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  const [isMarketplaceDragging, setIsMarketplaceDragging] = useState(false);

  const [currentNewlyListedIndex, setCurrentNewlyListedIndex] = useState(0);
  const newlyListedCarouselRef = useRef<FlatList>(null);
  const newlyListedAutoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  const [isNewlyListedDragging, setIsNewlyListedDragging] = useState(false);

  const [visibleCategoryCount, setVisibleCategoryCount] = useState(CATEGORY_VISIBLE_COUNT);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const token = await AsyncStorage.getItem('userToken');
      // Using an open endpoint if token is missing just to show broadcast notifications
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/profile/notifications`, { headers });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.log('Failed to fetch notifications', e);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const openNotifications = () => {
    setNotificationsModalVisible(true);
    fetchNotifications();
  };


  const getCategoryIcon = (categoryName: string) => {
    const iconMap: { [key: string]: { icon: string; library: string } } = {
      'Restaurants': { icon: 'utensils', library: 'FontAwesome5' },
      'restaurants': { icon: 'utensils', library: 'FontAwesome5' },
      'Coffee & Tea': { icon: 'coffee', library: 'FontAwesome5' },
      'coffee & tea': { icon: 'coffee', library: 'FontAwesome5' },
      'Fast Food': { icon: 'hamburger', library: 'FontAwesome5' },
      'fast food': { icon: 'hamburger', library: 'FontAwesome5' },
      'Spa & Wellness': { icon: 'flower-poppy', library: 'MaterialCommunityIcons' },
      'spa': { icon: 'flower-poppy', library: 'MaterialCommunityIcons' },
      'wellness': { icon: 'flower-poppy', library: 'MaterialCommunityIcons' },
      'Hotels': { icon: 'hotel', library: 'FontAwesome5' },
      'hotels': { icon: 'hotel', library: 'FontAwesome5' },
      'Lifestyle': { icon: 'shopping-bag', library: 'FontAwesome5' },
      'lifestyle': { icon: 'shopping-bag', library: 'FontAwesome5' },
      'Italian': { icon: 'pizza', library: 'FontAwesome5' },
      'italian': { icon: 'pizza', library: 'FontAwesome5' },
      'Pizza': { icon: 'pizza', library: 'FontAwesome5' },
      'pizza': { icon: 'pizza', library: 'FontAwesome5' },
      'Burgers': { icon: 'hamburger', library: 'FontAwesome5' },
      'burgers': { icon: 'hamburger', library: 'FontAwesome5' },
      'Chinese': { icon: 'bowl-food', library: 'MaterialCommunityIcons' },
      'chinese': { icon: 'bowl-food', library: 'MaterialCommunityIcons' },
      'Indian': { icon: 'food-curry', library: 'MaterialCommunityIcons' },
      'indian': { icon: 'food-curry', library: 'MaterialCommunityIcons' },
      'Mexican': { icon: 'burrito', library: 'MaterialCommunityIcons' },
      'mexican': { icon: 'burrito', library: 'MaterialCommunityIcons' },
      'Thai': { icon: 'bowl-mixed', library: 'MaterialCommunityIcons' },
      'thai': { icon: 'bowl-mixed', library: 'MaterialCommunityIcons' },
      'Japanese': { icon: 'fish', library: 'MaterialCommunityIcons' },
      'japanese': { icon: 'fish', library: 'MaterialCommunityIcons' },
      'Korean': { icon: 'food-variant', library: 'MaterialCommunityIcons' },
      'korean': { icon: 'food-variant', library: 'MaterialCommunityIcons' },
      'Vietnamese': { icon: 'noodles', library: 'MaterialCommunityIcons' },
      'vietnamese': { icon: 'noodles', library: 'MaterialCommunityIcons' },
      'Mediterranean': { icon: 'food-apple', library: 'MaterialCommunityIcons' },
      'mediterranean': { icon: 'food-apple', library: 'MaterialCommunityIcons' },
      'Cafe': { icon: 'coffee', library: 'FontAwesome5' },
      'cafe': { icon: 'coffee', library: 'FontAwesome5' },
      'Bakery': { icon: 'bread-slice', library: 'MaterialCommunityIcons' },
      'bakery': { icon: 'bread-slice', library: 'MaterialCommunityIcons' },
      'Desserts': { icon: 'cake', library: 'MaterialCommunityIcons' },
      'desserts': { icon: 'cake', library: 'MaterialCommunityIcons' },
      'Fitness': { icon: 'dumbbell', library: 'MaterialCommunityIcons' },
      'fitness': { icon: 'dumbbell', library: 'MaterialCommunityIcons' },
      'Yoga': { icon: 'human', library: 'MaterialCommunityIcons' },
      'yoga': { icon: 'human', library: 'MaterialCommunityIcons' },
      'Massage': { icon: 'spa', library: 'MaterialCommunityIcons' },
      'massage': { icon: 'spa', library: 'MaterialCommunityIcons' },
      'Salon': { icon: 'scissors', library: 'MaterialCommunityIcons' },
      'salon': { icon: 'scissors', library: 'MaterialCommunityIcons' },
      'Nails': { icon: 'nail', library: 'MaterialCommunityIcons' },
      'nails': { icon: 'nail', library: 'MaterialCommunityIcons' },
      'Hotel': { icon: 'hotel', library: 'FontAwesome5' },
      'hotel': { icon: 'hotel', library: 'FontAwesome5' },
      'Resort': { icon: 'umbrella-beach', library: 'FontAwesome5' },
      'resort': { icon: 'umbrella-beach', library: 'FontAwesome5' },
      'Shopping': { icon: 'shopping-bag', library: 'FontAwesome5' },
      'shopping': { icon: 'shopping-bag', library: 'FontAwesome5' },
      'Fashion': { icon: 'tshirt-crew', library: 'MaterialCommunityIcons' },
      'fashion': { icon: 'tshirt-crew', library: 'MaterialCommunityIcons' },
      'Electronics': { icon: 'laptop', library: 'FontAwesome5' },
      'electronics': { icon: 'laptop', library: 'FontAwesome5' },
      'Home Decor': { icon: 'home', library: 'FontAwesome5' },
      'home decor': { icon: 'home', library: 'FontAwesome5' },
    };
    if (iconMap[categoryName]) return iconMap[categoryName];
    const lowerKey = categoryName.toLowerCase();
    for (const key in iconMap) {
      if (key.toLowerCase() === lowerKey) return iconMap[key];
    }
    return { icon: 'grid', library: 'Ionicons' };
  };

  const renderCategoryIcon = (categoryName: string) => {
    const iconInfo = getCategoryIcon(categoryName);
    const color = "#FF6B00";
    if (iconInfo.library === 'FontAwesome5') {
      return <FontAwesome5 name={iconInfo.icon} size={18} color={color} />;
    } else if (iconInfo.library === 'MaterialCommunityIcons') {
      return <MaterialCommunityIcons name={iconInfo.icon as any} size={22} color={color} />;
    } else {
      return <Ionicons name={iconInfo.icon as any} size={20} color={color} />;
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const query = locationSearchQuery.trim();
    if (!modalVisible || query.length < 2) {
      setLocationSuggestions([]);
      setLocationSearchError('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLocationSearchLoading(true);
        setLocationSearchError('');
        setLocationSuggestions(await searchGooglePlaces(query, placeSearchSession.current, deviceCoordinates));
      } catch (error) {
        setLocationSuggestions([]);
        setLocationSearchError(error instanceof Error ? error.message : 'Unable to search locations.');
      } finally {
        setLocationSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [deviceCoordinates, locationSearchQuery, modalVisible]);

  useEffect(() => {
    if (vendorAds && vendorAds.length > 1) startVendorAutoPlay();
    return () => {
      if (vendorAutoPlayTimer.current) clearInterval(vendorAutoPlayTimer.current);
    };
  }, [vendorAds]);

  useEffect(() => {
    if (marketplaceAds && marketplaceAds.length > 1) startMarketplaceAutoPlay();
    return () => {
      if (marketplaceAutoPlayTimer.current) clearInterval(marketplaceAutoPlayTimer.current);
    };
  }, [marketplaceAds]);

  useEffect(() => {
    if (newlyListed && newlyListed.length > 1) startNewlyListedAutoPlay();
    return () => {
      if (newlyListedAutoPlayTimer.current) clearInterval(newlyListedAutoPlayTimer.current);
    };
  }, [newlyListed]);

  const startVendorAutoPlay = () => {
    if (vendorAutoPlayTimer.current) clearInterval(vendorAutoPlayTimer.current);
    vendorAutoPlayTimer.current = setInterval(() => {
      if (!isVendorDragging && vendorAds.length > 0) {
        const nextIndex = (currentVendorIndex + 1) % vendorAds.length;
        setCurrentVendorIndex(nextIndex);
        vendorCarouselRef.current?.scrollToOffset({ offset: nextIndex * VENDOR_SNAP_INTERVAL, animated: true });
      }
    }, 3000);
  };

  const startMarketplaceAutoPlay = () => {
    if (marketplaceAutoPlayTimer.current) clearInterval(marketplaceAutoPlayTimer.current);
    marketplaceAutoPlayTimer.current = setInterval(() => {
      if (!isMarketplaceDragging && marketplaceAds.length > 0) {
        const nextIndex = (currentMarketplaceIndex + 1) % marketplaceAds.length;
        setCurrentMarketplaceIndex(nextIndex);
        marketplaceCarouselRef.current?.scrollToOffset({ offset: nextIndex * MARKETPLACE_SNAP_INTERVAL, animated: true });
      }
    }, 3000);
  };

  const startNewlyListedAutoPlay = () => {
    if (newlyListedAutoPlayTimer.current) clearInterval(newlyListedAutoPlayTimer.current);
    newlyListedAutoPlayTimer.current = setInterval(() => {
      if (!isNewlyListedDragging && newlyListed.length > 0) {
        const nextIndex = (currentNewlyListedIndex + 1) % newlyListed.length;
        setCurrentNewlyListedIndex(nextIndex);
        newlyListedCarouselRef.current?.scrollToOffset({ offset: nextIndex * LISTING_SNAP_INTERVAL, animated: true });
      }
    }, 3000);
  };

  const handleVendorScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / VENDOR_SNAP_INTERVAL);
    if (index !== currentVendorIndex && index < vendorAds.length) setCurrentVendorIndex(index);
  };

  const handleVendorTouchStart = () => {
    setIsVendorDragging(true);
    if (vendorAutoPlayTimer.current) clearInterval(vendorAutoPlayTimer.current);
  };

  const handleVendorTouchEnd = () => {
    setIsVendorDragging(false);
    if (vendorAds.length > 1) setTimeout(() => startVendorAutoPlay(), 3000);
  };

  const handleMarketplaceScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / MARKETPLACE_SNAP_INTERVAL);
    if (index !== currentMarketplaceIndex && index < marketplaceAds.length) setCurrentMarketplaceIndex(index);
  };

  const handleMarketplaceTouchStart = () => {
    setIsMarketplaceDragging(true);
    if (marketplaceAutoPlayTimer.current) clearInterval(marketplaceAutoPlayTimer.current);
  };

  const handleMarketplaceTouchEnd = () => {
    setIsMarketplaceDragging(false);
    if (marketplaceAds.length > 1) setTimeout(() => startMarketplaceAutoPlay(), 3000);
  };

  const handleNewlyListedScroll = (event: any) => {
    const offset = event.nativeEvent.contentOffset.x;
    const index = Math.round(offset / LISTING_SNAP_INTERVAL);
    if (index !== currentNewlyListedIndex && index < newlyListed.length) setCurrentNewlyListedIndex(index);
  };

  const handleNewlyListedTouchStart = () => {
    setIsNewlyListedDragging(true);
    if (newlyListedAutoPlayTimer.current) clearInterval(newlyListedAutoPlayTimer.current);
  };

  const handleNewlyListedTouchEnd = () => {
    setIsNewlyListedDragging(false);
    if (newlyListed.length > 1) setTimeout(() => startNewlyListedAutoPlay(), 3000);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Access', 'Please enable location access to get nearby recommendations.', [{ text: 'OK' }]);
        setLocationError(true);
        setLocationDisplayName('Location unavailable');
        return null;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      setDeviceCoordinates({ latitude, longitude });
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const city = address?.city || address?.subregion || address?.district || '';
      const region = address?.region || '';
      const country = address?.country || '';
      const district = address?.district || '';

      if (city) {
        const displayName = [city, region]
          .filter((part, index, values) => part && values.indexOf(part) === index)
          .join(', ');
        setLocationDisplayName(displayName);
        setLocationCity(city);
        setLocationRegion(region);
        setLocationLocality(district);
        setSelectedCity({ name: city });
        setLocationError(false);
        return { city, country, state: region, district, latitude, longitude };
      }

      setLocationError(true);
      setLocationDisplayName('Location unavailable');
      return null;
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError(true);
      setLocationDisplayName('Location unavailable');
      return null;
    }
  };

  const loadInitialData = async () => {
    try {
      setHomeLoading(true);
      const storedToken = await AsyncStorage.getItem('userToken');
      const user = await AsyncStorage.getItem('userData');
      if (storedToken && user) { setToken(storedToken); setUserData(JSON.parse(user)); }
      const locationData = await getCurrentLocation();
      await Promise.all([fetchCategories(locationData?.city), fetchCoupons(), fetchAds()]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setHomeLoading(false);
    }
  };

  const fetchStatesForLocation = async (countryCode: string, locationData: any) => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/countries/${countryCode}/states`, { headers: { 'X-CSCAPI-KEY': API_KEY } });
      if (response.ok) {
        const data = await response.json();
        setStates(data);
        let stateObj = null;
        if (locationData && locationData.state) {
          stateObj = data.find((s: any) =>
            s.name.toLowerCase() === locationData.state.toLowerCase() ||
            s.name.toLowerCase().includes(locationData.state.toLowerCase()) ||
            locationData.state.toLowerCase().includes(s.name.toLowerCase())
          );
        }
        if (stateObj) { setSelectedState(stateObj); await fetchCitiesForLocation(countryCode, stateObj.iso2, locationData); }
        else if (data.length > 0) { setSelectedState(data[0]); await fetchCitiesForLocation(countryCode, data[0].iso2, locationData); }
      }
    } catch (error) { console.error('Error fetching states:', error); }
    finally { setLoading(false); }
  };

  const fetchCitiesForLocation = async (countryCode: string, stateCode: string, locationData: any) => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/countries/${countryCode}/states/${stateCode}/cities`, { headers: { 'X-CSCAPI-KEY': API_KEY } });
      if (response.ok) {
        const data = await response.json();
        setCities(data);
        let cityObj = null;
        if (locationData && locationData.city) {
          cityObj = data.find((c: any) =>
            c.name.toLowerCase() === locationData.city.toLowerCase() ||
            c.name.toLowerCase().includes(locationData.city.toLowerCase()) ||
            locationData.city.toLowerCase().includes(c.name.toLowerCase())
          );
        }
        if (cityObj) setSelectedCity(cityObj);
        else if (data.length > 0) setSelectedCity(data[0]);
        await fetchCategories();
        await fetchCoupons();
        await fetchAds();
      }
    } catch (error) { console.error('Error fetching cities:', error); }
    finally { setLoading(false); }
  };

  const fetchCategories = async (cityOverride?: string) => {
    try {
      let url = `${API_BASE_URL}/api/home`;
      const city = cityOverride || selectedCity?.name || locationCity;
      if (city) url += `?city=${encodeURIComponent(city)}`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success' && result.data) setCategories(result.data.categories || []);
      }
    } catch (error) { console.error('Error fetching categories:', error); }
  };

  const fetchCoupons = async () => {
    try {
      const url = `${API_BASE_URL}/api/coupons?is_approved=1`;
      console.log('Fetching approved coupons from:', url);
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          let couponsData = result.data || [];
          const activeCoupons = couponsData.filter(isApprovedCoupon);
          const vendorIds = [...new Set(activeCoupons.map((c: any) => c.vendor_id).filter((id: any) => id !== null))];
          let approvedVendorIds: number[] = [];
          if (vendorIds.length > 0) {
            try {
              const vendorResponse = await fetch(`${API_BASE_URL}/api/vendorcreation`);
              if (vendorResponse.ok) {
                const vendorResult = await vendorResponse.json();
                if (vendorResult.status === 'success') {
                  const vendors = vendorResult.data || [];
                  const approvedVendors = vendors.filter((v: any) => v.approval_status === 'approved' && v.is_active === 1);
                  approvedVendorIds = approvedVendors.map((v: any) => v.id);
                }
              }
            } catch (vendorError) { console.error('Error fetching vendors:', vendorError); }
          }
          const approvedCoupons = activeCoupons.filter((c: any) => {
            if (!c.vendor_id) return true;
            return approvedVendorIds.includes(c.vendor_id);
          });
          setCoupons(approvedCoupons);
          setRecommended(approvedCoupons.slice(0, 10));
          setPopularActivities(approvedCoupons.slice(0, 6));
          const sortedByDate = [...approvedCoupons].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setNewlyListed(sortedByDate.slice(0, 10));
        }
      }
    } catch (error) { console.error('Error fetching coupons:', error); }
  };

  const fetchAds = async () => {
    try {
      const url = `${API_BASE_URL}/api/vendorcreation/ads`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          const ads = result.data || [];
          const now = new Date(); now.setHours(0,0,0,0); const activeAds = ads.filter((ad: any) => { if(ad.is_active !== 1 || ad.approval_status !== 'approved') return false; if(ad.start_date){const start = new Date(ad.start_date); start.setHours(0,0,0,0); if(now < start) return false;} if(ad.end_date){const end = new Date(ad.end_date); end.setHours(23,59,59,999); if(now > end) return false;} return true; });
          const vendors = activeAds.filter((ad: any) => ad.ad_type === 'vendor');
          const marketplaces = activeAds.filter((ad: any) => ad.ad_type === 'marketplace');
          setVendorAds(vendors);
          setMarketplaceAds(marketplaces);
        }
      }
    } catch (error) { console.error('Error fetching ads:', error); }
  };

  const getFlatCategories = () => {
    const flatCategories: any[] = [];
    categories.forEach((cat) => {
      flatCategories.push({ id: cat.id, category_name: cat.category_name, level: cat.level || 1, image_url: cat.image_url || cat.image || cat.icon || null });
      if (cat.sub_divisions && Array.isArray(cat.sub_divisions)) {
        cat.sub_divisions.forEach((sub: any) => {
          flatCategories.push({ id: sub.id, category_name: sub.category_name, level: sub.level || 2, image_url: sub.image_url || sub.image || sub.icon || null });
          if (sub.sub_divisions && Array.isArray(sub.sub_divisions)) {
            sub.sub_divisions.forEach((subSub: any) => {
              flatCategories.push({ id: subSub.id, category_name: subSub.category_name, level: subSub.level || 3, image_url: subSub.image_url || subSub.image || subSub.icon || null });
            });
          }
        });
      }
    });
    return flatCategories;
  };

  const fetchCountries = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/countries`, { headers: { 'X-CSCAPI-KEY': API_KEY } });
      if (response.ok) setCountries(await response.json());
    } catch (error) { console.error('Error fetching countries:', error); }
    finally { setLoading(false); }
  };

  const fetchStates = async (countryCode: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/countries/${countryCode}/states`, { headers: { 'X-CSCAPI-KEY': API_KEY } });
      if (response.ok) {
        const data = await response.json();
        setStates(data);
        if (data.length > 0) { setSelectedState(data[0]); await fetchCities(countryCode, data[0].iso2); }
      }
    } catch (error) { console.error('Error fetching states:', error); }
    finally { setLoading(false); }
  };

  const fetchCities = async (countryCode: string, stateCode: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/countries/${countryCode}/states/${stateCode}/cities`, { headers: { 'X-CSCAPI-KEY': API_KEY } });
      if (response.ok) {
        const data = await response.json();
        setCities(data);
        if (data.length > 0) {
          setSelectedCity(data[0]);
          await fetchCategories();
          await fetchCoupons();
          await fetchAds();
        }
      }
    } catch (error) { console.error('Error fetching cities:', error); }
    finally { setLoading(false); }
  };

  const handleSelectLocation = async (item: any, type: 'country' | 'state' | 'city') => {
    setModalVisible(false);
    if (type === 'country') { setSelectedCountry(item); setSelectedState(null); setSelectedCity(null); await fetchStates(item.iso2); }
    else if (type === 'state') { setSelectedState(item); setSelectedCity(null); await fetchCities(selectedCountry?.iso2, item.iso2); }
    else if (type === 'city') {
      setSelectedCity(item);
      const displayParts = [item.name];
      if (locationLocality && locationLocality !== item.name) displayParts.push(locationLocality);
      if (selectedState && selectedState.name !== item.name && selectedState.name !== locationLocality) displayParts.push(selectedState.name);
      setLocationDisplayName(displayParts.join(', '));
      setLocationCity(item.name);
      await fetchCategories();
      await fetchCoupons();
      await fetchAds();
    }
  };

  const getLocationDisplay = () => locationError ? 'Location unavailable' : (locationDisplayName || 'Detecting...');

  const openLocationSelector = () => {
    placeSearchSession.current = `roameo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLocationSearchQuery('');
    setLocationSuggestions([]);
    setLocationSearchError('');
    setModalVisible(true);
  };

  const selectGoogleLocation = async (suggestion: GooglePlaceSuggestion) => {
    try {
      setLocationSearchLoading(true);
      const place = await getGooglePlaceDetails(suggestion.placeId, placeSearchSession.current);
      const components = place.addressComponents || [];
      const findPart = (...types: string[]) => components.find((part: any) =>
        types.some(type => part.types?.includes(type))
      )?.longText || '';
      const city = findPart('locality', 'postal_town', 'administrative_area_level_2', 'sublocality_level_1') || suggestion.primaryText;
      const region = findPart('administrative_area_level_1');

      setLocationDisplayName(place.formattedAddress || suggestion.fullText);
      setLocationCity(city);
      setLocationRegion(region);
      setLocationLocality('');
      setSelectedCity({ name: city });
      setLocationError(false);
      setModalVisible(false);
      await fetchCategories(city);
    } catch (error) {
      setLocationSearchError(error instanceof Error ? error.message : 'Unable to select this location.');
    } finally {
      setLocationSearchLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim() === '') { setShowSearchResults(false); setSearchResults([]); return; }
    const allCoupons = [...coupons];
    const filtered = allCoupons.filter((item) => {
      const searchTerm = text.toLowerCase();
      return (
        (item.title && item.title.toLowerCase().includes(searchTerm)) ||
        (item.vendor_name && item.vendor_name.toLowerCase().includes(searchTerm)) ||
        (item.coupon_code && item.coupon_code.toLowerCase().includes(searchTerm))
      );
    });
    setSearchResults(filtered);
    setShowSearchResults(filtered.length > 0);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim() !== '') router.push({ pathname: '/(tabs)/listings', params: { search: searchQuery } });
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      router.replace('/splash');
    } catch (error) { console.error('Logout error:', error); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCategories(), fetchCoupons(), fetchAds()]);
    setRefreshing(false);
  };

  const renderModalItem = ({ item, type }: any) => {
    return (
      <TouchableOpacity style={styles.modalItem} onPress={() => handleSelectLocation(item, type)}>
        <Text style={styles.modalItemText}>{item.name}</Text>
        {(type === 'country' && selectedCountry?.iso2 === item.iso2) ||
         (type === 'state' && selectedState?.iso2 === item.iso2) ||
         (type === 'city' && selectedCity?.id === item.id) ? (
          <Ionicons name="checkmark-circle" size={20} color="#FF6B00" />
        ) : null}
      </TouchableOpacity>
    );
  };

  const openAdCoupon = (ad: any) => {
    const linkedId = Number(ad.coupon_id ?? ad.coupon?.id);
    if (Number.isSafeInteger(linkedId) && linkedId > 0) {
      router.push({ pathname: '/listing-details', params: { id: String(linkedId) } });
      return;
    }
    const matches = coupons.filter(coupon => ad.coupon_code ? coupon.coupon_code === ad.coupon_code : ad.vendor_id && String(coupon.vendor_id) === String(ad.vendor_id));
    if (matches.length === 1) router.push({ pathname: '/listing-details', params: { id: String(matches[0].id) } });
    else router.push({ pathname: '/(tabs)/listings', params: { search: ad.vendor_name || '' } });
  };

  const openMarketplaceLink = async (ad: any) => {
    const url = ad.link_url || ad.link || ad.url;
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
        else Alert.alert('Error', 'Cannot open this link.');
      } catch (error) {
        console.error('Error opening link:', error);
        Alert.alert('Error', 'Something went wrong while opening the link.');
      }
    } else openAdCoupon(ad);
  };

  const handleVendorNext = () => {
    if (!vendorAds.length) return;
    const nextIndex = (currentVendorIndex + 1) % vendorAds.length;
    setCurrentVendorIndex(nextIndex);
    vendorCarouselRef.current?.scrollToOffset({ offset: nextIndex * VENDOR_SNAP_INTERVAL, animated: true });
  };

  // Vendor Ad Item
  const renderVendorAdItem = ({ item, index }: { item: any; index: number }) => {
    const imageUrl = item.image_url || item.banner_image || item.image;
    const fullImageUrl = getImageUrl(imageUrl);
    // Show the chevron ONLY on the currently-active (left/main) card, matching screenshot
    const isActiveCard = index === currentVendorIndex;

    return (
      <TouchableOpacity
        style={[styles.vendorAdCard, { width: VENDOR_CARD_WIDTH }]}
        activeOpacity={0.9}
        onPress={() => openAdCoupon(item)}
      >
        <View style={styles.vendorAdImageContainer}>
          {fullImageUrl ? (
            <Image source={{ uri: fullImageUrl }} style={styles.vendorAdImage} resizeMode="cover" />
          ) : (
            <View style={styles.vendorAdNoImage}>
              <Ionicons name="image-outline" size={40} color="#FF6B00" />
            </View>
          )}

          {/* Chevron only on the active/current card */}
          {vendorAds.length > 1 && isActiveCard && (
            <TouchableOpacity
              style={styles.vendorNextButton}
              onPress={(event) => { event.stopPropagation(); handleVendorNext(); }}
              accessibilityRole="button"
              accessibilityLabel="Next vendor promotion"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-forward" size={20} color="#000000" />
            </TouchableOpacity>
          )}

          <View style={styles.vendorAdTextContainer}>
            <Text style={styles.vendorAdTitle} numberOfLines={1}>{item.title || 'Special Offer'}</Text>
            {item.description && (
              <Text style={styles.vendorAdDescription} numberOfLines={1}>{item.description}</Text>
            )}
            <TouchableOpacity style={styles.claimButton} onPress={() => openAdCoupon(item)}>
              <Text style={styles.claimButtonText}>CLAIM COUPON</Text>
            </TouchableOpacity>
          </View>

          {/* DOTS overlaid on the image itself (bottom-right) */}
          {vendorAds.length > 1 && (
            <View style={styles.vendorDotsOverlay}>
              {vendorAds.map((_, dotIndex) => (
                <View
                  key={dotIndex}
                  style={[
                    styles.vendorDot,
                    dotIndex === currentVendorIndex ? styles.vendorDotActive : styles.vendorDotInactive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Marketplace Ad Item — NO dots
  const renderMarketplaceAdItem = ({ item }: { item: any }) => {
    const imageUrl = item.image_url || item.banner_image || item.image;
    const fullImageUrl = getImageUrl(imageUrl);
    return (
      <TouchableOpacity
        style={[styles.marketplaceAdCard, { width: MARKETPLACE_CARD_WIDTH }]}
        activeOpacity={0.9}
        onPress={() => openMarketplaceLink(item)}
      >
        {fullImageUrl ? (
          <Image source={{ uri: fullImageUrl }} style={styles.marketplaceAdImage} resizeMode="cover" />
        ) : (
          <View style={styles.marketplaceAdNoImage}>
            <Ionicons name="image-outline" size={30} color="#FF6B00" />
          </View>
        )}
        <View style={styles.marketplaceAdContent}>
          <Text style={styles.marketplaceAdTitle} numberOfLines={1}>{item.title || 'Special Deal'}</Text>
          {item.description && (
            <Text style={styles.marketplaceAdDesc} numberOfLines={1}>{item.description}</Text>
          )}
          <TouchableOpacity style={styles.visitSiteButton} onPress={() => openMarketplaceLink(item)}>
            <Text style={styles.visitSiteButtonText}>VISIT SITE</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListingCard = ({ item, index }: { item: any; index: number }) => {
    const imageUrl = getImageUrl(item.banner_image_url || item.banner_image);
    const ratingInfo = HARDCODED_RATINGS[index % HARDCODED_RATINGS.length];
    const discountLabel = HARDCODED_DISCOUNTS[index % HARDCODED_DISCOUNTS.length];

    return (
      <TouchableOpacity
        style={[styles.listingCard, { width: LISTING_CARD_WIDTH }]}
        onPress={() => router.push({ pathname: '/listing-details', params: { id: String(item.id) } })}
      >
        <View style={styles.listingImageWrapper}>
          <Image source={imageUrl ? { uri: imageUrl } : require('../../assets/images/Roameo-logo.png')} style={styles.listingImage} />
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{discountLabel}</Text>
          </View>
          <TouchableOpacity style={styles.wishlistButton}
            accessibilityRole="button"
            accessibilityLabel={`${wishlist.isSaved(item.id) ? 'Remove' : 'Save'} ${item.title} ${wishlist.isSaved(item.id) ? 'from' : 'to'} wishlist`}
            accessibilityState={{ selected: wishlist.isSaved(item.id) }}
            disabled={wishlist.loading || wishlist.pending !== null || !wishlist.ready}
            onPress={event => { event.stopPropagation(); void wishlist.toggle(Number(item.id)); }}>
            <Ionicons name={wishlist.isSaved(item.id) ? 'heart' : 'heart-outline'} size={14} color={wishlist.isSaved(item.id) ? '#FF6B00' : '#fff'} />
          </TouchableOpacity>
        </View>
        <Text style={styles.listingTitle} numberOfLines={1}>{item.title || 'Coupon Offer'}</Text>
        <Text style={styles.listingVendor} numberOfLines={1}>{item.vendor_name || 'Vendor'}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={11} color="#F5A623" />
          <Text style={styles.ratingText}>
            {ratingInfo.rating.toFixed(1)}
            <Text style={styles.ratingReviews}> ({ratingInfo.reviews})</Text>
          </Text>
        </View>
        <Text style={styles.listingPrice}>{formatCouponPrice(item.price)}</Text>
      </TouchableOpacity>
    );
  };

  const renderSearchResult = ({ item }: { item: any }) => {
    const imageUrl = getImageUrl(item.banner_image_url || item.banner_image);
    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => { setShowSearchResults(false); setSearchQuery(''); router.push(`/listing-details?id=${item.id}`); }}
      >
        <Image source={imageUrl ? { uri: imageUrl } : require('../../assets/images/Roameo-logo.png')} style={styles.searchResultImage} />
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.searchResultType}>{item.city || item.district || 'Location'}</Text>
          <Text style={styles.searchResultPrice}>{formatCouponPrice(item.price)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (homeLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      
      {/* Notifications Modal */}
      <Modal visible={notificationsModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {loadingNotifications ? (
              <ActivityIndicator color="#FF6B00" style={{ marginVertical: 30 }} />
            ) : notifications.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="notifications-off-outline" size={50} color="#ccc" />
                <Text style={{ marginTop: 10, color: '#666' }}>No new notifications</Text>
              </View>
            ) : (
              <ScrollView>
                {notifications.map((n: any, i) => (
                  <View key={i} style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 10 }}>
                    {n.image_url ? (
                      <Image source={{ uri: `${process.env.EXPO_PUBLIC_BASE_URL}${n.image_url}` }} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: '#E5E7EB', marginRight: 12, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="notifications" size={24} color="#FF6B00" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{n.title}</Text>
                      <Text style={{ color: '#666', marginTop: 4 }}>{n.message}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

</SafeAreaView>
    );
  }

  const flatCategories = getFlatCategories();
  const visibleCategories = flatCategories.slice(0, visibleCategoryCount);
  const hasMoreCategories = flatCategories.length > visibleCategoryCount;

  const handleMoreCategories = () => {
    if (hasMoreCategories) setVisibleCategoryCount(prev => Math.min(prev + CATEGORY_VISIBLE_COUNT, flatCategories.length));
    else setVisibleCategoryCount(CATEGORY_VISIBLE_COUNT);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <WishlistNotice error={wishlist.error} needsLogin={wishlist.needsLogin} retry={wishlist.refresh} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B00']} />}
      >
        {/* Top Header Row */}
        <View style={styles.headerRow}>
          <Image source={require('../../assets/images/Roameo-logo.png')} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity style={styles.headerIconBtn} onPress={openNotifications}>
            <Ionicons name="notifications-outline" size={26} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

        {/* Location Row */}
        <View style={styles.locationRow}>
          <TouchableOpacity style={styles.locationContainer} onPress={openLocationSelector} activeOpacity={0.7}>
            <Ionicons name="location" size={16} color="#FF6B00" />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Current Location</Text>
              <View style={styles.locationValueRow}>
                <Text style={styles.locationValue} numberOfLines={1}>
                  {loading ? 'Loading...' : getLocationDisplay()}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#333" style={{ marginLeft: 4 }} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar + Filter */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#8E8E93" style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search for restaurants, spa, hotels & more..."
              style={styles.searchInput}
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={handleSearch}
              returnKeyType="search"
              onSubmitEditing={handleSearchSubmit}
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={() => router.push('/(tabs)/listings')}>
            <Ionicons name="options-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <FlatList
              data={searchResults.slice(0, 5)}
              renderItem={renderSearchResult}
              keyExtractor={(item, index) => `search-${item.id || index}`}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.searchResultSeparator} />}
            />
            {searchResults.length > 5 && (
              <TouchableOpacity style={styles.viewAllResults} onPress={handleSearchSubmit}>
                <Text style={styles.viewAllResultsText}>View all {searchResults.length} results</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Vendor Ads Carousel — dots overlaid on image */}
        {vendorAds.length > 0 && (
          <View style={styles.vendorAdsContainer}>
            <FlatList
              ref={vendorCarouselRef}
              data={vendorAds}
              renderItem={renderVendorAdItem}
              keyExtractor={(item, index) => `vendor-${item.id || index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleVendorScroll}
              scrollEventThrottle={16}
              snapToInterval={VENDOR_SNAP_INTERVAL}
              decelerationRate="fast"
              onTouchStart={handleVendorTouchStart}
              onTouchEnd={handleVendorTouchEnd}
              onMomentumScrollEnd={(event) => {
                const offset = event.nativeEvent.contentOffset.x;
                const index = Math.round(offset / VENDOR_SNAP_INTERVAL);
                if (index !== currentVendorIndex && index < vendorAds.length) setCurrentVendorIndex(index);
              }}
              contentContainerStyle={{ paddingHorizontal: PAGE_PADDING }}
              ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
              getItemLayout={(data, index) => ({ length: VENDOR_SNAP_INTERVAL, offset: VENDOR_SNAP_INTERVAL * index, index })}
            />
            {/* No dots below — they're overlaid on each image */}
          </View>
        )}

        {/* Categories */}
        {visibleCategories.length > 0 && (
          <View style={styles.categoriesContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
              {visibleCategories.map((cat: any, idx: number) => {
                const categoryImageUrl = getImageUrl(cat.image_url);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={styles.categoryItem}
                    onPress={() => { router.push({ pathname: '/(tabs)/listings', params: { category: cat.category_name } }); }}
                  >
                    <View style={styles.categoryIconBox}>
                      {categoryImageUrl ? (
                        <Image source={{ uri: categoryImageUrl }} style={styles.categoryImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.categoryImagePlaceholder}>{renderCategoryIcon(cat.category_name)}</View>
                      )}
                    </View>
                    <Text style={styles.categoryText} numberOfLines={1}>{cat.category_name}</Text>
                  </TouchableOpacity>
                );
              })}
              {(hasMoreCategories || visibleCategoryCount > CATEGORY_VISIBLE_COUNT) && (
                <TouchableOpacity style={styles.categoryItem} onPress={handleMoreCategories}>
                  <View style={styles.categoryIconBox}>
                    <View style={styles.categoryImagePlaceholder}>
                      <Ionicons name="grid-outline" size={22} color="#FF6B00" />
                    </View>
                  </View>
                  <Text style={styles.categoryText} numberOfLines={1}>More</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        )}

        {/* Recommended For You */}
        {recommended && recommended.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recommended For You</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/listings')}>
                <Text style={styles.seeAllText}>See All <Ionicons name="chevron-forward" size={10} /></Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={recommended}
              renderItem={renderListingCard}
              keyExtractor={(item, index) => `recommended-${item.id || index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: PAGE_PADDING }}
              ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
              snapToInterval={LISTING_SNAP_INTERVAL}
              decelerationRate="fast"
              getItemLayout={(data, index) => ({ length: LISTING_SNAP_INTERVAL, offset: LISTING_SNAP_INTERVAL * index, index })}
            />
          </>
        )}

        {/* Best Deals Near You — NO DOTS */}
        {marketplaceAds.length > 0 && (
          <View style={styles.marketplaceAdsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Best Deals Near You</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/listings')}>
                <Text style={styles.seeAllText}>See All <Ionicons name="chevron-forward" size={10} /></Text>
              </TouchableOpacity>
            </View>
            <FlatList
              ref={marketplaceCarouselRef}
              data={marketplaceAds}
              renderItem={renderMarketplaceAdItem}
              keyExtractor={(item, index) => `marketplace-${item.id || index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleMarketplaceScroll}
              scrollEventThrottle={16}
              snapToInterval={MARKETPLACE_SNAP_INTERVAL}
              decelerationRate="fast"
              onTouchStart={handleMarketplaceTouchStart}
              onTouchEnd={handleMarketplaceTouchEnd}
              onMomentumScrollEnd={(event) => {
                const offset = event.nativeEvent.contentOffset.x;
                const index = Math.round(offset / MARKETPLACE_SNAP_INTERVAL);
                if (index !== currentMarketplaceIndex && index < marketplaceAds.length) setCurrentMarketplaceIndex(index);
              }}
              contentContainerStyle={{ paddingHorizontal: PAGE_PADDING }}
              ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
              getItemLayout={(data, index) => ({ length: MARKETPLACE_SNAP_INTERVAL, offset: MARKETPLACE_SNAP_INTERVAL * index, index })}
            />
            {/* No pagination dots — user slides manually, auto-play still works */}
          </View>
        )}

        {/* Popular Activities */}
        {popularActivities && popularActivities.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Activities</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/listings')}>
                <Text style={styles.seeAllText}>See All <Ionicons name="chevron-forward" size={10} /></Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={popularActivities}
              renderItem={renderListingCard}
              keyExtractor={(item, index) => `popular-${item.id || index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: PAGE_PADDING }}
              ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
              snapToInterval={LISTING_SNAP_INTERVAL}
              decelerationRate="fast"
              getItemLayout={(data, index) => ({ length: LISTING_SNAP_INTERVAL, offset: LISTING_SNAP_INTERVAL * index, index })}
            />
          </>
        )}

        {/* Newly Listed */}
        {newlyListed && newlyListed.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Newly Listed</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/listings')}>
                <Text style={styles.seeAllText}>See All <Ionicons name="chevron-forward" size={10} /></Text>
              </TouchableOpacity>
            </View>
            <FlatList
              ref={newlyListedCarouselRef}
              data={newlyListed}
              renderItem={renderListingCard}
              keyExtractor={(item, index) => `newly-${item.id || index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleNewlyListedScroll}
              scrollEventThrottle={16}
              snapToInterval={LISTING_SNAP_INTERVAL}
              decelerationRate="fast"
              onTouchStart={handleNewlyListedTouchStart}
              onTouchEnd={handleNewlyListedTouchEnd}
              onMomentumScrollEnd={(event) => {
                const offset = event.nativeEvent.contentOffset.x;
                const index = Math.round(offset / LISTING_SNAP_INTERVAL);
                if (index !== currentNewlyListedIndex && index < newlyListed.length) setCurrentNewlyListedIndex(index);
              }}
              contentContainerStyle={{ paddingHorizontal: PAGE_PADDING }}
              ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
              getItemLayout={(data, index) => ({ length: LISTING_SNAP_INTERVAL, offset: LISTING_SNAP_INTERVAL * index, index })}
            />
          </>
        )}

        {/* Why Choose Roameo Section */}
        <View style={styles.whyChooseContainer}>
          <Text style={styles.whyChooseTitle}>Why Choose Roameo?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuresScroll}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconBox}>
                <Ionicons name="pricetag-outline" size={24} color="#FF6B00" />
              </View>
              <Text style={styles.featureTitle}>Best Offers</Text>
              <Text style={styles.featureDesc}>Save more every time</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconBox}>
                <Ionicons name="star-outline" size={24} color="#FF6B00" />
              </View>
              <Text style={styles.featureTitle}>Reward Points</Text>
              <Text style={styles.featureDesc}>Earn on every booking</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconBox}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#FF6B00" />
              </View>
              <Text style={styles.featureTitle}>Trusted Partners</Text>
              <Text style={styles.featureDesc}>Quality you can trust</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconBox}>
                <Ionicons name="headset-outline" size={24} color="#FF6B00" />
              </View>
              <Text style={styles.featureTitle}>24/7 Support</Text>
              <Text style={styles.featureDesc}>We're here for you</Text>
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Location Selection Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search location</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
            <View style={styles.locationSearchInputWrap}>
              <Ionicons name="search-outline" size={20} color="#8E8E93" />
              <TextInput
                autoFocus
                value={locationSearchQuery}
                onChangeText={setLocationSearchQuery}
                placeholder="Search city, area, or address"
                placeholderTextColor="#8E8E93"
                style={styles.locationSearchInput}
              />
              {locationSearchLoading && <ActivityIndicator size="small" color="#FF6B00" />}
            </View>
            {!!locationSearchError && <Text style={styles.locationSearchError}>{locationSearchError}</Text>}
            <FlatList
              data={locationSuggestions}
              keyExtractor={item => item.placeId}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.googlePlaceRow} onPress={() => void selectGoogleLocation(item)}>
                  <Ionicons name="location-outline" size={20} color="#FF6B00" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.googlePlaceTitle}>{item.primaryText}</Text>
                    {!!item.secondaryText && <Text style={styles.googlePlaceSubtitle}>{item.secondaryText}</Text>}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                locationSearchQuery.trim().length >= 2 && !locationSearchLoading && !locationSearchError
                  ? <View style={styles.emptyContainer}><Text style={styles.emptyText}>No locations found</Text></View>
                  : <View style={styles.emptyContainer}><Text style={styles.emptyText}>Start typing to search Google Maps</Text></View>
              }
            />
            <View style={styles.googleAttribution}>
              <Image
                source={{ uri: 'https://developers.google.com/maps/documentation/images/powered_by_google_on_white.png' }}
                style={styles.googleAttributionImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.modalFooter}>
              {modalType !== 'country' && selectedCountry && (
                <TouchableOpacity style={styles.modalFooterButton} onPress={() => { setModalType('country'); setModalVisible(true); }}>
                  <Text style={styles.modalFooterButtonText}>← Change Country</Text>
                </TouchableOpacity>
              )}
              {modalType === 'city' && selectedState && (
                <TouchableOpacity style={styles.modalFooterButton} onPress={() => { setModalType('state'); setModalVisible(true); }}>
                  <Text style={styles.modalFooterButtonText}>← Change State</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  contentContainer: { paddingTop: 12, paddingBottom: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#8E8E93', fontSize: 14 },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: PAGE_PADDING, marginBottom: 8 },
  logo: { width: 120, height: 40 },
  headerIconBtn: { padding: 4 },
  // Location Row
  locationRow: { width: '48%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAGE_PADDING, marginBottom: 12 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locationTextContainer: { marginLeft: 6, flex: 1 },
  locationLabel: { fontSize: 10, color: '#8E8E93' },
  locationValueRow: { flexDirection: 'row', alignItems: 'center' },
  locationValue: { fontSize: 13, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  // Search
  searchRow: { flexDirection: 'row', paddingHorizontal: PAGE_PADDING, marginBottom: 16, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 22, paddingHorizontal: 14, height: 42, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 13, color: '#000' },
  filterButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF6B00', justifyContent: 'center', alignItems: 'center' },
  searchResultsContainer: { backgroundColor: '#FFFFFF', marginHorizontal: PAGE_PADDING, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E5EA', maxHeight: 300, position: 'relative', zIndex: 1000, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  searchResultItem: { flexDirection: 'row', padding: 10, alignItems: 'center' },
  searchResultImage: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#F2F2F7' },
  searchResultContent: { flex: 1, marginLeft: 12 },
  searchResultTitle: { fontSize: 14, fontWeight: '600', color: '#1C1C1E' },
  searchResultType: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  searchResultPrice: { fontSize: 12, fontWeight: '600', color: '#FF6B00', marginTop: 1 },
  searchResultSeparator: { height: 1, backgroundColor: '#F2F2F7', marginHorizontal: 10 },
  viewAllResults: { padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F2F2F7' },
  viewAllResultsText: { color: '#FF6B00', fontSize: 13, fontWeight: '600' },
  // Vendor Ads
  vendorAdsContainer: { marginBottom: 12 },
  vendorAdCard: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#F2F2F7', height: VENDOR_AD_HEIGHT },
  vendorAdImageContainer: { width: '100%', height: '100%', position: 'relative' },
  vendorAdImage: { width: '100%', height: '100%' },
  vendorAdNoImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5EE' },
  vendorNextButton: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  vendorAdTextContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'transparent' },
  vendorAdTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  vendorAdDescription: { color: '#FFFFFF', fontSize: 10, marginTop: 1, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  claimButton: { backgroundColor: '#FF6B00', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start', marginTop: 3 },
  claimButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  // Dots overlaid on the image (bottom-right)
  vendorDotsOverlay: { position: 'absolute', bottom: 6, right: 8, flexDirection: 'row', alignItems: 'center' },
  vendorDot: { width: 5, height: 5, borderRadius: 2.5, marginHorizontal: 2 },
  vendorDotActive: { backgroundColor: '#FFFFFF', width: 14 },
  vendorDotInactive: { backgroundColor: 'rgba(255,255,255,0.55)' },
  // Categories
  categoriesContainer: { marginBottom: 8 },
  categoriesScroll: { paddingLeft: PAGE_PADDING, paddingBottom: 8 },
  categoryItem: { alignItems: 'center', marginRight: 16, width: 60 },
  categoryIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FFF5EE', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFE5D4', marginBottom: 4, overflow: 'hidden' },
  categoryImage: { width: '100%', height: '100%' },
  categoryImagePlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  categoryText: { fontSize: 10, color: '#3A3A3C', fontWeight: '500', textAlign: 'center' },
  // Section Header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: PAGE_PADDING, marginBottom: 8, marginTop: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E' },
  seeAllText: { fontSize: 11, color: '#FF6B00', fontWeight: '600' },
  // Listing Cards
  listingCard: { marginRight: 0 },
  listingImageWrapper: { position: 'relative', marginBottom: 4 },
  listingImage: { width: '100%', height: 80, borderRadius: 8, backgroundColor: '#F2F2F7' },
  discountBadge: { position: 'absolute', bottom: 6, left: 6, backgroundColor: '#FF6B00', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  wishlistButton: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.25)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  listingTitle: { fontSize: 11, fontWeight: '700', color: '#1C1C1E' },
  listingVendor: { fontSize: 9, color: '#8E8E93', marginVertical: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  ratingText: { fontSize: 9, fontWeight: '600', color: '#1C1C1E', marginLeft: 3 },
  ratingReviews: { fontSize: 9, fontWeight: '400', color: '#8E8E93' },
  listingPrice: { fontSize: 10, fontWeight: '700', color: '#FF6B00', marginTop: 1 },
  // Marketplace Ads (no dots)
  marketplaceAdsContainer: { marginBottom: 12 },
  marketplaceAdCard: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#F2F2F7', height: MARKETPLACE_AD_HEIGHT },
  marketplaceAdImage: { width: '100%', height: '100%' },
  marketplaceAdNoImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF5EE' },
  marketplaceAdContent: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'transparent' },
  marketplaceAdTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  marketplaceAdDesc: { color: '#FFFFFF', fontSize: 9, marginTop: 0, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  visitSiteButton: { backgroundColor: '#FF6B00', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 2 },
  visitSiteButtonText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  // Why Choose
  whyChooseContainer: { paddingHorizontal: PAGE_PADDING, marginTop: 14, marginBottom: 20 },
  whyChooseTitle: { fontSize: 14, fontWeight: '700', color: '#1C1C1E', marginBottom: 12 },
  featuresScroll: { paddingRight: 16 },
  featureItem: { width: 80, alignItems: 'center', marginRight: 16 },
  featureIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF5EE', justifyContent: 'center', alignItems: 'center', marginBottom: 6, borderWidth: 1, borderColor: '#FFE5D4' },
  featureTitle: { fontSize: 10, fontWeight: '600', color: '#1C1C1E', textAlign: 'center' },
  featureDesc: { fontSize: 8, color: '#8E8E93', textAlign: 'center', marginTop: 1 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', minHeight: '50%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  locationSearchInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 12, height: 48, backgroundColor: '#F2F2F7', borderRadius: 10 },
  locationSearchInput: { flex: 1, fontSize: 15, color: '#1C1C1E' },
  locationSearchError: { color: '#B91C1C', fontSize: 13, paddingHorizontal: 16, marginBottom: 6 },
  googlePlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  googlePlaceTitle: { color: '#1C1C1E', fontSize: 15, fontWeight: '600' },
  googlePlaceSubtitle: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  googleAttribution: { alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 },
  googleAttributionImage: { width: 116, height: 14 },
  modalListContent: { paddingVertical: 8 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  modalItemText: { fontSize: 16, color: '#1C1C1E' },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  modalFooterButton: { paddingVertical: 8, paddingHorizontal: 12 },
  modalFooterButtonText: { color: '#FF6B00', fontSize: 14, fontWeight: '600' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#8E8E93', fontSize: 14 },
});
