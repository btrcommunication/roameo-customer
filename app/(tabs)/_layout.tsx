// app/(tabs)/_layout.tsx
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { readCart, subscribeCartChanges } from '../../constants/cart';
import { useWishlist } from '../../hooks/useWishlist';

export default function TabLayout() {
  const router = useRouter();
  const [cartCount, setCartCount] = useState(0);
  const wishlist = useWishlist();

  const fetchCartCount = useCallback(async () => {
    try {
      const items = await readCart();
      setCartCount(items.reduce((sum, item) => sum + item.quantity, 0));
    } catch (error) {
      console.error('Fetch cart count error:', error);
    }
  }, []);

  useEffect(() => {
    fetchCartCount();
    return subscribeCartChanges(fetchCartCount);
  }, [fetchCartCount]);

  // Keep the badge in sync when the tab layout regains focus (e.g. after checkout)
  useFocusEffect(
    useCallback(() => {
      fetchCartCount();
    }, [fetchCartCount])
  );

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('userToken');
              await AsyncStorage.removeItem('userData');
              router.replace('/auth');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const wishlistCount = wishlist.items.length;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#FF6B00',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F2F2F7',
          height: 60,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: '#FFFFFF',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#F2F2F7',
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '700',
          color: '#1C1C1E',
        },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            {/* Header Cart Button with Badge */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/cart')}
              style={{ marginRight: 16, position: 'relative' }}
            >
              <Ionicons name="cart-outline" size={24} color="#1C1C1E" />
              {cartCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -6,
                  right: -8,
                  backgroundColor: '#FF6B00',
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logout Button */}
            {route.name !== 'index' && (
              <TouchableOpacity onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            )}
          </View>
        ),
      })}
    >
      {/* 1. Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 2. Coupons */}
      <Tabs.Screen
        name="listings"
        options={{
                  headerShown: false,

          title: 'Coupons',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'view-grid' : 'view-grid-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Wishlist */}
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={focused ? 'heart' : 'heart-outline'}
                size={22}
                color={color}
              />
              {wishlistCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -6,
                  right: -10,
                  backgroundColor: '#FF6B00',
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      {/* 4. Cart */}
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons
                name={focused ? 'cart' : 'cart-outline'}
                size={22}
                color={color}
              />
              {cartCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -6,
                  right: -10,
                  backgroundColor: '#FF6B00',
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 4,
                }}>
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

      {/* 5. Orders */}
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bag' : 'bag-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 6. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <FontAwesome5
              name={focused ? 'user-alt' : 'user'}
              size={19}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
