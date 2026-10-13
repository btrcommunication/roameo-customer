import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type LoginPromptState = {
  visible: boolean;
  message: string;
};

type Listener = (state: LoginPromptState) => void;
const listeners = new Set<Listener>();

export function promptLogin(message = 'Please log in or register to continue.') {
  listeners.forEach(listener => listener({ visible: true, message }));
}

export function closeLoginPrompt() {
  listeners.forEach(listener => listener({ visible: false, message: '' }));
}

export function LoginPromptModal() {
  const router = useRouter();
  const [modalState, setModalState] = useState<LoginPromptState>({
    visible: false,
    message: '',
  });

  useEffect(() => {
    const listener: Listener = (state) => setModalState(state);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const handleDismiss = () => {
    setModalState({ visible: false, message: '' });
  };

  const handleLogin = () => {
    handleDismiss();
    router.push('/auth' as any);
  };

  if (!modalState.visible) return null;

  return (
    <Modal
      transparent
      visible={modalState.visible}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="lock-closed" size={30} color="#FF6B00" />
              </View>

              <Text style={styles.title}>Login Required</Text>
              <Text style={styles.message}>
                {modalState.message || 'Please log in or register to continue.'}
              </Text>

              <TouchableOpacity
                style={styles.loginButton}
                activeOpacity={0.85}
                onPress={handleLogin}
              >
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.loginButtonText}>Sign In / Register</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.7}
                onPress={handleDismiss}
              >
                <Text style={styles.cancelButtonText}>Continue Browsing</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF4EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE3D1',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loginButton: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    width: '100%',
    backgroundColor: '#F2F2F7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#636366',
    fontSize: 14,
    fontWeight: '600',
  },
});
