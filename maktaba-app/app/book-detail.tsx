import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { getBookById } from '@/lib/db/books';

type BookRow = NonNullable<Awaited<ReturnType<typeof getBookById>>>;

function formatDate(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    buy: 'Want to buy',
    tbr: 'To be read',
    read: 'Finished',
    reading: 'In progress',
    dropped: 'Dropped',
  };
  return map[status] ?? status;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <View style={{ gap: t.space.xs }}>
      <ThemedText variant="caption" tone="muted">
        {label}
      </ThemedText>
      <ThemedText variant="body" style={{ color: c.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

export default function BookDetailScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;

  const [book, setBook] = useState<BookRow | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setBook(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await getBookById(id);
      setBook(row);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const maxContent = Math.min(width - t.space.xl * 2, t.breakpoints.tablet - 80);
  const coverW = Math.min(maxContent, Math.round(width * 0.52));
  const coverH = Math.round(coverW * 1.42);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'left', 'right']}>
      <View
        style={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.m,
          paddingBottom: t.space.s,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.m,
          maxWidth: t.breakpoints.tablet,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={c.icon} />
        </Pressable>
        <ThemedText variant="headline" numberOfLines={1} style={{ flex: 1 }}>
          Book details
        </ThemedText>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.space.xxl }}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : !id || book === null ? (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: t.space.xl,
            paddingBottom: t.space.xxl,
            alignItems: 'center',
            justifyContent: 'center',
            gap: t.space.l,
            maxWidth: t.breakpoints.tablet,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Ionicons name="book-outline" size={48} color={c.icon} />
          <ThemedText variant="title" align="center">
            Book not found
          </ThemedText>
          <ThemedText tone="muted" align="center" style={{ maxWidth: 280 }}>
            This book may have been removed or the link is invalid.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to library"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              marginTop: t.space.m,
              paddingVertical: t.space.m,
              paddingHorizontal: t.space.xl,
              borderRadius: t.radius.m,
              backgroundColor: c.primary,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <ThemedText variant="label" tone="onPrimary">
              Back to library
            </ThemedText>
          </Pressable>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: t.space.xl,
            paddingBottom: t.space.xxl,
            gap: t.space.l,
            maxWidth: t.breakpoints.tablet,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: coverW,
                height: coverH,
                borderRadius: t.radius.m,
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(31, 26, 22, 0.06)',
                borderWidth: 1,
                borderColor: c.border,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {book.coverUri ? (
                <Image
                  source={{ uri: book.coverUri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <Ionicons name="book-outline" size={40} color={c.icon} />
              )}
            </View>
          </View>

          <View style={{ gap: t.space.s, alignItems: 'center' }}>
            <ThemedText variant="headline" align="center" style={{ maxWidth: maxContent }}>
              {book.title}
            </ThemedText>
            <ThemedText variant="body" tone="muted" align="center" style={{ maxWidth: maxContent }}>
              {book.author?.trim() ? book.author : 'Unknown author'}
            </ThemedText>
          </View>

          {book.description?.trim() ? (
            <Card>
              <View style={{ gap: t.space.m }}>
                <ThemedText variant="label">About</ThemedText>
                <ThemedText variant="body" tone="muted" style={{ fontFamily: BrandFonts.manrope.regular }}>
                  {book.description.trim()}
                </ThemedText>
              </View>
            </Card>
          ) : null}

          <Card>
            <View style={{ gap: t.space.l }}>
              <ThemedText variant="label">Details</ThemedText>
              {book.isbn?.trim() ? <DetailRow label="ISBN" value={book.isbn.trim()} /> : null}
              {book.genre?.trim() ? <DetailRow label="Genre" value={book.genre.trim()} /> : null}
              {book.pages != null ? <DetailRow label="Pages" value={String(book.pages)} /> : null}
              {!book.isbn?.trim() && !book.genre?.trim() && book.pages == null ? (
                <ThemedText tone="muted">No extra details yet.</ThemedText>
              ) : null}
            </View>
          </Card>

          <Card>
            <View style={{ gap: t.space.l }}>
              <ThemedText variant="label">Reading</ThemedText>
              <DetailRow label="Status" value={statusLabel(String(book.status ?? 'tbr'))} />
              <DetailRow label="Borrowed" value={book.borrowed ? 'Yes' : 'No'} />
              {book.borrowed ? (
                <>
                  {formatDate(book.startDate) ? <DetailRow label="Borrowed from" value={formatDate(book.startDate)!} /> : null}
                  {formatDate(book.endDate) ? <DetailRow label="Return by" value={formatDate(book.endDate)!} /> : null}
                </>
              ) : null}
            </View>
          </Card>

          <Card>
            <View style={{ gap: t.space.l }}>
              <ThemedText variant="label">Library</ThemedText>
              {formatDate(book.createdAt) ? <DetailRow label="Added" value={formatDate(book.createdAt)!} /> : null}
              {formatDate(book.updatedAt) ? <DetailRow label="Last updated" value={formatDate(book.updatedAt)!} /> : null}
            </View>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
