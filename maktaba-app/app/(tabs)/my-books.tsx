import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { AppName } from '@/components/AppName';
import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { listBooks } from '@/lib/db/books';

type BookListItem = {
  id: string;
  coverUri: string | null;
  author: string | null;
  title: string;
  isbn: string | null;
  pages: number | null;
  status: string;
  updatedAt: number;
};

function isPrefetchableRemoteCoverUri(uri: string) {
  const trimmed = uri.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

async function prefetchCoverUris(uris: (string | null | undefined)[]) {
  const unique = Array.from(
    new Set(
      uris
        .map((u) => (typeof u === 'string' ? u.trim() : ''))
        .filter((u) => u.length > 0 && isPrefetchableRemoteCoverUri(u))
    )
  );

  // Prefetch in small batches to avoid hammering the network on huge libraries.
  const batchSize = 12;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    try {
      await Image.prefetch(batch, { cachePolicy: 'memory-disk' });
    } catch {
      // Best-effort prefetch; rendering still works without it.
    }
  }
}

export default function MyBooksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'inProgress' | 'finished' | 'dropped'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const filters = useMemo(
    () =>
      [
        { id: 'all', label: 'All' },
        { id: 'unread', label: 'Unread' },
        { id: 'inProgress', label: 'In progress' },
        { id: 'finished', label: 'Finished' },
        { id: 'dropped', label: 'Drop' },
      ] as const,
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listBooks();
      // drizzle types can be loose at runtime; normalize the fields we render
      const normalized: BookListItem[] = rows.map((r: any) => ({
        id: String(r.id),
        coverUri: (r.coverUri ?? null) as string | null,
        author: (r.author ?? null) as string | null,
        title: String(r.title),
        isbn: (r.isbn ?? null) as string | null,
        pages: (typeof r.pages === 'number' ? r.pages : r.pages == null ? null : Number(r.pages)) as number | null,
        status: String(r.status ?? 'tbr'),
        updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Number(r.updatedAt ?? Date.now()),
      }));

      setBooks(normalized);

      // Warm the image cache so covers pop in faster (especially on revisit / refocus).
      void prefetchCoverUris(normalized.map((b) => b.coverUri));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const displayedBooks = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = books;
    if (q) {
      out = out.filter((b) => (b.title ?? '').toLowerCase().includes(q) || (b.author ?? '').toLowerCase().includes(q) || (b.isbn ?? '').includes(q));
    }

    // Placeholder mapping for your existing filter UI (until you implement real reading statuses)
    if (activeFilter !== 'all') {
      const statusMap: Record<Exclude<typeof activeFilter, 'all'>, string> = {
        unread: 'tbr',
        inProgress: 'reading',
        finished: 'read',
        dropped: 'dropped',
      };
      const desired = statusMap[activeFilter];
      out = out.filter((b) => b.status === desired);
    }

    return out;
  }, [activeFilter, books, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.xl,
          paddingBottom: t.space.xxl,
          gap: t.space.l,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s }}>
            <View
              style={{
                width: t.size.icon.l + 8,
                height: t.size.icon.l + 8,
                borderRadius: 10,
                backgroundColor: c.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="book-outline" size={t.size.icon.l} color={c.primary} />
            </View>
            <AppName variant="headline" />
          </View>
        </View>

        <Card
          style={{
            backgroundColor: scheme === 'dark' ? c.card : 'rgba(255,255,255,0.62)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: t.space.xs, paddingRight: t.space.l }}>
              <ThemedText
                style={{
                  fontFamily: BrandFonts.ebGaramond.semiBold,
                  fontSize: 40,
                  lineHeight: 44,
                }}
              >
                {displayedBooks.length} books
              </ThemedText>
              <ThemedText tone="muted" style={{ maxWidth: 220 }}>
                {loading ? 'Loading…' : 'Your curated collection'}
              </ThemedText>
            </View>

            <View
              style={{
                width: 108,
                height: 72,
                borderRadius: t.radius.l,
                backgroundColor: c.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  right: -18,
                  top: -18,
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: 'rgba(194, 101, 42, 0.10)',
                }}
              />
              <Ionicons name="book" size={34} color={c.primary} />
              <View style={{ position: 'absolute', right: 14, top: 12, flexDirection: 'row', gap: 4 }}>
                <Ionicons name="sparkles" size={12} color={(c as typeof c & { tertiary: string }).tertiary} />
                <Ionicons name="sparkles" size={10} color={(c as typeof c & { tertiary: string }).tertiary} />
              </View>
            </View>
          </View>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.xl }}>
          {filters.map((f) => {
            const selected = activeFilter === f.id;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityLabel={f.label}
                onPress={() => setActiveFilter(f.id)}
                style={({ pressed }) => [
                  {
                    paddingVertical: t.space.s,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
              >
                <ThemedText variant="label" tone={selected ? 'default' : 'muted'}>
                  {f.label}
                </ThemedText>
                <View
                  style={{
                    marginTop: 8,
                    height: 2,
                    borderRadius: 2,
                    backgroundColor: selected ? c.primary : 'transparent',
                    width: 18,
                  }}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.m }}>
          <View style={{ flex: 1 }}>
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
                gap: t.space.s,
              }}
            >
              <Ionicons name="search" size={18} color={c.icon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search my library"
                placeholderTextColor={c.placeholder}
                style={{
                  flex: 1,
                  fontFamily: BrandFonts.manrope.regular,
                  fontSize: t.typography.size.xl,
                  lineHeight: t.typography.lineHeight.m,
                  color: c.text,
                  padding: 0,
                }}
                returnKeyType="search"
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle grid view"
            onPress={() => setView((v) => (v === 'list' ? 'grid' : 'list'))}
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name={view === 'list' ? 'grid-outline' : 'list-outline'} size={20} color={c.icon} />
          </Pressable>
        </View>

        {/* Books list */}
        {displayedBooks.length ? (
          <View style={{ gap: t.space.m }}>
            {displayedBooks.map((b) => {
              const coverW = view === 'grid' ? 140 : 62;
              const coverH = view === 'grid' ? 190 : 86;

              return (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open details for ${b.title}`}
                  onPress={() =>
                    router.push({ pathname: '/book-detail', params: { id: b.id } } as Href)
                  }
                  style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
                >
                  <Card padded={false} style={{ overflow: 'hidden' }}>
                  <View style={{ padding: t.space.l, flexDirection: view === 'grid' ? 'column' : 'row', gap: t.space.l }}>
                    <View
                      style={{
                        width: coverW,
                        height: coverH,
                        borderRadius: 12,
                        backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(31, 26, 22, 0.06)',
                        borderWidth: 1,
                        borderColor: c.border,
                        overflow: 'hidden',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {b.coverUri ? (
                        <Image
                          recyclingKey={b.id}
                          source={{ uri: b.coverUri }}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          priority="high"
                          allowDownscaling
                          transition={0}
                        />
                      ) : (
                        <Ionicons name="book-outline" size={24} color={c.icon} />
                      )}
                    </View>

                    <View style={{ flex: 1, gap: 6 }}>
                      <ThemedText variant="title" numberOfLines={2}>
                        {b.title}
                      </ThemedText>
                      <ThemedText tone="muted" numberOfLines={1}>
                        {b.author ?? 'Unknown author'}
                      </ThemedText>
                      <ThemedText variant="caption" tone="muted">
                        {b.isbn ? `ISBN: ${b.isbn}` : ''}
                        {b.pages ? `  ·  ${b.pages} pages` : ''}
                      </ThemedText>
                    </View>
                  </View>
                </Card>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Card>
            <View style={{ gap: 6 }}>
              <ThemedText variant="title">No books yet</ThemedText>
              <ThemedText tone="muted">Add your first book by scanning the ISBN or typing it in.</ThemedText>
            </View>
          </Card>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add more to your shelf"
          onPress={() => router.push('/add-book')}
          style={({ pressed }) => [
            {
              borderRadius: t.radius.m,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: c.border,
              backgroundColor: pressed ? 'rgba(0,0,0,0.01)' : 'transparent',
              padding: t.space.xxl,
              alignItems: 'center',
              justifyContent: 'center',
              gap: t.space.s,
              minHeight: 150,
            },
          ]}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={22} color={c.icon} />
          </View>
          <ThemedText variant="title" align="center">
            Add more to your shelf
          </ThemedText>
          <ThemedText tone="muted" align="center" style={{ maxWidth: 260 }}>
            Discover new titles and keep track of your reading journey.
          </ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

