import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function AddBookScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingHorizontal: t.space.xl, paddingTop: t.space.xxl, gap: t.space.xl }}>
        <View style={{ gap: t.space.s }}>
          <ThemedText variant="headline">Add book</ThemedText>
          <ThemedText tone="muted">Paste an ISBN, title, or author to start.</ThemedText>
        </View>

        <Card>
          <View style={{ gap: t.space.l }}>
            <TextField placeholder="ISBN / Title / Author" returnKeyType="search" />

            <View style={{ flexDirection: 'row', gap: t.space.m, flexWrap: 'wrap' }}>
              <View style={{ flexGrow: 1, minWidth: 160 }}>
                <Button variant="primary" onPress={() => {}}>
                  Search
                </Button>
              </View>
              <View style={{ flexGrow: 1, minWidth: 160 }}>
                <Button variant="secondary" onPress={() => router.back()}>
                  Close
                </Button>
              </View>
            </View>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}

