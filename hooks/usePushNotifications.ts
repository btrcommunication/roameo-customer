import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Configure how notifications should be handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [notification, setNotification] = useState<Notifications.Notification | false>(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
      if (token) {
        sendPushTokenToBackend(token);
      } else {
        console.warn('[FCM Push] No token returned from registerForPushNotificationsAsync');
      }
    });

    // Fired whenever a notification is received while the app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notif => {
      console.log('[FCM Push] Notification received in foreground:', {
        title: notif.request.content.title,
        body: notif.request.content.body,
        data: notif.request.content.data
      });
      setNotification(notif);
    });

    // Fired whenever a user taps or interacts with a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('[FCM Push] User clicked notification:', {
        title: response.notification.request.content.title,
        data: data
      });
      if (data && data.type === 'notification_ad') {
        console.log('[FCM Push] Tapped notification ad with ID:', data.adId);
        const adPayload = {
          id: data.adId,
          title: response.notification.request.content.title || data.title,
          message: response.notification.request.content.body || data.description,
          description: response.notification.request.content.body || data.description,
          image_url: data.imageUrl || data.image_url,
          vendor_id: data.vendor_id,
          vendor_name: data.vendor_name,
          coupon_ids: data.coupon_ids,
          coupon_id: data.coupon_id,
          category_ids: data.category_ids,
          category_id: data.category_id,
          coupon_code: data.coupon_code,
          target_type: data.target_type
        };
        AsyncStorage.setItem('pendingNotificationAd', JSON.stringify(adPayload)).catch(() => {});
        // Route directly to home tab where the popup opens
        router.push('/(tabs)');
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
  };
}

async function sendPushTokenToBackend(token: string) {
  try {
    const userToken = await AsyncStorage.getItem('userToken');
    const baseURL = process.env.EXPO_PUBLIC_BASE_URL || 'https://roameoapp.jlpartners.in';
    const targetUrl = `${baseURL}/api/auth/save-push-token`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Attach user auth token if logged in and not in demo mode
    if (userToken && userToken !== 'demo-token') {
      headers['Authorization'] = `Bearer ${userToken}`;
    }

    console.log(`[FCM Push] Registering device token to backend: ${targetUrl}`);
    console.log(`[FCM Push] Device Token prefix: ${token.substring(0, 20)}...`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        token,
        platform: Platform.OS 
      }),
    });

    const responseData = await response.json().catch(() => null);

    if (response.ok) {
      console.log('[FCM Push] Device push token successfully registered on backend:', responseData);
    } else {
      console.error(`[FCM Push Error] Backend returned status ${response.status} when saving push token:`, responseData);
    }
  } catch (error) {
    console.error('[FCM Push Error] Failed to send push token to backend:', error);
  }
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    console.log('[FCM Push] Android notification channel "default" initialized');
  }

  if (Device.isDevice && Platform.OS !== 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      console.log('[FCM Push] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    console.log(`[FCM Push] Notification permission status: "${finalStatus}"`);

    if (finalStatus !== 'granted') {
      console.error('[FCM Push Error] Notification permission NOT granted by user!');
      return;
    }
    
    try {
      // Get the raw FCM device token for Firebase
      console.log('[FCM Push] Requesting raw FCM device push token from Firebase...');
      const deviceTokenResult = await Notifications.getDevicePushTokenAsync();
      token = deviceTokenResult.data;
      console.log('[FCM Push] Obtained FCM device push token:', token);
    } catch (e) {
      console.error('[FCM Push Error] Error getting device push token from Firebase:', e);
    }
    
  } else {
    console.warn('[FCM Push Warning] Push notifications requires a physical device (Device.isDevice is false or platform is web).');
  }

  return token;
}

export async function registerPushTokenAfterLogin() {
  console.log('[FCM Push] registerPushTokenAfterLogin triggered');
  const token = await registerForPushNotificationsAsync();
  if (token) {
    await sendPushTokenToBackend(token);
  }
}
