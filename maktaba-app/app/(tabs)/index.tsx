import React from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.xxl,
          paddingBottom: t.space.xxl,
          gap: t.space.xl,
        }}
      >
        <View style={{ gap: t.space.s }}>
          <ThemedText variant="headline">Maktaba</ThemedText>
          <ThemedText tone="muted">
            Sun-baked simplicity. Warm minimalism, curated content, and abundant whitespace.
          </ThemedText>
        </View>

        <Card>
          <View style={{ gap: t.space.l }}>
            <View style={{ gap: t.space.xs }}>
              <ThemedText variant="title">Search your library</ThemedText>
              <ThemedText tone="muted">Try a title, author, or keyword.</ThemedText>
            </View>

            <TextField placeholder="e.g. Dostoevsky" returnKeyType="search" />

            <View style={{ flexDirection: 'row', gap: t.space.m, flexWrap: 'wrap' }}>
              <View style={{ flexGrow: 1, minWidth: 160 }}>
                <Button variant="primary" onPress={() => {}}>
                  Browse
                </Button>
              </View>
              <View style={{ flexGrow: 1, minWidth: 160 }}>
                <Button variant="secondary" onPress={() => {}}>
                  Add book
                </Button>
              </View>
            </View>

            <Button variant="link" onPress={() => {}}>
              View curated picks
            </Button>

            <ThemedText variant="caption" tone="tertiary">
              Accent is intentionally sparse.
            </ThemedText>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

