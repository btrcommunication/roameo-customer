// app/splash.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  SafeAreaView,
  StyleSheet,
  View
} from 'react-native';

export default function SplashScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasNavigated, setHasNavigated] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Check login status immediately
    checkLoginStatus();

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // ALWAYS wait 2.5 seconds before navigating
    const timer = setTimeout(() => {
      navigateToNext();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      console.log('Splash - Token exists:', !!token);
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error('Error checking login status:', error);
      setIsLoggedIn(false);
    } finally {
      setLoading(false);
    }
  };

  const navigateToNext = () => {
    // Prevent multiple navigations
    if (hasNavigated) return;
    setHasNavigated(true);
    
    console.log('Splash - Navigating to:', isLoggedIn ? '(tabs) Home' : '/auth Login');
    
    if (isLoggedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/auth');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <Image 
            source={require('../assets/images/Roameo-logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centeredContent}>
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
          <Image 
            source={require('../assets/images/Roameo-logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B00',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logo: {
    width: 200,
    height: 200,
  },
});