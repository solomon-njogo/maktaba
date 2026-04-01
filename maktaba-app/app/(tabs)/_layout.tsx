import { Tabs, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();

  const commonTabBarStyle = useMemo(
    () => ({
      height: t.platform.tabBarHeight,
      paddingTop: t.size.tabBar.padTop,
      paddingBottom: t.platform.tabBarPadBottom,
      backgroundColor: c.card,
      borderTopColor: c.border,
      borderTopWidth: Platform.select({ ios: 0.5, default: 1 }),
    }),
    [c.border, c.card, t.platform.tabBarHeight, t.platform.tabBarPadBottom, t.size.tabBar.padTop]
  );

  const goAddBook = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // no-op (web/simulator)
    }
    router.push('/add-book');
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: commonTabBarStyle,
        tabBarActiveTintColor: c.tabIconSelected,
        tabBarInactiveTintColor: c.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: t.typography.size.xs,
          lineHeight: Math.round(t.typography.size.xs * 1.25),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="my-books"
        options={{
          title: 'My Books',
          tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={color} size={size} />,
        }}
      />

      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: () => (
            <View style={{ width: t.size.fab.wrapWidth, alignItems: 'center' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add book"
                onPress={goAddBook}
                style={({ pressed }) => [
                  {
                    width: t.size.fab.size,
                    height: t.size.fab.size,
                    borderRadius: t.radius.pill,
                    backgroundColor: c.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ translateY: -t.size.fab.lift }, { scale: pressed ? 0.98 : 1 }],
                    shadowColor: c.shadow,
                    shadowOpacity: scheme === 'dark' ? 0.42 : 0.24,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 10,
                  },
                ]}
              >
                <Ionicons name="add" size={t.size.fab.icon} color={c.onPrimary} />
              </Pressable>
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="my-info"
        options={{
          title: 'My Info',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

