import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import { BulkAddQueueProvider } from '@/contexts/bulk-add-queue';
import { initAppDatabase, runStartupMetadataBackfill } from '@/middleware';

import {
  EBGaramond_400Regular,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
} from '@expo-google-fonts/eb-garamond';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (!loaded) return;

    let cancelled = false;
    (async () => {
      try {
        await initAppDatabase();
        if (!cancelled) {
          void runStartupMetadataBackfill();
        }
      } finally {
        if (!cancelled) SplashScreen.hideAsync();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <BulkAddQueueProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-book"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="add-book-scan"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="add-book-isbn"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="add-book-review"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="book-detail"
          options={{
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
      </BulkAddQueueProvider>
    </SafeAreaProvider>
  );
}
