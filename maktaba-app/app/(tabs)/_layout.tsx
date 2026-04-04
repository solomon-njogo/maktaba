import { Tabs, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

function TabBarGlyph({
  focused,
  color,
  size,
  outline,
  solid,
}: {
  focused: boolean;
  color: string;
  size: number;
  outline: IonName;
  solid: IonName;
}) {
  return <Ionicons name={focused ? solid : outline} color={color} size={size} />;
}

export default function TabsLayout() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();

  const tabIconSize = t.size.icon.l;

  const commonTabBarStyle = useMemo(
    () => ({
      height: t.platform.tabBarHeight,
      paddingTop: t.size.tabBar.padTop,
      paddingBottom: t.platform.tabBarPadBottom,
      paddingHorizontal: t.space.s,
      backgroundColor: c.card,
      borderTopColor: c.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      ...Platform.select({
        android: {
          elevation: 6,
        },
        default: {},
      }),
    }),
    [
      c.border,
      c.card,
      t.platform.tabBarHeight,
      t.platform.tabBarPadBottom,
      t.size.tabBar.padTop,
      t.space.s,
    ]
  );

  const tabBarLabelStyle = useMemo(
    () => ({
      fontFamily: Fonts.sans,
      fontSize: t.typography.size.s,
      fontWeight: t.typography.weight.semiBold as '600',
      lineHeight: Math.round(t.typography.size.s * 1.2),
      letterSpacing: 0.2,
      marginTop: 2,
    }),
    [t.typography.size.s, t.typography.weight.semiBold]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: commonTabBarStyle,
        tabBarActiveTintColor: c.tabIconSelected,
        tabBarInactiveTintColor: c.tabIconDefault,
        tabBarLabelStyle,
        tabBarItemStyle: {
          paddingVertical: t.space.xs,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarGlyph
              focused={focused}
              color={color}
              size={tabIconSize}
              outline="home-outline"
              solid="home"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="my-books"
        options={{
          title: 'My Books',
          tabBarIcon: ({ color, focused }) => (
            <TabBarGlyph
              focused={focused}
              color={color}
              size={tabIconSize}
              outline="library-outline"
              solid="library"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="add"
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/add-book');
          },
        }}
        options={{
          title: 'Add',
          tabBarAccessibilityLabel: 'Add books',
          tabBarIcon: ({ color, focused }) => (
            <TabBarGlyph
              focused={focused}
              color={color}
              size={tabIconSize}
              outline="add-outline"
              solid="add"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="my-info"
        options={{
          title: 'My Info',
          tabBarIcon: ({ color, focused }) => (
            <TabBarGlyph
              focused={focused}
              color={color}
              size={tabIconSize}
              outline="person-outline"
              solid="person"
            />
          ),
        }}
      />
    </Tabs>
  );
}

