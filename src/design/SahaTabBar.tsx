import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type TabRoute = {
  key: string;
  name: string;
};

type TabBarProps = {
  state: {
    index: number;
    routes: TabRoute[];
  };
  navigation: {
    emit: (event: any) => any;
    navigate: (name: string) => void;
  };
  insets: {
    bottom: number;
  };
};

const tabDesign = {
  index: { label: 'Home', icon: 'home-outline' },
  nearby: { label: 'Nearby', icon: 'bluetooth-outline' },
  chat: { label: 'Messages', icon: 'chatbubble-ellipses-outline' },
  settings: { label: 'Settings', icon: 'settings-outline' },
} as const;

type IconName = ComponentProps<typeof Ionicons>['name'];

export function SahaTabBar({ state, navigation, insets }: TabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const design = tabDesign[route.name as keyof typeof tabDesign];
        if (!design) return null;

        const isFocused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={design.label}
            onPress={onPress}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              <Ionicons
                name={design.icon as IconName}
                size={21}
                color={isFocused ? '#167A51' : '#9B9A91'}
              />
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {design.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 10,
    backgroundColor: '#FFFDF8',
    borderTopWidth: 1,
    borderTopColor: '#E7E0D4',
  },
  item: {
    minWidth: 64,
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.65,
  },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: '#E8F4EE',
  },
  label: {
    color: '#9B9A91',
    fontSize: 11,
    fontWeight: '700',
  },
  labelActive: {
    color: '#167A51',
  },
});
