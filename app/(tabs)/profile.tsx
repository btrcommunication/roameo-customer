import { WishlistNotice } from '../../components/WishlistNotice';
import { useWishlist } from '../../hooks/useWishlist';
// app/(tabs)/profile.tsx
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
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

export default function ProfileScreen() {
  const router = useRouter();
  const wishlist = useWishlist();
  
  // State variables
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    district: '',
    pincode: '',
    country: '',
    street: '',
    street2: '',
    street3: '',
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addressData, setAddressData] = useState({
    street: '',
    street2: '',
    street3: '',
    city: '',
    district: '',
    pincode: '',
    country: '',
  });

  // Fetch profile data on component mount
  useFocusEffect(useCallback(() => {
    void checkAuthAndFetchProfile();
  }, []));

  // Check authentication and fetch profile
  const checkAuthAndFetchProfile = async () => {
    try {
      setLoading(true);
      const storedToken = await AsyncStorage.getItem('userToken');
      const storedUser = await AsyncStorage.getItem('userData');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setIsLoggedIn(true);
        const parsedUser = JSON.parse(storedUser);
        setUserData(parsedUser);
        await fetchProfile(storedToken);
      } else {
        setIsLoggedIn(false);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      setIsLoggedIn(false);
      setLoading(false);
    }
  };

  // Fetch profile from API
  const fetchProfile = async (authToken?: string) => {
    try {
      const tokenToUse = authToken || token;
      
      if (!tokenToUse) {
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenToUse}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          setUserData(data.data);
          await AsyncStorage.setItem('userData', JSON.stringify(data.data));
          setIsLoggedIn(true);
        }
      }
    } catch (error) {
      console.log('Profile endpoint not available, using stored data');
    } finally {
      setLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setIsLoggedIn(false);
      setUserData(null);
      setToken(null);
      Alert.alert('Logged Out', 'You have been logged out successfully.');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Open edit modal
  const openEditModal = () => {
    if (userData) {
      setEditData({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        city: userData.city || '',
        district: userData.district || '',
        pincode: userData.pincode || '',
        country: userData.country || '',
        street: userData.street || '',
        street2: userData.street2 || '',
        street3: userData.street3 || '',
      });
      setEditModalVisible(true);
    }
  };

  // Open Address Modal
  const openAddressModal = () => {
    if (userData) {
      setAddressData({
        street: userData.street || '',
        street2: userData.street2 || '',
        street3: userData.street3 || '',
        city: userData.city || '',
        district: userData.district || '',
        pincode: userData.pincode || '',
        country: userData.country || '',
      });
      setAddressModalVisible(true);
    }
  };

  // Handle Address Update
  const handleUpdateAddress = async () => {
    try {
      setUpdating(true);

      // Try multiple endpoints
      const endpoints = [
        `${API_BASE_URL}/api/profile`,
        `${API_BASE_URL}/api/user/profile`,
        `${API_BASE_URL}/api/auth/profile`,
        `${API_BASE_URL}/api/update-profile`,
      ];

      let success = false;
      let updatedData = { ...userData, ...addressData };

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatedData),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
              setUserData(data.data || updatedData);
              await AsyncStorage.setItem('userData', JSON.stringify(data.data || updatedData));
              setAddressModalVisible(false);
              Alert.alert('Success', 'Address updated successfully!');
              success = true;
              break;
            }
          } else if (response.status === 404) {
            continue;
          }
        } catch (e) {
          continue;
        }
      }

      if (!success) {
        // Update locally
        setUserData(updatedData);
        await AsyncStorage.setItem('userData', JSON.stringify(updatedData));
        setAddressModalVisible(false);
        Alert.alert('Success', 'Address updated locally!');
      }

    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle profile update
  const handleUpdateProfile = async () => {
    try {
      setUpdating(true);
      
      const endpoints = [
        `${API_BASE_URL}/api/profile`,
        `${API_BASE_URL}/api/user/profile`,
        `${API_BASE_URL}/api/auth/profile`,
        `${API_BASE_URL}/api/update-profile`,
      ];

      let success = false;
      let updatedData = { ...userData, ...editData };

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(editData),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
              setUserData(data.data || editData);
              await AsyncStorage.setItem('userData', JSON.stringify(data.data || editData));
              setEditModalVisible(false);
              Alert.alert('Success', 'Profile updated successfully!');
              success = true;
              break;
            }
          } else if (response.status === 404) {
            continue;
          }
        } catch (e) {
          continue;
        }
      }

      if (!success) {
        setUserData(editData);
        await AsyncStorage.setItem('userData', JSON.stringify(editData));
        setEditModalVisible(false);
        Alert.alert('Success', 'Profile updated locally!');
      }

    } catch (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  // Navigate to login
  const navigateToLogin = () => {
    router.push('/auth');
  };

  // Stats data
  const stats = [
    { id: '1', label: 'Bookings', subLabel: 'Completed', value: userData?.bookings_count || '0', icon: 'shopping-bag', color: '#FF6B00', bg: '#FFF0E5' },
    { id: '2', label: 'Rating', subLabel: 'Reviews', value: userData?.rating || '4.8', icon: 'star', color: '#4CAF50', bg: '#E8F5E9' },
    { id: '3', label: 'Points', subLabel: 'View Rewards', value: userData?.points || '2,450', icon: 'gift', color: '#9C27B0', bg: '#F3E5F5' },
    { id: '4', label: 'Wishlist', subLabel: 'Saved', value: wishlist.loading ? '...' : wishlist.ready ? String(wishlist.items.length) : '--', icon: 'heart', color: '#2196F3', bg: '#E3F2FD' },
  ];

  // Menu items
  const menuItems = [
    { icon: 'person-outline', label: 'Personal Information', subtitle: 'Manage your personal details', action: 'edit' },
    { icon: 'card-outline', label: 'Payment Methods', subtitle: 'Cards, wallets and more', action: 'payment' },
    { icon: 'location-outline', label: 'Addresses', subtitle: 'Manage your saved addresses', action: 'address' },
    { icon: 'options-outline', label: 'Preferences', subtitle: 'Notifications, language and more', action: 'preferences' },
    { icon: 'help-circle-outline', label: 'Help & Support', subtitle: 'FAQs, contact us and more', action: 'support' },
    { icon: 'shield-checkmark-outline', label: 'Privacy & Security', subtitle: 'Manage your privacy settings', action: 'privacy' },
  ];

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render not logged in state
  if (!isLoggedIn || !userData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitleText}>Profile</Text>
          
          <View style={styles.rightHeaderControls}>
            <TouchableOpacity style={styles.iconHeaderButton}>
              <Ionicons name="notifications-outline" size={24} color="#1C1C1E" />
              <View style={styles.orangeAlertDot} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconHeaderButton, { marginLeft: 16 }]}
              onPress={navigateToLogin}
            >
              <Ionicons name="log-in-outline" size={24} color="#FF6B00" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.container} contentContainerStyle={styles.notLoggedInContainer}>
          {/* Profile Meta Container - Placeholder */}
          <View style={styles.profileMetaContainer}>
            <View style={styles.profileFlexRow}>
              <View style={styles.avatarWrapper}>
                <View style={[styles.avatarImage, styles.placeholderImage]} />
                <View style={styles.cameraIconBadge}>
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                </View>
              </View>
              
              <View style={styles.identityDetails}>
                <View style={styles.nameBadgeRow}>
                  <View style={[styles.placeholderText, { width: 120, height: 28 }]} />
                  <View style={[styles.placeholderText, { width: 60, height: 20, marginLeft: 8, borderRadius: 6 }]} />
                </View>
                <View style={[styles.placeholderText, { width: 80, height: 16, marginTop: 4 }]} />
                
                <View style={styles.locationMetaRow}>
                  <Ionicons name="location-outline" size={14} color="#8E8E93" />
                  <View style={[styles.placeholderText, { width: 100, height: 14, marginLeft: 4 }]} />
                </View>
                <View style={styles.calendarMetaRow}>
                  <Ionicons name="calendar-outline" size={13} color="#8E8E93" />
                  <View style={[styles.placeholderText, { width: 120, height: 12, marginLeft: 4 }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Stats Strip - Placeholder */}
          <View style={styles.statsStripContainer}>
            {[1, 2, 3, 4].map((item) => (
              <View key={item} style={styles.statModuleCard}>
                <View style={[styles.statIconContainer, { backgroundColor: '#F2F2F7' }]} />
                <View style={[styles.placeholderText, { width: 30, height: 20, marginTop: 4 }]} />
                <View style={[styles.placeholderText, { width: 40, height: 12, marginTop: 4 }]} />
                <View style={[styles.placeholderText, { width: 35, height: 10, marginTop: 2 }]} />
              </View>
            ))}
          </View>

          {/* Premium Banner - Placeholder */}
          <View style={styles.premiumBannerWrapper}>
            <View style={[styles.premiumBadgeIconBox, { backgroundColor: '#E5E5EA' }]} />
            <View style={styles.premiumTextContent}>
              <View style={[styles.placeholderText, { width: '80%', height: 16 }]} />
              <View style={[styles.placeholderText, { width: '60%', height: 12, marginTop: 4 }]} />
            </View>
            <View style={[styles.placeholderText, { width: 60, height: 20 }]} />
          </View>

          {/* Activity Block - Placeholder */}
          <View style={styles.activityBlockSection}>
            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionTitleText}>My Activity</Text>
              <Text style={styles.sectionViewAllText}>View All</Text>
            </View>
            
            <View style={styles.activityGridWrapper}>
              {[1, 2, 3, 4].map((item) => (
                <View key={item} style={styles.activityIndividualCell}>
                  <View style={styles.activityIconWrapperCircle}>
                    <Ionicons name="calendar-outline" size={18} color="#C7C7CC" />
                  </View>
                  <View style={[styles.placeholderText, { width: 25, height: 18 }]} />
                  <View style={[styles.placeholderText, { width: 40, height: 10, marginTop: 2 }]} />
                </View>
              ))}
            </View>
          </View>

          {/* Settings Menu - Placeholder */}
          <View style={styles.menuItemsFormBlock}>
            {menuItems.map((item, index) => (
              <View key={index} style={styles.menuItemRowContainer}>
                <View style={styles.menuItemLeftNodeWrapper}>
                  <View style={styles.menuItemIconBoxFrame}>
                    <Ionicons name={item.icon as any} size={20} color="#C7C7CC" />
                  </View>
                  <View style={styles.menuItemTextStack}>
                    <View style={[styles.placeholderText, { width: '70%', height: 14 }]} />
                    <View style={[styles.placeholderText, { width: '50%', height: 10, marginTop: 4 }]} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </View>
            ))}
          </View>

          {/* Login Button at bottom */}
          <TouchableOpacity style={styles.loginButtonLarge} onPress={navigateToLogin}>
            <Ionicons name="log-in-outline" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.loginButtonLargeText}>Login to your account</Text>
          </TouchableOpacity>
          
          <Text style={styles.loginHelperText}>
            Don't have an account? Sign up on the login page
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Render profile when logged in
  return (
    <SafeAreaView style={styles.safeArea}>
      <WishlistNotice error={wishlist.error} needsLogin={wishlist.needsLogin} retry={wishlist.refresh} />
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitleText}>Profile</Text>
        
        <View style={styles.rightHeaderControls}>
          <TouchableOpacity style={styles.iconHeaderButton}>
            <Ionicons name="notifications-outline" size={24} color="#1C1C1E" />
            <View style={styles.orangeAlertDot} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.iconHeaderButton, { marginLeft: 16 }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF6B00" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Profile Meta Container */}
        <TouchableOpacity style={styles.profileMetaContainer} onPress={openEditModal}>
          <View style={styles.profileFlexRow}>
            <View style={styles.avatarWrapper}>
              <Image 
                source={{ uri: userData?.avatar || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300' }} 
                style={styles.avatarImage} 
              />
              <View style={styles.cameraIconBadge}>
                <Ionicons name="camera" size={12} color="#FFFFFF" />
              </View>
            </View>
            
            <View style={styles.identityDetails}>
              <View style={styles.nameBadgeRow}>
                <Text style={styles.profileNameText}>{userData?.name || 'User'}</Text>
                <View style={styles.statusPillLabel}>
                  <Ionicons name="star" size={10} color="#FF6B00" style={{ marginRight: 2 }} />
                  <Text style={styles.statusPillText}>{userData?.role || 'Explorer'}</Text>
                </View>
              </View>
              <Text style={styles.userHandleText}>@{userData?.email?.split('@')[0] || 'user'}</Text>
              
              <View style={styles.locationMetaRow}>
                <Ionicons name="location-outline" size={14} color="#8E8E93" />
                <Text style={styles.locationMetaText}>
                  {userData?.city || 'Unknown'}, {userData?.country || 'Location'}
                </Text>
              </View>
              <View style={styles.calendarMetaRow}>
                <Ionicons name="calendar-outline" size={13} color="#8E8E93" />
                <Text style={styles.calendarMetaText}>
                  Member since {userData?.created_at ? new Date(userData.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Recently'}
                </Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#8E8E93" style={styles.profileAbsoluteChevron} />
        </TouchableOpacity>

        {/* Stats Strip */}
        <View style={styles.statsStripContainer}>
          {stats.map((stat) => (
            <TouchableOpacity key={stat.id} style={styles.statModuleCard} disabled={stat.label !== 'Wishlist'} onPress={() => router.push('/wishlist')} accessibilityRole="button">
              <View style={[styles.statIconContainer, { backgroundColor: stat.bg }]}>
                <Feather name={stat.icon as any} size={14} color={stat.color} />
              </View>
              <Text style={styles.statValueText}>{stat.value}</Text>
              <Text style={styles.statLabelMain} numberOfLines={1}>{stat.label}</Text>
              <Text style={styles.statLabelSub} numberOfLines={1}>{stat.subLabel}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Premium Banner */}
        <View style={styles.premiumBannerWrapper}>
          <View style={styles.premiumBadgeIconBox}>
            <MaterialCommunityIcons name="crown" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.premiumTextContent}>
            <Text style={styles.premiumTitleMainText}>Become a Roameo Premium Member</Text>
            <Text style={styles.premiumSubtitleDescText}>Unlock exclusive offers, early access and more benefits!</Text>
          </View>
          <TouchableOpacity style={styles.premiumActionTrigger}>
            <Text style={styles.premiumActionTriggerText}>Upgrade</Text>
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={14} color="#FF6B00" style={{ marginLeft: 4 }} />
        </View>

        {/* Settings Menu */}
        <View style={styles.menuItemsFormBlock}>
          {menuItems.map((item, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.menuItemRowContainer}
              onPress={() => {
                if (item.action === 'edit') {
                  openEditModal();
                } else if (item.action === 'address') {
                  openAddressModal();
                } else if (item.action === 'payment') {
                  Alert.alert('Payment Methods', 'Payment methods feature coming soon!');
                } else if (item.action === 'preferences') {
                  Alert.alert('Preferences', 'Preferences feature coming soon!');
                } else if (item.action === 'support') {
                  Alert.alert('Help & Support', 'Help & Support feature coming soon!');
                } else if (item.action === 'privacy') {
                  Alert.alert('Privacy & Security', 'Privacy & Security feature coming soon!');
                }
              }}
            >
              <View style={styles.menuItemLeftNodeWrapper}>
                <View style={styles.menuItemIconBoxFrame}>
                  <Ionicons name={item.icon as any} size={20} color="#1C1C1E" />
                </View>
                <View style={styles.menuItemTextStack}>
                  <Text style={styles.menuItemMainLabelText}>{item.label}</Text>
                  <Text style={styles.menuItemSubtextDescription}>{item.subtitle}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Full Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.name}
                  onChangeText={(text) => setEditData({...editData, name: text})}
                  placeholder="Enter your full name"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Email</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.email}
                  onChangeText={(text) => setEditData({...editData, email: text})}
                  placeholder="Enter your email"
                  placeholderTextColor="#8E8E93"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Phone</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.phone}
                  onChangeText={(text) => setEditData({...editData, phone: text})}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#8E8E93"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Street Address</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.street}
                  onChangeText={(text) => setEditData({...editData, street: text})}
                  placeholder="Enter street address"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Street Address 2</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.street2}
                  onChangeText={(text) => setEditData({...editData, street2: text})}
                  placeholder="Enter street address 2"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Street Address 3</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.street3}
                  onChangeText={(text) => setEditData({...editData, street3: text})}
                  placeholder="Enter street address 3"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.editRowContainer}>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>City</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editData.city}
                    onChangeText={(text) => setEditData({...editData, city: text})}
                    placeholder="City"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>District</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editData.district}
                    onChangeText={(text) => setEditData({...editData, district: text})}
                    placeholder="District"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
              </View>

              <View style={styles.editRowContainer}>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>Pincode</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editData.pincode}
                    onChangeText={(text) => setEditData({...editData, pincode: text})}
                    placeholder="Pincode"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>Country</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editData.country}
                    onChangeText={(text) => setEditData({...editData, country: text})}
                    placeholder="Country"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleUpdateProfile}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Address Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addressModalVisible}
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Address</Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Street Address</Text>
                <TextInput
                  style={styles.editInput}
                  value={addressData.street}
                  onChangeText={(text) => setAddressData({...addressData, street: text})}
                  placeholder="Enter street address"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Street Address 2</Text>
                <TextInput
                  style={styles.editInput}
                  value={addressData.street2}
                  onChangeText={(text) => setAddressData({...addressData, street2: text})}
                  placeholder="Enter street address 2"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.editInputContainer}>
                <Text style={styles.editLabel}>Street Address 3</Text>
                <TextInput
                  style={styles.editInput}
                  value={addressData.street3}
                  onChangeText={(text) => setAddressData({...addressData, street3: text})}
                  placeholder="Enter street address 3"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.editRowContainer}>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>City</Text>
                  <TextInput
                    style={styles.editInput}
                    value={addressData.city}
                    onChangeText={(text) => setAddressData({...addressData, city: text})}
                    placeholder="City"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>District</Text>
                  <TextInput
                    style={styles.editInput}
                    value={addressData.district}
                    onChangeText={(text) => setAddressData({...addressData, district: text})}
                    placeholder="District"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
              </View>

              <View style={styles.editRowContainer}>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>Pincode</Text>
                  <TextInput
                    style={styles.editInput}
                    value={addressData.pincode}
                    onChangeText={(text) => setAddressData({...addressData, pincode: text})}
                    placeholder="Pincode"
                    placeholderTextColor="#8E8E93"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.editInputContainer, styles.halfWidth]}>
                  <Text style={styles.editLabel}>Country</Text>
                  <TextInput
                    style={styles.editInput}
                    value={addressData.country}
                    onChangeText={(text) => setAddressData({...addressData, country: text})}
                    placeholder="Country"
                    placeholderTextColor="#8E8E93"
                  />
                </View>
              </View>

              {/* Current Address Display */}
              <View style={styles.currentAddressContainer}>
                <Text style={styles.currentAddressTitle}>Current Address:</Text>
                <Text style={styles.currentAddressText}>
                  {addressData.street || 'No street address'}
                  {addressData.street2 ? `, ${addressData.street2}` : ''}
                  {addressData.street3 ? `, ${addressData.street3}` : ''}
                  {addressData.city ? `, ${addressData.city}` : ''}
                  {addressData.district ? `, ${addressData.district}` : ''}
                  {addressData.pincode ? ` - ${addressData.pincode}` : ''}
                  {addressData.country ? `, ${addressData.country}` : ''}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setAddressModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleUpdateAddress}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Address</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 14,
  },
  notLoggedInContainer: {
    paddingBottom: 40,
  },
  placeholderImage: {
    backgroundColor: '#E5E5EA',
  },
  placeholderText: {
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerTitleText: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  rightHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconHeaderButton: {
    padding: 4,
    position: 'relative',
  },
  orangeAlertDot: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF6B00',
    borderWidth: 1,
    borderColor: '#FAFAFA',
  },
  profileMetaContainer: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  profileFlexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E5E5EA',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FAFAFA',
  },
  identityDetails: {
    marginLeft: 16,
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  profileNameText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  statusPillLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0E5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
    marginTop: 2,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF6B00',
  },
  userHandleText: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  locationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationMetaText: {
    fontSize: 13,
    color: '#3A3A3C',
    marginLeft: 4,
  },
  calendarMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  calendarMetaText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 4,
  },
  profileAbsoluteChevron: {
    position: 'absolute',
    right: 16,
  },
  statsStripContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  statModuleCard: {
    width: '23%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  statLabelMain: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 2,
    textAlign: 'center',
  },
  statLabelSub: {
    fontSize: 9,
    color: '#8E8E93',
    marginTop: 1,
    textAlign: 'center',
  },
  premiumBannerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    borderWidth: 1,
    borderColor: '#FFE5D4',
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 14,
    marginBottom: 20,
  },
  premiumBadgeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumTextContent: {
    marginLeft: 12,
    flex: 1,
    paddingRight: 4,
  },
  premiumTitleMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  premiumSubtitleDescText: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
    lineHeight: 14,
  },
  premiumActionTrigger: {
    paddingVertical: 4,
  },
  premiumActionTriggerText: {
    color: '#FF6B00',
    fontSize: 12,
    fontWeight: '700',
  },
  menuItemsFormBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    marginBottom: 20,
  },
  menuItemRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  menuItemLeftNodeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIconBoxFrame: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemTextStack: {
    flex: 1,
  },
  menuItemMainLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  menuItemSubtextDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  loginButtonLarge: {
    flexDirection: 'row',
    backgroundColor: '#FF6B00',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginButtonLargeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginHelperText: {
    textAlign: 'center',
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  modalContent: {
    padding: 16,
  },
  editInputContainer: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  editInput: {
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  editRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#1C1C1E',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  currentAddressContainer: {
    backgroundColor: '#F8F8FA',
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  currentAddressTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  currentAddressText: {
    fontSize: 13,
    color: '#3A3A3C',
    lineHeight: 18,
  },
});