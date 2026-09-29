import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { clearWishlist, readWishlist, setWishlistSaved, subscribeWishlist, WishlistCoupon, WishlistLoginError } from '../constants/wishlist';

export function useWishlist() {
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
    if (busy.current || loading || !ready) return;
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
    if (busy.current || loading || !ready || !items.length) return;
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
