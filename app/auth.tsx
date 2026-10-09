// app/auth.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;

export default function AuthScreen() {
  const router = useRouter();

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Signup state
  const [showSignup, setShowSignup] = useState(false);
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address_line1: '',
    address_line2: '',
    city: '',
    district: '',
    pincode: '',
    country: '',
  });
  const [signupError, setSignupError] = useState('');

  // Handle Login
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      setLoginError('Please fill in all fields');
      return;
    }

    setAuthLoading(true);
    setLoginError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        await AsyncStorage.setItem('userToken', data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(data.data));
        Alert.alert('Success', data.message || 'Logged in successfully!');
        router.replace('/(tabs)');
      } else {
        setLoginError(data.message || 'Login failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Debug URL', `Trying to hit: ${API_BASE_URL}/api/auth/login\n\nError: ${error.message}`);
      setLoginError('Network error. Please check your connection.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Signup
  const handleSignup = async () => {
    if (!signupData.name || !signupData.email || !signupData.password || !signupData.phone) {
      setSignupError('Please fill in all required fields');
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }

    if (signupData.password.length < 6) {
      setSignupError('Password must be at least 6 characters');
      return;
    }

    setAuthLoading(true);
    setSignupError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: signupData.name,
          email: signupData.email,
          phone: signupData.phone,
          password: signupData.password,
          address_line1: signupData.address_line1,
          address_line2: signupData.address_line2,
          city: signupData.city,
          district: signupData.district,
          pincode: signupData.pincode,
          country: signupData.country,
          role: 'customer'
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        Alert.alert('Success', 'Account created successfully! Please login.');
        setShowSignup(false);
        setLoginEmail(signupData.email);
        setLoginPassword(signupData.password);
        setSignupData({
          name: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
          address_line1: '',
          address_line2: '',
          city: '',
          district: '',
          pincode: '',
          country: '',
        });
      } else {
        setSignupError(data.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError('Network error. Please check your connection.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle demo login
  const handleDemoLogin = async () => {
    const demoData = {
      id: 1,
      name: 'John Doe',
      email: 'johndoe@example.com',
      phone: '+1 212-555-0000',
      address_line1: '123 Madison Ave',
      address_line2: 'Apartment 4B',
      city: 'New York',
      district: 'Manhattan',
      pincode: '10016',
      country: 'USA',
      role: 'customer',
      created_at: '2026-07-04T12:00:00Z'
    };
    await AsyncStorage.setItem('userToken', 'demo-token');
    await AsyncStorage.setItem('userData', JSON.stringify(demoData));
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={require('../assets/images/Roameo-logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Welcome to Roameo</Text>
            <Text style={styles.subtitle}>Your travel companion for exploring the world</Text>
          </View>

          {!showSignup ? (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Login</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#8E8E93"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#8E8E93"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry
                />
              </View>

              {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleLogin}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.authButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.switchButton}
                onPress={() => {
                  setShowSignup(true);
                  setLoginError('');
                }}
              >
                <Text style={styles.switchText}>
                  Don't have an account? <Text style={styles.switchLink}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
{/* 
              <TouchableOpacity 
                style={styles.demoButton}
                onPress={handleDemoLogin}
              >
                <Text style={styles.demoButtonText}>Try Demo Account</Text>
              </TouchableOpacity> */}
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.formTitle}>Create Account</Text>
              
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name *"
                  placeholderTextColor="#8E8E93"
                  value={signupData.name}
                  onChangeText={(text) => setSignupData({...signupData, name: text})}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email *"
                  placeholderTextColor="#8E8E93"
                  value={signupData.email}
                  onChangeText={(text) => setSignupData({...signupData, email: text})}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Phone Number *"
                  placeholderTextColor="#8E8E93"
                  value={signupData.phone}
                  onChangeText={(text) => setSignupData({...signupData, phone: text})}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password * (min 6 chars)"
                  placeholderTextColor="#8E8E93"
                  value={signupData.password}
                  onChangeText={(text) => setSignupData({...signupData, password: text})}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password *"
                  placeholderTextColor="#8E8E93"
                  value={signupData.confirmPassword}
                  onChangeText={(text) => setSignupData({...signupData, confirmPassword: text})}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Address Line 1"
                  placeholderTextColor="#8E8E93"
                  value={signupData.address_line1}
                  onChangeText={(text) => setSignupData({...signupData, address_line1: text})}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="location-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Address Line 2"
                  placeholderTextColor="#8E8E93"
                  value={signupData.address_line2}
                  onChangeText={(text) => setSignupData({...signupData, address_line2: text})}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Ionicons name="business-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    placeholderTextColor="#8E8E93"
                    value={signupData.city}
                    onChangeText={(text) => setSignupData({...signupData, city: text})}
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Ionicons name="map-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="District"
                    placeholderTextColor="#8E8E93"
                    value={signupData.district}
                    onChangeText={(text) => setSignupData({...signupData, district: text})}
                  />
                </View>
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Ionicons name="pin-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Pincode"
                    placeholderTextColor="#8E8E93"
                    value={signupData.pincode}
                    onChangeText={(text) => setSignupData({...signupData, pincode: text})}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Ionicons name="globe-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Country"
                    placeholderTextColor="#8E8E93"
                    value={signupData.country}
                    onChangeText={(text) => setSignupData({...signupData, country: text})}
                  />
                </View>
              </View>

              {signupError ? <Text style={styles.errorText}>{signupError}</Text> : null}

              <TouchableOpacity 
                style={styles.authButton}
                onPress={handleSignup}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.authButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.switchButton}
                onPress={() => {
                  setShowSignup(false);
                  setSignupError('');
                }}
              >
                <Text style={styles.switchText}>
                  Already have an account? <Text style={styles.switchLink}>Login</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 150,
    height: 70,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  authButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  switchLink: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  demoButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  demoButtonText: {
    color: '#1C1C1E',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
});