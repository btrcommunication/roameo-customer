const fs = require('fs');
let c = fs.readFileSync('app/(tabs)/index.tsx', 'utf8');

// 1. Add Modal state
c = c.replace(
  'const [visibleCategoryCount, setVisibleCategoryCount] = useState(CATEGORY_VISIBLE_COUNT);',
  `const [visibleCategoryCount, setVisibleCategoryCount] = useState(CATEGORY_VISIBLE_COUNT);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true);
      const token = await AsyncStorage.getItem('userToken');
      // Using an open endpoint if token is missing just to show broadcast notifications
      const headers = token ? { Authorization: \`Bearer \${token}\` } : {};
      const res = await fetch(\`\${process.env.EXPO_PUBLIC_BASE_URL}/api/profile/notifications\`, { headers });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.log('Failed to fetch notifications', e);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const openNotifications = () => {
    setNotificationsModalVisible(true);
    fetchNotifications();
  };
`
);

// 2. Change bell icon onPress
c = c.replace(
  '<TouchableOpacity style={styles.headerIconBtn} onPress={() => { /* notification action */ }}>',
  '<TouchableOpacity style={styles.headerIconBtn} onPress={openNotifications}>'
);

// 3. Add Modal UI before closing SafeAreaView
const modalUI = `
      {/* Notifications Modal */}
      <Modal visible={notificationsModalVisible} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {loadingNotifications ? (
              <ActivityIndicator color="#FF6B00" style={{ marginVertical: 30 }} />
            ) : notifications.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 40 }}>
                <Ionicons name="notifications-off-outline" size={50} color="#ccc" />
                <Text style={{ marginTop: 10, color: '#666' }}>No new notifications</Text>
              </View>
            ) : (
              <ScrollView>
                {notifications.map((n: any, i) => (
                  <View key={i} style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 10 }}>
                    {n.image_url ? (
                      <Image source={{ uri: \`\${process.env.EXPO_PUBLIC_BASE_URL}\${n.image_url}\` }} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12 }} />
                    ) : (
                      <View style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: '#E5E7EB', marginRight: 12, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="notifications" size={24} color="#FF6B00" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{n.title}</Text>
                      <Text style={{ color: '#666', marginTop: 4 }}>{n.message}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
`;

c = c.replace(/(<\/SafeAreaView>)/, modalUI + '\n$1');

fs.writeFileSync('app/(tabs)/index.tsx', c);
console.log('Patched customer index.tsx');
