import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, TextInput, View } from 'react-native';

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { AppName } from '@/components/AppName';
import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function MyBooksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'inProgress' | 'finished' | 'dropped'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');

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

  /**
   * Data gets wired in later (store/api). Keep screen UI ready without hard-coded fake content.
   * Replace this with your real library list when available.
   */
  const books = useMemo<unknown[]>(() => [], []);
  const displayedBooks = books;

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
                {displayedBooks.length} book
              </ThemedText>
              <ThemedText tone="muted" style={{ maxWidth: 220 }}>
                Your curated collection
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

        {/* Books list renders once real data is wired in. */}
        {displayedBooks.length ? null : null}

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

