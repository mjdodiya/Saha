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
  index: { label: 'Home', icon: 'Home' },
  nearby: { label: 'Nearby', icon: 'connnec' },
  chat: { label: 'Messages', icon: '□' },
  settings: { label: 'Settings', icon: '⚙' },
} as const;

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
              <Text style={[styles.icon, isFocused && styles.iconActive]}>
                {design.icon}
              </Text>
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
  icon: {
    color: '#9B9A91',
    fontSize: 22,
    lineHeight: 24,
  },
  iconActive: {
    color: '#167A51',
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
