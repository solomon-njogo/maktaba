import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { getBookById, patchBookReading } from '@/middleware';
import type { BookStatus } from '@/middleware/types';

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

const READING_STATUSES: { value: BookStatus; label: string }[] = [
  { value: 'buy', label: 'Want to buy' },
  { value: 'tbr', label: 'To read' },
  { value: 'reading', label: 'Reading' },
  { value: 'read', label: 'Finished' },
  { value: 'dropped', label: 'Dropped' },
];

function normalizeBookStatus(raw: string | undefined | null): BookStatus {
  const s = String(raw ?? 'tbr');
  if (READING_STATUSES.some((x) => x.value === s)) return s as BookStatus;
  return 'tbr';
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
  const [readingBusy, setReadingBusy] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const borrowerSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (book) {
      setBorrowerName(book.borrowedBy?.trim() ?? '');
    }
  }, [book?.id, book?.borrowedBy]);

  useEffect(
    () => () => {
      if (borrowerSaveTimer.current) clearTimeout(borrowerSaveTimer.current);
    },
    []
  );

  const scheduleBorrowerPersist = useCallback(
    (name: string) => {
      if (!id) return;
      if (borrowerSaveTimer.current) clearTimeout(borrowerSaveTimer.current);
      borrowerSaveTimer.current = setTimeout(() => {
        borrowerSaveTimer.current = null;
        void (async () => {
          await patchBookReading(id, { borrowedBy: name.trim() || null });
          await load();
        })();
      }, 500);
    },
    [id, load]
  );

  const onPickStatus = useCallback(
    async (status: BookStatus) => {
      if (!id || !book || normalizeBookStatus(String(book.status)) === status) return;
      setReadingBusy(true);
      try {
        await patchBookReading(id, { status });
        await load();
      } finally {
        setReadingBusy(false);
      }
    },
    [book, id, load]
  );

  const onBorrowedToggle = useCallback(
    async (value: boolean) => {
      if (!id) return;
      setReadingBusy(true);
      try {
        if (value) {
          await patchBookReading(id, { borrowed: true, borrowedBy: borrowerName.trim() || null });
        } else {
          await patchBookReading(id, { borrowed: false });
          setBorrowerName('');
        }
        await load();
      } finally {
        setReadingBusy(false);
      }
    },
    [borrowerName, id, load]
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
      ) : !id || book == null ? (
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <ThemedText variant="label">Reading</ThemedText>
                {readingBusy ? <ActivityIndicator size="small" color={c.primary} /> : null}
              </View>

              <View style={{ gap: t.space.xs }}>
                <ThemedText variant="caption" tone="muted">
                  Status
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.s }}>
                  {READING_STATUSES.map(({ value, label }) => {
                    const current = normalizeBookStatus(String(book.status));
                    const selected = current === value;
                    return (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Set status to ${label}`}
                        disabled={readingBusy}
                        onPress={() => void onPickStatus(value)}
                        style={({ pressed }) => [
                          {
                            paddingVertical: t.space.s,
                            paddingHorizontal: t.space.m,
                            borderRadius: t.radius.m,
                            borderWidth: 1,
                            borderColor: selected ? c.primary : c.border,
                            backgroundColor: selected ? c.primarySoft : c.card,
                            opacity: pressed || readingBusy ? 0.85 : 1,
                          },
                        ]}
                      >
                        <ThemedText
                          variant="caption"
                          style={{
                            color: selected ? c.primary : c.text,
                            fontFamily: BrandFonts.manrope.semiBold,
                          }}
                        >
                          {label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: t.space.m,
                }}
              >
                <View style={{ flex: 1, gap: t.space.xs }}>
                  <ThemedText variant="body" style={{ color: c.text }}>
                    On loan
                  </ThemedText>
                  <ThemedText variant="caption" tone="muted">
                    Someone else has this copy
                  </ThemedText>
                </View>
                <Switch
                  value={!!book.borrowed}
                  onValueChange={(v) => void onBorrowedToggle(v)}
                  disabled={readingBusy}
                  trackColor={{ false: c.border, true: c.primarySoft }}
                  thumbColor={book.borrowed ? c.primary : c.card}
                />
              </View>

              {book.borrowed ? (
                <View style={{ gap: t.space.xs }}>
                  <ThemedText variant="caption" tone="muted">
                    Borrower name
                  </ThemedText>
                  <TextInput
                    value={borrowerName}
                    editable={!readingBusy}
                    onChangeText={(t) => {
                      setBorrowerName(t);
                      scheduleBorrowerPersist(t);
                    }}
                    onBlur={() => {
                      if (borrowerSaveTimer.current) {
                        clearTimeout(borrowerSaveTimer.current);
                        borrowerSaveTimer.current = null;
                      }
                      void (async () => {
                        await patchBookReading(id!, { borrowedBy: borrowerName.trim() || null });
                        await load();
                      })();
                    }}
                    placeholder="Who has the book?"
                    placeholderTextColor={c.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: t.radius.m,
                      paddingVertical: t.space.m,
                      paddingHorizontal: t.space.m,
                      fontFamily: BrandFonts.manrope.regular,
                      fontSize: t.typography.size.xl,
                      lineHeight: t.typography.lineHeight.m,
                      color: c.text,
                      backgroundColor: c.card,
                    }}
                  />
                </View>
              ) : null}

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
