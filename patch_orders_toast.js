const fs = require('fs');

function patchCustomer() {
  const path = 'app/(tabs)/orders.tsx';
  let c = fs.readFileSync(path, 'utf8');

  // Add issueSuccessMessage state
  c = c.replace(
    /const \[isSubmittingIssue, setIsSubmittingIssue\] = useState\(false\);/,
    "const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);\n  const [issueSuccessMessage, setIssueSuccessMessage] = useState<string | null>(null);"
  );

  // Replace alert() with setIssueSuccessMessage()
  c = c.replace(
    /alert\('Your issue has been reported and sent to the vendor\.'\);/,
    "setIssueSuccessMessage('Your issue has been reported and sent to the vendor.');\n        setTimeout(() => setIssueSuccessMessage(null), 3000);"
  );

  c = c.replace(
    /alert\(data\.message \|\| 'Failed to submit issue'\);/,
    "setIssueSuccessMessage(data.message || 'Failed to submit issue');\n        setTimeout(() => setIssueSuccessMessage(null), 3000);"
  );

  c = c.replace(
    /alert\('Network error while reporting issue\.'\);/,
    "setIssueSuccessMessage('Network error while reporting issue.');\n      setTimeout(() => setIssueSuccessMessage(null), 3000);"
  );

  // Replace UI
  const uiCode = `{/* Report Issue Section */}
                <View style={{ marginTop: 24, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 }}>
                  {issueSuccessMessage ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <Text style={{ marginLeft: 6, color: '#10B981', fontWeight: '600', fontSize: 14 }}>
                        {issueSuccessMessage}
                      </Text>
                    </View>
                  ) : !isReportingIssue ? (`;
  
  c = c.replace(
    /\{\/\* Report Issue Section \*\/\}\r?\n\s*<View style=\{\{ marginTop: 24, padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12 \}\}>\r?\n\s*\{\!isReportingIssue \? \(/,
    uiCode
  );

  fs.writeFileSync(path, c);
  console.log('Customer orders patched');
}

patchCustomer();
