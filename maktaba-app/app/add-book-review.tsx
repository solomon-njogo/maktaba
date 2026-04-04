import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { IsbnBookPreviewCard } from '@/components/IsbnBookPreviewCard';
import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useBulkAddQueue } from '@/contexts/bulk-add-queue';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { saveOpenLibraryBook, type OpenLibraryBook } from '@/middleware';

export default function AddBookReviewScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { items, removeItem, clear } = useBulkAddQueue();

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const horizontalPad = Math.min(t.space.xl, Math.max(t.space.m, width * 0.04));

  const approveOne = useCallback(async (id: string, book: OpenLibraryBook) => {
    setSavingId(id);
    try {
      const result = await saveOpenLibraryBook(book);
      removeItem(id);
      if (result === 'duplicate_db') {
        Alert.alert('Already in library', 'This ISBN was already saved. Removed from the list.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      Alert.alert('Could not save', msg);
    } finally {
      setSavingId(null);
    }
  }, [removeItem]);

  const approveAll = useCallback(async () => {
    if (items.length === 0) return;
    const snapshot = [...items];
    setSavingAll(true);
    let saved = 0;
    let dup = 0;
    let failed = 0;
    for (const row of snapshot) {
      try {
        const result = await saveOpenLibraryBook(row.book);
        if (result === 'saved') saved += 1;
        else dup += 1;
        removeItem(row.id);
      } catch {
        failed += 1;
      }
    }
    setSavingAll(false);
    const parts: string[] = [];
    if (saved) parts.push(`${saved} added`);
    if (dup) parts.push(`${dup} already in your library`);
    if (failed) parts.push(`${failed} could not be saved`);
    Alert.alert('Done', parts.length ? parts.join('. ') : 'No books processed.');
    if (saved > 0) {
      router.back();
    }
  }, [items, removeItem, router]);

  const deny = useCallback(
    (id: string) => {
      removeItem(id);
    },
    [removeItem]
  );

  const clearAll = useCallback(() => {
    Alert.alert('Clear list?', 'Remove all books from this review list.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clear() },
    ]);
  }, [clear]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: 1, paddingHorizontal: horizontalPad, paddingTop: t.space.l, gap: t.space.m }}>
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
            Review books
          </ThemedText>
          {items.length > 0 ? (
            <Pressable onPress={clearAll} hitSlop={10}>
              <ThemedText variant="caption" tone="muted" style={{ color: c.tertiary }}>
                Clear all
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        <ThemedText tone="muted">
          Approve to save each book to My Books, or remove it from this list. You can approve one at a time or save
          everything at once.
        </ThemedText>

        {items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: t.space.l, paddingVertical: t.space.xxl }}>
            <Ionicons name="library-outline" size={48} color={c.icon} />
            <ThemedText variant="title" style={{ textAlign: 'center' }}>
              No books to review
            </ThemedText>
            <ThemedText tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
              Scan or enter ISBNs on the previous screens. Books you add will appear here before they are saved.
            </ThemedText>
            <Button variant="secondary" onPress={() => router.back()} style={{ borderRadius: 14, minWidth: 200 }}>
              Go back
            </Button>
          </View>
        ) : (
          <>
            <FlatList
              data={items}
              keyExtractor={(row) => row.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: t.space.xxl + 88 + insets.bottom,
                gap: t.space.l,
                flexGrow: 1,
              }}
              renderItem={({ item }) => (
                <View style={{ opacity: savingId === item.id ? 0.65 : 1 }}>
                  <IsbnBookPreviewCard
                    book={item.book}
                    primaryLabel="Approve"
                    onPrimary={() => approveOne(item.id, item.book)}
                    secondaryLabel="Remove"
                    onSecondary={() => deny(item.id)}
                    coverRecyclingKeySuffix={`-review-${item.id}`}
                  />
                </View>
              )}
            />

            <View
              style={{
                position: 'absolute',
                left: horizontalPad,
                right: horizontalPad,
                bottom: insets.bottom + t.space.l,
                gap: t.space.s,
              }}
            >
              <Button
                variant="primary"
                onPress={approveAll}
                disabled={savingAll || items.length === 0}
                style={{ borderRadius: 14 }}
              >
                {savingAll ? 'Saving…' : `Approve all (${items.length})`}
              </Button>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
