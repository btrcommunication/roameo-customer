const fs = require('fs');

function patchCustomer() {
  const path = 'app/(tabs)/orders.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Add TextInput import
  c = c.replace(/Text,\r?\n\s*TouchableOpacity,\r?\n\s*View/, 'Text,\n  TextInput,\n  TouchableOpacity,\n  View');
  
  // Add AsyncStorage import
  c = c.replace(
    /import \{ SafeAreaView \} from 'react-native-safe-area-context';/, 
    "import { SafeAreaView } from 'react-native-safe-area-context';\nimport AsyncStorage from '@react-native-async-storage/async-storage';"
  );

  // Add submitIssue function
  const submitCode = `    } finally {
      if (active.current && current === generation.current) setLoading(false);
    }
  }, [orderId, router]);

  const submitIssue = async () => {
    if (!issueText.trim() || !selectedOrder || !selectedOrder.items[0]) return;
    setIsSubmittingIssue(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(\`\${process.env.EXPO_PUBLIC_BASE_URL}/api/cart/orders/\${selectedOrder.id}/issues\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
        body: JSON.stringify({
          issue_text: issueText,
          coupon_id: selectedOrder.items[0].coupon_id
        })
      });
      if (res.ok) {
        alert('Your issue has been reported and sent to the vendor.');
        setIssueText('');
        setIsReportingIssue(false);
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to submit issue');
      }
    } catch (err) {
      alert('Network error while reporting issue.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };`;

  c = c.replace(/\}\s*finally\s*\{\s*if\s*\(active\.current\s*&&\s*current\s*===\s*generation\.current\)\s*setLoading\(false\);\s*\}\s*\},\s*\[orderId,\s*router\]\);/s, submitCode);

  // Add UI
  const uiCode = `                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total</Text>
                  <Text style={styles.modalTotalValue}>
                    {money(selectedOrder.total_amount, selectedOrder.currency)}
                  </Text>
                </View>

                {/* Report Issue Section */}
                <View style={{ marginTop: 24, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 }}>
                  {!isReportingIssue ? (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => setIsReportingIssue(true)}
                    >
                      <Ionicons name="warning-outline" size={18} color="#D97706" />
                      <Text style={{ marginLeft: 6, color: '#D97706', fontWeight: '600', fontSize: 15 }}>
                        Report an Issue
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>
                        Describe your issue
                      </Text>
                      <TextInput
                        style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', color: '#111827' }}
                        multiline
                        placeholder="What went wrong?"
                        placeholderTextColor="#9CA3AF"
                        value={issueText}
                        onChangeText={setIssueText}
                        editable={!isSubmittingIssue}
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 }}>
                        <TouchableOpacity onPress={() => setIsReportingIssue(false)} disabled={isSubmittingIssue}>
                          <Text style={{ color: '#6B7280', fontWeight: '600', padding: 8 }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={{ backgroundColor: '#D97706', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, opacity: isSubmittingIssue || !issueText.trim() ? 0.6 : 1 }}
                          onPress={submitIssue}
                          disabled={isSubmittingIssue || !issueText.trim()}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600' }}>
                            {isSubmittingIssue ? 'Sending...' : 'Submit'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>`;

  c = c.replace(/<\s*View\s*style=\{styles\.modalTotalRow\}>\s*<Text\s*style=\{styles\.modalTotalLabel\}>Total<\/Text>\s*<Text\s*style=\{styles\.modalTotalValue\}>\s*\{money\(selectedOrder\.total_amount,\s*selectedOrder\.currency\)\}\s*<\/Text>\s*<\/View>\s*<\/ScrollView>\s*\)\}\s*<\/View>\s*<\/View>\s*<\/Modal>/s, uiCode);

  fs.writeFileSync(path, c);
  console.log('Customer orders patched');
}

patchCustomer();
