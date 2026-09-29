import { useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export function WishlistNotice({ error, needsLogin, retry }: { error: string; needsLogin: boolean; retry: () => void }) {
  const router = useRouter();
  if (!error) return null;
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: '#FFF3E8', padding: 12 }}>
    <Text style={{ color: '#713500' }}>{error}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => needsLogin ? router.push('/auth') : retry()} style={{ paddingVertical: 8 }}>
      <Text style={{ color: '#B44900', fontWeight: '700' }}>{needsLogin ? 'Log in' : 'Retry wishlist'}</Text>
    </TouchableOpacity>
  </View>;
}
