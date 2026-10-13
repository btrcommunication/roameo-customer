import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { promptLogin } from '../components/LoginPromptModal';
import { clearWishlist, readWishlist, setWishlistSaved, subscribeWishlist, WishlistCoupon, WishlistLoginError } from '../constants/wishlist';

export function useWishlist() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const busy = useRef(false);
  const active = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const next = await readWishlist();
      if (!active.current || current !== generation.current) return;
      setItems(next); setError(''); setNeedsLogin(false); setReady(true);
    } catch (cause) {
      if (!active.current || current !== generation.current) return;
      setItems([]); setReady(false);
      setNeedsLogin(cause instanceof WishlistLoginError);
      setError(cause instanceof Error ? cause.message : 'Unable to load wishlist.');
    } finally {
      if (active.current && current === generation.current) setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    active.current = true;
    void refresh();
    const unsubscribe = subscribeWishlist(() => { void refresh(); });
    return () => { active.current = false; generation.current++; unsubscribe(); };
  }, [refresh]));
  const toggle = async (id: number) => {
    if (busy.current || loading) return;
    const token = await AsyncStorage.getItem('userToken');
    if (!token || token === 'demo-token') {
      promptLogin('Please log in or register to save items to your wishlist.');
      return;
    }
    if (!ready) return;
    busy.current = true; setPending(id); setError('');
    try { await setWishlistSaved(id, !items.some(item => item.id === id)); }
    catch (cause) {
      if (active.current) {
        setNeedsLogin(cause instanceof WishlistLoginError);
        setError(cause instanceof Error ? cause.message : 'Unable to update wishlist.');
      }
    } finally { busy.current = false; if (active.current) setPending(null); }
  };
  const removeAll = async () => {
    if (busy.current || loading || !items.length) return;
    const token = await AsyncStorage.getItem('userToken');
    if (!token || token === 'demo-token') {
      promptLogin('Please log in or register to manage your wishlist.');
      return;
    }
    if (!ready) return;
    busy.current = true; setPending(0); setError('');
    try {
      await clearWishlist();
      if (active.current) setItems([]);
    } catch (cause) {
      if (active.current) {
        setNeedsLogin(cause instanceof WishlistLoginError);
        setError(cause instanceof Error ? cause.message : 'Unable to clear wishlist.');
      }
    } finally { busy.current = false; if (active.current) setPending(null); }
  };
  return { items, loading, ready, error, needsLogin, pending, refresh, toggle, removeAll,
    isSaved: (id: number) => items.some(item => item.id === Number(id)) };
}
