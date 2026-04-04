import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { AppName } from '@/components/AppName';
import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type ActionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function ActionCard({ icon, label, onPress }: ActionCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}
    >
      <Card
        padded={false}
        style={[
          {
            borderRadius: 14,
          },
        ]}
      >
        <View
          style={{
            paddingHorizontal: t.space.xl,
            paddingVertical: t.space.l,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: t.space.m,
            minHeight: Math.round(t.size.button.minHeight * 1.12),
          }}
        >
          <Ionicons name={icon} size={22} color={c.primary} />
          <ThemedText variant="body" style={{ fontFamily: BrandFonts.manrope.semiBold }}>
            {label}
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );
}

export default function AddBookScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');

  const scale = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, (width - 360) / 520));
    return 1 + clamped * 0.25;
  }, [width]);

  const titleSize = Math.round(t.typography.size.headerTitle * 1.02 * scale);
  const subtitleSize = Math.round(t.typography.size.l * scale);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.xxl,
          paddingBottom: t.space.xxl,
          gap: t.space.xl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s }}>
            <Ionicons name="book-outline" size={20} color={c.primary} />
            <AppName variant="title" size={Math.round(t.typography.size.title * scale)} />
          </View>
        </View>

        <View style={{ gap: Math.max(6, Math.round(t.space.xs * scale)) }}>
          <ThemedText
            variant="headline"
            style={{
              fontFamily: BrandFonts.ebGaramond.semiBold,
              fontSize: titleSize,
            }}
          >
            Add a Book
          </ThemedText>
          <ThemedText tone="muted" style={{ fontSize: subtitleSize }}>
            Search by title, author, or ISBN. Scan or enter multiple ISBNs, then review and approve them on one screen.
          </ThemedText>
        </View>

        <View style={{ gap: t.space.l }}>
          <View
            style={{
              backgroundColor: c.card,
              borderColor: c.primary,
              borderWidth: 1.25,
              borderRadius: 14,
              paddingHorizontal: t.space.l,
              paddingVertical: t.space.m,
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.space.m,
            }}
          >
            <Ionicons name="search-outline" size={20} color={c.primary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Great Gatsby, Orwell…"
              placeholderTextColor={c.placeholder}
              returnKeyType="search"
              style={{
                flex: 1,
                fontFamily: BrandFonts.manrope.regular,
                fontSize: Math.round(t.typography.size.l * scale),
                color: c.text,
                padding: 0,
              }}
            />
          </View>

          <View style={{ gap: t.space.m }}>
            <ActionCard icon="barcode-outline" label="Scan Barcode" onPress={() => router.push('/add-book-scan')} />
            <ActionCard icon="pricetag-outline" label="Add by ISBN" onPress={() => router.push('/add-book-isbn')} />
            <ActionCard icon="cloud-upload-outline" label="Import books" onPress={() => {}} />
            <ActionCard icon="create-outline" label="Add Manually" onPress={() => {}} />
          </View>
        </View>

        <View style={{ paddingTop: t.space.s, gap: t.space.m }}>
          <Button variant="link" onPress={() => router.back()} style={{ alignSelf: 'center' }}>
            Close
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
