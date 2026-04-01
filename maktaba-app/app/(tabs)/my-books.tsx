import React from 'react';
import { SafeAreaView, View } from 'react-native';

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function MyBooksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: t.space.xl, paddingTop: t.space.xxl, gap: t.space.xl }}>
        <ThemedText variant="headline">My Books</ThemedText>

        <Card>
          <View style={{ gap: t.space.s }}>
            <ThemedText variant="title">Your library</ThemedText>
            <ThemedText tone="muted">Saved books will show up here.</ThemedText>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

