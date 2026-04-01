import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

function CenterAddButton() {
  const colorScheme = useColorScheme() ?? 'light';
  const bg = Colors[colorScheme].primary;
  const c = Colors[colorScheme];
  const t = useTokens();

  return (
    <View style={[styles.centerWrap, { width: t.size.fab.wrapWidth, alignItems: 'center' }]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        onPress={() => router.push('/add-actions')}
        style={({ pressed }) => [
          styles.centerBtn,
          {
            backgroundColor: bg,
            width: t.size.fab.size,
            height: t.size.fab.size,
            marginTop: -t.size.fab.lift,
            borderRadius: t.size.fab.size / 2,
            shadowColor: c.shadow,
            shadowOpacity: 0.15,
            shadowRadius: t.space.xl,
            shadowOffset: { width: 0, height: t.space.l },
            elevation: t.space.m,
          },
          pressed && { opacity: 0.9 },
        ]}>
        <MaterialIcons name="add" size={t.size.fab.icon} color={c.onPrimary} />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';
  const t = useTokens();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[scheme].primary,
        tabBarInactiveTintColor: Colors[scheme].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: Colors[scheme].background,
            borderTopColor: Colors[scheme].border,
            height: t.platform.tabBarHeight,
            paddingTop: t.size.tabBar.padTop,
            paddingBottom: t.platform.tabBarPadBottom,
          },
        ],
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'My books',
          tabBarIcon: ({ color }) => <MaterialIcons name="menu-book" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="add-placeholder"
        options={{
          title: '',
          tabBarButton: () => <CenterAddButton />,
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <MaterialIcons name="calendar-month" size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="info"
        options={{
          title: 'My info',
          tabBarIcon: ({ color }) => <MaterialIcons name="person-outline" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
  },
  centerWrap: {
    position: 'relative',
  },
  centerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
