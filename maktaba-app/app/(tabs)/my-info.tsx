import React from 'react';
import { SafeAreaView, View } from 'react-native';

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function MyInfoScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: t.space.xl, paddingTop: t.space.xxl, gap: t.space.xl }}>
        <ThemedText variant="headline">My Info</ThemedText>

        <Card>
          <View style={{ gap: t.space.s }}>
            <ThemedText variant="title">Profile</ThemedText>
            <ThemedText tone="muted">Account details and preferences will live here.</ThemedText>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

