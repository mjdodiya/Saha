import { StatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F6F3EC"
      />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>SAHA / PREFERENCES</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Keep your local network exactly how you like it.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connection</Text>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>Advertise this device</Text>
              <Text style={styles.rowText}>
                Let nearby SAHA nodes discover you.
              </Text>
            </View>
            <Switch
              value
              trackColor={{ false: '#D9D6CE', true: '#A8D8BD' }}
              thumbColor="#167A51"
            />
          </View>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>Node identity</Text>
              <Text style={styles.rowText}>N7 · This device</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>SAHA version</Text>
              <Text style={styles.rowText}>
                1.0.0 · Offline-first messaging
              </Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F3EC' },
  content: { flex: 1, paddingHorizontal: 22, paddingTop: 28 },
  eyebrow: {
    color: '#167A51',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: { marginTop: 10, color: '#17221D', fontSize: 34, fontWeight: '900' },
  subtitle: { marginTop: 8, color: '#70766F', fontSize: 15, lineHeight: 22 },
  section: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#DDD8CD' },
  sectionTitle: {
    marginBottom: 4,
    paddingTop: 14,
    color: '#8A8D84',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E0D4',
  },
  copy: { flex: 1 },
  rowTitle: { color: '#17221D', fontSize: 15, fontWeight: '800' },
  rowText: { marginTop: 4, color: '#7C8179', fontSize: 13 },
  chevron: { color: '#167A51', fontSize: 28, fontWeight: '300' },
});
