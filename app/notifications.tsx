// app/notifications.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState<number[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/profile/notifications`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        const storedSeenStr = await AsyncStorage.getItem('seenNotificationIds');
        const seenIds = storedSeenStr ? JSON.parse(storedSeenStr) : [];
        setSeenNotificationIds(seenIds);
      }
    } catch (e) {
      console.log('Failed to fetch notifications', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleNotificationPress = async (item: any) => {
    // Mark as seen locally
    try {
      const updatedSeen = Array.from(new Set([...seenNotificationIds, item.id]));
      setSeenNotificationIds(updatedSeen);
      await AsyncStorage.setItem('seenNotificationIds', JSON.stringify(updatedSeen));

      // Attempt backend mark read
      const token = await AsyncStorage.getItem('userToken');
      if (token && item.id) {
        fetch(`${process.env.EXPO_PUBLIC_BASE_URL}/api/profile/notifications/${item.id}/read`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } catch (_) {}

    // If ad notification, navigate to relevant coupon / listings
    let couponIds: number[] = [];
    if (item.coupon_ids) {
      try {
        const parsed = typeof item.coupon_ids === 'string' ? JSON.parse(item.coupon_ids) : item.coupon_ids;
        if (Array.isArray(parsed)) couponIds = parsed.map(Number).filter((n: number) => !isNaN(n) && n > 0);
        else if (typeof item.coupon_ids === 'string') couponIds = item.coupon_ids.split(',').map(Number).filter((n: number) => !isNaN(n) && n > 0);
      } catch (e) {
        couponIds = String(item.coupon_ids).split(',').map(Number).filter((n: number) => !isNaN(n) && n > 0);
      }
    }
    if (item.coupon_id && !couponIds.includes(Number(item.coupon_id))) {
      couponIds.push(Number(item.coupon_id));
    }

    if (couponIds.length === 1) {
      router.push({ pathname: '/listing-details', params: { id: String(couponIds[0]), ad_id: item.ad_id ? String(item.ad_id) : undefined } });
    } else if (couponIds.length > 1) {
      router.push({
        pathname: '/(tabs)/listings',
        params: {
          coupon_ids: couponIds.join(','),
          vendor_id: item.vendor_id ? String(item.vendor_id) : undefined,
          ad_id: item.ad_id ? String(item.ad_id) : undefined,
        },
      });
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isSeen = seenNotificationIds.includes(item.id) || item.is_read;
    const formattedDate = item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : '';

    return (
      <TouchableOpacity
        style={[styles.notificationCard, isSeen ? styles.seenCard : styles.unseenCard]}
        activeOpacity={0.7}
        onPress={() => handleNotificationPress(item)}
      >
        {item.image_url ? (
          <Image
            source={{ uri: `${process.env.EXPO_PUBLIC_BASE_URL}${item.image_url}` }}
            style={styles.notificationImage}
          />
        ) : (
          <View style={styles.notificationIconPlaceholder}>
            <Ionicons name="notifications" size={24} color="#FF6B00" />
          </View>
        )}

        <View style={styles.notificationBody}>
          <View style={styles.titleRow}>
            <Text style={[styles.notificationTitle, !isSeen && styles.boldTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            {!isSeen && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationMessage} numberOfLines={3}>
            {item.message || item.description}
          </Text>
          {Boolean(formattedDate) && (
            <Text style={styles.notificationDate}>{formattedDate}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item, index) => String(item.id || index)}
          contentContainerStyle={[styles.listContent, { paddingBottom: 60 + (insets.bottom > 0 ? insets.bottom : 16) }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B00']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="notifications-off-outline" size={48} color="#C7C7CC" />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>We will notify you about approved deals, special offers and discounts here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 6,
    marginLeft: -6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  seenCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  unseenCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  notificationImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  notificationIconPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FFE8D6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationBody: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    color: '#1C1C1E',
    flex: 1,
  },
  boldTitle: {
    fontWeight: '700',
    color: '#111827',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  notificationDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyIconBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 19,
  },
});
