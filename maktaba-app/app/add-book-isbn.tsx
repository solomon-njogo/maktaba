import React, { useMemo } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookLookupLoadingOverlay } from '@/components/BookLookupLoadingOverlay';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { IsbnBookPreviewCard } from '@/components/IsbnBookPreviewCard';
import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useBulkAddQueue } from '@/contexts/bulk-add-queue';
import { useIsbnBookLookup } from '@/hooks/use-isbn-book-lookup';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function AddBookIsbnScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { queueSize, addBook: addToQueue } = useBulkAddQueue();

  const {
    isbnInput,
    setIsbnInput,
    lookupLoading,
    lookupError,
    preview,
    runLookup,
    resetLookup,
  } = useIsbnBookLookup();

  const scale = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, (width - 360) / 520));
    return 1 + clamped * 0.25;
  }, [width]);

  const horizontalPad = Math.min(t.space.xl, Math.max(t.space.m, width * 0.04));

  function addPreviewToList() {
    if (!preview) return;
    const r = addToQueue(preview);
    if (!r.ok) {
      Alert.alert('Already in list', 'This ISBN is already on your review list.');
      return;
    }
    resetLookup();
    setIsbnInput('');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPad,
          paddingTop: t.space.l,
          paddingBottom: insets.bottom + t.space.xxl + 72,
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
          Enter ISBN-10 or ISBN-13, search, then add each book to your list. When you are finished, open the review
          screen to approve or remove books before they are saved.
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
                flexWrap: 'wrap',
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
                  minWidth: 160,
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
                primaryLabel="Add to list"
                onPrimary={addPreviewToList}
                secondaryLabel="Dismiss"
                onSecondary={resetLookup}
              />
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: horizontalPad,
          right: horizontalPad,
          bottom: insets.bottom + t.space.m,
          gap: t.space.s,
        }}
      >
        <ThemedText tone="muted" style={{ textAlign: 'center', fontSize: Math.round(t.typography.size.s * 1.05) }}>
          {queueSize > 0
            ? `${queueSize} book${queueSize === 1 ? '' : 's'} ready to review`
            : 'Add at least one book to continue'}
        </ThemedText>
        <Button
          variant="primary"
          disabled={queueSize === 0}
          onPress={() => router.push('/add-book-review')}
          style={{ borderRadius: 14 }}
        >
          {queueSize > 0 ? `Review books (${queueSize})` : 'Review books'}
        </Button>
      </View>

      <BookLookupLoadingOverlay visible={lookupLoading} />
    </SafeAreaView>
  );
}
