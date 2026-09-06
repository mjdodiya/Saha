import { Tabs } from 'expo-router';

import { SahaTabBar } from '@/design/SahaTabBar';

export default function RootLayout() {
  return (
    <Tabs
      tabBar={(props) => <SahaTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#F6F3EC' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' }}
      />
      <Tabs.Screen
        name="nearby"
        options={{ title: 'Nearby' }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Messages' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings' }}
      />
      <Tabs.Screen
        name="scanner"
        options={{ href: null }}
      />
    </Tabs>
  );
}
