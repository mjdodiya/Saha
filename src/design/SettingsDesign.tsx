import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SettingsItem = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  backgroundColor: string;
  onPress?: () => void;
};

const iconColors = {
  bluetooth: '#3159DB',
  eye: '#1C9AB4',
  notifications: '#8854E8',
  lock: '#13966A',
  info: '#8A8A86',
} as const;

export type SettingsDesignProps = {
  onBluetoothPress: () => void;
  onNearbyVisibilityPress: () => void;
  onNotificationsPress: () => void;
  onPrivacyPress: () => void;
  onAboutPress: () => void;
};

export function SettingsDesign({
  onBluetoothPress,
  onNearbyVisibilityPress,
  onNotificationsPress,
  onPrivacyPress,
  onAboutPress,
}: SettingsDesignProps) {
  const items: SettingsItem[] = [
    {
      label: 'Bluetooth',
      icon: 'bluetooth',
      color: iconColors.bluetooth,
      backgroundColor: '#DCE4FF',
      onPress: onBluetoothPress,
    },
    {
      label: 'Nearby visibility',
      icon: 'eye',
      color: iconColors.eye,
      backgroundColor: '#D5EFF3',
      onPress: onNearbyVisibilityPress,
    },
    {
      label: 'Notifications',
      icon: 'notifications',
      color: iconColors.notifications,
      backgroundColor: '#E9DFFF',
      onPress: onNotificationsPress,
    },
    {
      label: 'Privacy',
      icon: 'lock-closed-outline',
      color: iconColors.lock,
      backgroundColor: '#D5EFE5',
      onPress: onPrivacyPress,
    },
    {
      label: 'About SAHA',
      icon: 'information-circle-outline',
      color: iconColors.info,
      backgroundColor: '#E2E2E0',
      onPress: onAboutPress,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.settingsList}>
          {items.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={item.onPress}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: item.backgroundColor },
                ]}>
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={item.color}
                />
              </View>
              <Text style={styles.label}>{item.label}</Text>
              <Ionicons
                name="chevron-forward"
                size={15}
                color="#C4C4C0"
              />
            </Pressable>
          ))}
        </View>
        <Text style={styles.version}>SAHA v0.9.2 · offline-first</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F6F2' },
  content: { flex: 1, paddingHorizontal: 34, paddingTop: 22 },
  title: {
    color: '#111820',
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 20,
  },
  settingsList: {
    overflow: 'hidden',
    borderRadius: 13,
    paddingVertical: 4,
    backgroundColor: '#ECEBE9',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 11,
  },
  iconBox: {
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  label: { flex: 1, color: '#18212A', fontSize: 11 },
  version: {
    marginTop: 29,
    color: '#C0C0BB',
    fontFamily: 'monospace',
    fontSize: 9,
    textAlign: 'center',
  },
  pressed: { opacity: 0.65 },
});
