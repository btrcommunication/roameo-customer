// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<'splash' | '(tabs)'>('splash');
  
  // Call the push notifications hook so it runs on app mount
  usePushNotifications();

  useEffect(() => {
    async function prepare() {
      try {
        // ALWAYS set initial route to splash first
        // Do NOT check token here - let splash handle it
        setInitialRoute('splash');
        
        // Small delay to ensure proper initialization
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }
    
    prepare();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="splash" 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'none'
        }} 
      />
      <Stack.Screen 
        name="auth" 
        options={{ 
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_right'
        }} 
      />
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: false,
          animation: 'fade'
        }} 
      />
    </Stack>
  );
}