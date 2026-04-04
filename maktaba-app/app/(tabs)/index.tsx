import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AppName } from '@/components/AppName';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { listBooks } from '@/middleware';

type DashboardBook = {
  id: string;
  title: string;
  author: string | null;
  coverUri: string | null;
  status: string;
  updatedAt: number;
  borrowed: boolean;
};

type HomeInProgressBook = {
  id: string;
  title: string;
  author?: string;
  coverUrl?: string | null;
  updatedLabel?: string | null;
};

type HomeStats = {
  totalBooks: number;
  inProgress: number;
  finished: number;
  toRead: number;
  dropped: number;
  onLoan: number;
};

type HomeData = {
  loading: boolean;
  inProgressBook: HomeInProgressBook | null;
  stats: HomeStats | null;
  /** Share of library marked finished (0..1), for ring when total > 0 */
  finishedShare: number | null;
  recentBooks: DashboardBook[];
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function formatRelativeUpdated(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day}d ago`;
  try {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function normalizeDashboardRows(rows: unknown[]): DashboardBook[] {
  return rows.map((r: any) => ({
    id: String(r.id),
    title: String(r.title),
    author: (r.author ?? null) as string | null,
    coverUri: (r.coverUri ?? null) as string | null,
    status: String(r.status ?? 'tbr'),
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Number(r.updatedAt ?? 0),
    borrowed: Boolean(r.borrowed),
  }));
}

function computeHomeData(books: DashboardBook[]): Omit<HomeData, 'loading'> {
  if (!books.length) {
    return {
      inProgressBook: null,
      stats: null,
      finishedShare: null,
      recentBooks: [],
    };
  }

  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => b.updatedAt - a.updatedAt);
  const firstReading = reading[0];
  const inProgressBook: HomeInProgressBook | null = firstReading
    ? {
        id: firstReading.id,
        title: firstReading.title,
        author: firstReading.author?.trim() || undefined,
        coverUrl: firstReading.coverUri,
        updatedLabel: formatRelativeUpdated(firstReading.updatedAt),
      }
    : null;

  const stats: HomeStats = {
    totalBooks: books.length,
    inProgress: books.filter((b) => b.status === 'reading').length,
    finished: books.filter((b) => b.status === 'read').length,
    toRead: books.filter((b) => b.status === 'tbr' || b.status === 'buy').length,
    dropped: books.filter((b) => b.status === 'dropped').length,
    onLoan: books.filter((b) => b.borrowed).length,
  };

  const finishedShare = stats.totalBooks > 0 ? stats.finished / stats.totalBooks : null;

  const recentBooks = [...books].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);

  return { inProgressBook, stats, finishedShare, recentBooks };
}

function useDashboardData(): HomeData {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<DashboardBook[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listBooks();
      setBooks(normalizeDashboardRows(rows));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const derived = useMemo(() => computeHomeData(books), [books]);

  return useMemo(
    () => ({
      loading,
      ...derived,
    }),
    [loading, derived]
  );
}

function Donut({
  value,
  size,
  strokeWidth,
  labelTop,
  labelBottom,
}: {
  value?: number | null; // 0..1
  size: number;
  strokeWidth: number;
  labelTop?: string;
  labelBottom?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const v = typeof value === 'number' ? clamp01(value) : null;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circum = 2 * Math.PI * r;
  const dash = v === null ? 0 : circum * v;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={c.border} strokeWidth={strokeWidth} fill="transparent" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={c.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${dash} ${Math.max(1, circum - dash)}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>

      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {labelTop ? (
          <ThemedText variant="headline" style={{ fontSize: Math.round(t.typography.size.title * 1.25) }}>
            {labelTop}
          </ThemedText>
        ) : (
          <ThemedText variant="headline" style={{ fontSize: Math.round(t.typography.size.title * 1.25) }}>
            —
          </ThemedText>
        )}
        {labelBottom ? (
          <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {labelBottom}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const data = useDashboardData();

  const scale = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, (width - 360) / 520));
    return 1 + clamped * 0.28;
  }, [width]);

  const coverW = Math.round(112 * scale);
  const coverH = Math.round(148 * scale);
  const donutSize = Math.round(120 * scale);
  const donutStroke = Math.max(10, Math.round(14 * scale));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.xl,
          paddingBottom: t.space.xxl,
          gap: t.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppName variant="title" size={Math.round(t.typography.size.title * scale)} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My profile"
            onPress={() => router.push('/my-info')}
            style={({ pressed }) => [
              {
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="person-outline" size={18} color={c.icon} />
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ gap: t.space.s }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.m }}>
            <ThemedText
              variant="headline"
              style={{
                flex: 1,
                fontSize: Math.round(t.typography.size.headerTitle * scale),
                lineHeight: Math.round(t.typography.lineHeight.headerTitle * scale),
              }}
            >
              Library overview
            </ThemedText>
            {data.loading ? <ActivityIndicator size="small" color={c.primary} accessibilityLabel="Loading library" /> : null}
          </View>
          <ThemedText tone="muted" style={{ maxWidth: 420 }}>
            {data.loading
              ? 'Refreshing your shelf…'
              : data.stats
                ? `${data.stats.totalBooks} book${data.stats.totalBooks === 1 ? '' : 's'} · ${data.stats.inProgress} in progress · ${data.stats.onLoan} on loan`
                : 'Add your first book to see counts and shortcuts here.'}
          </ThemedText>
        </View>

        {/* Books in progress */}
        <View style={{ gap: t.space.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Books in Progress
            </ThemedText>
            <Button
              variant="link"
              onPress={() => router.push('/my-books')}
              style={{ paddingVertical: 0, alignSelf: 'flex-end' }}
              labelStyle={{ letterSpacing: 1.2, textTransform: 'uppercase' }}
            >
              View all
            </Button>
          </View>

          <Card padded={false} style={{ overflow: 'hidden' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={data.inProgressBook ? `Open ${data.inProgressBook.title}` : 'Open books in progress'}
              onPress={() =>
                data.inProgressBook
                  ? router.push({ pathname: '/book-detail', params: { id: data.inProgressBook.id } } as Href)
                  : router.push({ pathname: '/my-books', params: { filter: 'inProgress' } } as Href)
              }
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
              <View style={{ padding: t.space.xl, flexDirection: 'row', gap: t.space.l }}>
                <View
                  style={{
                    width: coverW,
                    height: coverH,
                    borderRadius: 14,
                    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(31, 26, 22, 0.06)',
                    borderWidth: 1,
                    borderColor: c.border,
                    overflow: 'hidden',
                  }}
                >
                  {data.inProgressBook?.coverUrl ? (
                    <Image
                      source={{ uri: data.inProgressBook.coverUrl }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="book-outline" size={28} color={c.icon} />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 6 }}>
                  <View style={{ gap: 6 }}>
                    <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      Currently reading
                    </ThemedText>

                    <ThemedText variant="title" numberOfLines={2}>
                      {data.inProgressBook?.title ?? 'Nothing in progress'}
                    </ThemedText>

                    <ThemedText tone="muted" numberOfLines={2}>
                      {data.inProgressBook
                        ? data.inProgressBook.author?.trim()
                          ? data.inProgressBook.author
                          : 'Unknown author'
                        : 'Open a book in My Books and set its status to Reading, or start a new title.'}
                    </ThemedText>
                  </View>

                  {data.inProgressBook ? (
                    <View style={{ gap: 8, paddingTop: t.space.s }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <ThemedText variant="caption" tone="muted">
                          Last updated
                        </ThemedText>
                        <ThemedText variant="caption" tone="muted">
                          {data.inProgressBook.updatedLabel ?? '—'}
                        </ThemedText>
                      </View>
                      <ThemedText variant="caption" tone="muted" style={{ fontStyle: 'italic' }}>
                        Set finished or on loan from the book page.
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Card>
        </View>

        {/* TBR & borrowed shortcuts */}
        <View style={{ gap: t.space.m }}>
          <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Shelves
          </ThemedText>

          <View
            style={{
              flexDirection: width >= 520 ? 'row' : 'column',
              gap: t.space.m,
            }}
          >
            <View style={{ flex: width >= 520 ? 1 : undefined, minWidth: 0 }}>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open to be read list"
                  onPress={() =>
                    router.push({ pathname: '/my-books', params: { filter: 'tbr' } } as Href)
                  }
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                  <View style={{ padding: t.space.xl, gap: t.space.s }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <ThemedText variant="title" numberOfLines={2} style={{ flex: 1, paddingRight: t.space.m }}>
                        To be read
                      </ThemedText>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: c.primarySoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="bookmark-outline" size={22} color={c.primary} />
                      </View>
                    </View>
                    <ThemedText tone="muted" numberOfLines={2}>
                      Everything on your TBR in one list.
                    </ThemedText>
                  </View>
                </Pressable>
              </Card>
            </View>

            <View style={{ flex: width >= 520 ? 1 : undefined, minWidth: 0 }}>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open borrowed books list"
                  onPress={() =>
                    router.push({ pathname: '/my-books', params: { filter: 'borrowed' } } as Href)
                  }
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                  <View style={{ padding: t.space.xl, gap: t.space.s }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <ThemedText variant="title" numberOfLines={2} style={{ flex: 1, paddingRight: t.space.m }}>
                        On loan
                      </ThemedText>
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: c.primarySoft,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="people-outline" size={22} color={c.primary} />
                      </View>
                    </View>
                    <ThemedText tone="muted" numberOfLines={2}>
                      Copies you’ve marked as borrowed out.
                    </ThemedText>
                  </View>
                </Pressable>
              </Card>
            </View>
          </View>
        </View>

        {/* Quick add — matches Add Book flow */}
        <View style={{ gap: t.space.m }}>
          <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Add to library
          </ThemedText>
          <View
            style={{
              flexDirection: width >= 520 ? 'row' : 'column',
              gap: t.space.m,
            }}
          >
            <View style={{ flex: width >= 520 ? 1 : undefined, minWidth: 0 }}>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Scan barcode to add a book"
                  onPress={() => router.push('/add-book-scan')}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                  <View style={{ padding: t.space.xl, flexDirection: 'row', alignItems: 'center', gap: t.space.m }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: c.primarySoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="barcode-outline" size={22} color={c.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText variant="title">Scan barcode</ThemedText>
                      <ThemedText tone="muted" numberOfLines={2}>
                        Add by ISBN from the back cover.
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.icon} />
                  </View>
                </Pressable>
              </Card>
            </View>
            <View style={{ flex: width >= 520 ? 1 : undefined, minWidth: 0 }}>
              <Card padded={false} style={{ overflow: 'hidden' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add book by typing ISBN"
                  onPress={() => router.push('/add-book-isbn')}
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                  <View style={{ padding: t.space.xl, flexDirection: 'row', alignItems: 'center', gap: t.space.m }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: c.primarySoft,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="pricetag-outline" size={22} color={c.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText variant="title">Enter ISBN</ThemedText>
                      <ThemedText tone="muted" numberOfLines={2}>
                        Type or paste an ISBN to look it up.
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.icon} />
                  </View>
                </Pressable>
              </Card>
            </View>
          </View>
        </View>

        {/* Statistics */}
        <View style={{ gap: t.space.m }}>
          <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Shelf snapshot
          </ThemedText>

          <Card padded={false}>
            <View style={{ padding: t.space.xl, flexDirection: 'row', alignItems: 'center', gap: t.space.l }}>
              <Donut
                size={donutSize}
                strokeWidth={donutStroke}
                value={data.finishedShare}
                labelTop={data.stats ? `${data.stats.finished}` : undefined}
                labelBottom="Finished"
              />

              <View style={{ flex: 1, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    In library
                  </ThemedText>
                  <ThemedText variant="caption">{data.stats ? `${data.stats.totalBooks}` : '—'}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    In progress
                  </ThemedText>
                  <ThemedText variant="caption">{data.stats ? `${data.stats.inProgress}` : '—'}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    To read
                  </ThemedText>
                  <ThemedText variant="caption">{data.stats ? `${data.stats.toRead}` : '—'}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    Dropped
                  </ThemedText>
                  <ThemedText variant="caption">{data.stats ? `${data.stats.dropped}` : '—'}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    On loan
                  </ThemedText>
                  <ThemedText variant="caption">{data.stats ? `${data.stats.onLoan}` : '—'}</ThemedText>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Recently updated */}
        {data.recentBooks.length ? (
          <View style={{ gap: t.space.m }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
                Recently updated
              </ThemedText>
              <Button
                variant="link"
                onPress={() => router.push('/my-books')}
                style={{ paddingVertical: 0, alignSelf: 'flex-end' }}
                labelStyle={{ letterSpacing: 1.2, textTransform: 'uppercase' }}
              >
                Library
              </Button>
            </View>

            <View style={{ gap: t.space.m }}>
              {data.recentBooks.map((b) => {
                const thumb = Math.round(52 * scale);
                return (
                  <Card key={b.id} padded={false} style={{ overflow: 'hidden' }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${b.title}`}
                      onPress={() => router.push({ pathname: '/book-detail', params: { id: b.id } } as Href)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                    >
                      <View style={{ padding: t.space.l, flexDirection: 'row', gap: t.space.m, alignItems: 'center' }}>
                        <View
                          style={{
                            width: thumb,
                            height: Math.round(thumb * 1.35),
                            borderRadius: 10,
                            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(31, 26, 22, 0.06)',
                            borderWidth: 1,
                            borderColor: c.border,
                            overflow: 'hidden',
                          }}
                        >
                          {b.coverUri ? (
                            <Image source={{ uri: b.coverUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                          ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                              <Ionicons name="book-outline" size={20} color={c.icon} />
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                          <ThemedText variant="title" numberOfLines={2}>
                            {b.title}
                          </ThemedText>
                          <ThemedText variant="caption" tone="muted" numberOfLines={1}>
                            {b.author?.trim() || 'Unknown author'} · {formatRelativeUpdated(b.updatedAt)}
                          </ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={c.icon} />
                      </View>
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ gap: t.space.m }}>
          <Button variant="primary" onPress={() => router.push('/my-books')} style={{ borderRadius: 14 }}>
            Open my library
          </Button>
          {!data.stats && !data.loading ? (
            <Button variant="secondary" onPress={() => router.push('/add-book')} style={{ borderRadius: 14 }}>
              Add a book
            </Button>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

