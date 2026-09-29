// screens/splash.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkLoginStatus();

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();

    const timer = setTimeout(() => {
      navigateToNext();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error('Error checking login status:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToNext = () => {
    if (isLoggedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/auth');
    }
  };

  const handleSkip = () => {
    navigateToNext();
  };

  const rotate = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View 
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <Animated.View 
          style={[
            styles.decorativeCircle1,
            {
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 50],
                    outputRange: [0, -30],
                  })
                }
              ]
            }
          ]}
        />

        <Animated.View 
          style={[
            styles.decorativeCircle2,
            {
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 50],
                    outputRange: [0, 30],
                  })
                }
              ]
            }
          ]}
        />

        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: logoScale },
                { rotate: rotate }
              ]
            }
          ]}
        >
          <Image 
            source={require('../assets/images/Roameo-logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ translateY: slideAnim }],
          }}
        >
          <Text style={styles.title}>Welcome to Roameo</Text>
          <Text style={styles.subtitle}>Your Travel Companion</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.loadingBarContainer,
            {
              opacity: fadeAnim,
            }
          ]}
        >
          <View style={styles.loadingBar}>
            <Animated.View 
              style={[
                styles.loadingBarFill,
                {
                  width: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  })
                }
              ]}
            />
          </View>
          <Text style={styles.loadingText}>Discover amazing experiences...</Text>
        </Animated.View>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
          <Ionicons name="arrow-forward" size={16} color="#FF6B00" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FFF5EE',
    top: -50,
    right: -50,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFE5D4',
    bottom: -30,
    left: -40,
  },
  logoContainer: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#FFF5EE',
    borderRadius: 75,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFE5D4',
  },
  logo: {
    width: 100,
    height: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 40,
  },
  loadingBarContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  loadingBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loadingBarFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 2,
  },
  skipButton: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EE',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE5D4',
  },
  skipButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
});