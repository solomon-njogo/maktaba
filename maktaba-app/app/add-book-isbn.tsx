import React, { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BookLookupLoadingOverlay } from '@/components/BookLookupLoadingOverlay';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IsbnBookPreviewCard } from '@/components/IsbnBookPreviewCard';
import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useIsbnBookLookup } from '@/hooks/use-isbn-book-lookup';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function AddBookIsbnScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const {
    isbnInput,
    setIsbnInput,
    lookupLoading,
    lookupError,
    preview,
    runLookup,
    savePreview,
    resetLookup,
  } = useIsbnBookLookup();

  const scale = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, (width - 360) / 520));
    return 1 + clamped * 0.25;
  }, [width]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.l,
          paddingBottom: t.space.xxl,
          gap: t.space.l,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.m }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="chevron-back" size={26} color={c.primary} />
          </Pressable>
          <ThemedText variant="headline" style={{ fontFamily: BrandFonts.ebGaramond.semiBold, flex: 1 }}>
            Add by ISBN
          </ThemedText>
        </View>

        <ThemedText tone="muted" style={{ fontSize: Math.round(t.typography.size.l * scale) }}>
          Enter an ISBN-10 or ISBN-13. We will fetch details from Open Library.
        </ThemedText>

        <Card>
          <View style={{ gap: t.space.m }}>
            <View
              style={{
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: t.space.l,
                paddingVertical: t.space.m,
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.space.m,
              }}
            >
              <Ionicons name="barcode-outline" size={18} color={c.icon} />
              <TextInput
                value={isbnInput}
                onChangeText={setIsbnInput}
                placeholder="ISBN-10 or ISBN-13"
                placeholderTextColor={c.placeholder}
                keyboardType="number-pad"
                returnKeyType="search"
                onSubmitEditing={() => runLookup(isbnInput)}
                style={{
                  flex: 1,
                  fontFamily: BrandFonts.manrope.regular,
                  fontSize: Math.round(t.typography.size.l * scale),
                  color: c.text,
                  padding: 0,
                }}
              />
              <Button variant="secondary" onPress={() => runLookup(isbnInput)} disabled={lookupLoading}>
                {lookupLoading ? 'Searching…' : 'Search'}
              </Button>
            </View>

            {lookupError ? (
              <ThemedText tone="muted" style={{ color: c.tertiary }}>
                {lookupError}
              </ThemedText>
            ) : null}

            {preview ? (
              <IsbnBookPreviewCard
                book={preview}
                primaryLabel="Save to My Books"
                onPrimary={savePreview}
                secondaryLabel="Not this one"
                onSecondary={resetLookup}
              />
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <BookLookupLoadingOverlay visible={lookupLoading} />
    </SafeAreaView>
  );
}
