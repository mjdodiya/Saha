import { Stack, useRouter } from 'expo-router';

import { SettingsDesign } from '@/design/SettingsDesign';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SettingsDesign
        onBluetoothPress={() => router.push('/nearby')}
        onNearbyVisibilityPress={() => router.push('/nearby')}
        onNotificationsPress={() => undefined}
        onPrivacyPress={() => undefined}
        onAboutPress={() => undefined}
      />
    </>
  );
}
