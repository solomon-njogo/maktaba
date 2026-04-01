import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Radius } from '@/constants/radius';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Filter = 'All' | 'Unread' | 'In progress' | 'Finished' | 'Dropped';
type TopTab = 'books' | 'collections';

const COVER =
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop&q=60';

export default function BooksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { width } = useWindowDimensions();
  const pad = Math.max(14, Math.min(20, width * 0.05));

  const [topTab, setTopTab] = useState<TopTab>('books');
  const [filter, setFilter] = useState<Filter>('All');

  const totalLabel = useMemo(() => (topTab === 'books' ? '1 book' : '0 collections'), [topTab]);

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <AppHeader
          title=""
          subtitle=""
          leftVisual={<MaterialIcons name="auto-stories" size={32} color="#fff" />}
          rightVisual={<MaterialIcons name="search" size={26} color="#fff" />}>
          <View style={{ marginTop: 14 }}>
            <SegmentedTabs<TopTab>
              items={[
                { key: 'books', label: 'Books' },
                { key: 'collections', label: 'Collections' },
              ]}
              value={topTab}
              onChange={setTopTab}
            />
          </View>
        </AppHeader>

        <View style={{ paddingHorizontal: pad, marginTop: -54, gap: 14 }}>
          <View style={styles.topRow}>
            <Text style={[styles.total, { color: c.text }]}>{totalLabel}</Text>
            <MaterialIcons name="menu-book" size={34} color={c.primarySoft} />
          </View>

          <View style={styles.chipsRow}>
            {(['All', 'Unread', 'In progress', 'Finished', 'Dropped'] as const).map((f) => (
              <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>

          <Card style={{ padding: 14 }}>
            <View style={styles.toolsRow}>
              <View style={styles.toolsLeft}>
                <MaterialIcons name="sort" size={22} color={c.mutedText} />
                <MaterialIcons name="grid-view" size={22} color={c.mutedText} />
              </View>
              <MaterialIcons name="search" size={22} color={c.mutedText} />
            </View>

            <View style={styles.bookCard}>
              <Image source={{ uri: COVER }} style={styles.cover} />
              <View style={styles.bookMeta}>
                <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={1}>
                  The 48 laws of power
                </Text>
                <Text style={[styles.bookAuthor, { color: c.mutedText }]} numberOfLines={1}>
                  Robert Greene
                </Text>
                <View style={styles.badge}>
                  <MaterialIcons name="hourglass-bottom" size={14} color={c.primary} />
                  <Text style={[styles.badgeText, { color: c.primary }]}>In progress</Text>
                </View>
              </View>
              <PrimaryButton title="Finish" onPress={() => {}} style={{ alignSelf: 'center' }} />
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  total: {
    fontSize: 22,
    fontWeight: '900',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  toolsLeft: {
    flexDirection: 'row',
    gap: 14,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cover: {
    width: 76,
    height: 98,
    borderRadius: Radius.m,
    backgroundColor: '#ddd',
  },
  bookMeta: {
    flex: 1,
    gap: 4,
  },
  bookTitle: { fontSize: 14, fontWeight: '900' },
  bookAuthor: { fontSize: 12, fontWeight: '700' },
  badge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(243,122,44,0.12)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

