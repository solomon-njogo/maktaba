import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs, router } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function CenterAddButton() {
  const colorScheme = useColorScheme() ?? 'light';
  const bg = Colors[colorScheme].primary;

  return (
    <View style={styles.centerWrap} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add"
        onPress={() => router.push('/add-actions')}
        style={({ pressed }) => [styles.centerBtn, { backgroundColor: bg }, pressed && { opacity: 0.9 }]}>
        <MaterialIcons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? 'light';

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
          href: null,
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
    height: Platform.select({ ios: 86, default: 70 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 26, default: 10 }),
    borderTopWidth: 1,
  },
  centerWrap: {
    position: 'relative',
    width: 74,
    alignItems: 'center',
  },
  centerBtn: {
    width: 58,
    height: 58,
    marginTop: -22,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
});
