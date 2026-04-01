import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type Filter = 'All' | 'Unread' | 'In progress' | 'Finished' | 'Dropped';
type TopTab = 'books' | 'collections';

const COVER =
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop&q=60';

export default function BooksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const [topTab, setTopTab] = useState<TopTab>('books');
  const [filter, setFilter] = useState<Filter>('All');

  const totalLabel = useMemo(() => (topTab === 'books' ? '1 book' : '0 collections'), [topTab]);
  const hasItems = true;

  return (
    <Screen
      header={
        <AppHeader
          title="Library"
          subtitle={totalLabel}
          leftVisual={<MaterialIcons name="auto-stories" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={<MaterialIcons name="search" size={t.size.icon.xl} color={c.onPrimary} />}>
          <View style={{ marginTop: t.space.l }}>
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
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth }}>
      <View style={[styles.topRow, { paddingHorizontal: t.space.s, marginBottom: t.space.xs }]}>
        <Text style={[styles.total, { color: c.text, fontSize: t.typography.size.title, fontWeight: t.typography.weight.black }]}>
          {topTab === 'books' ? 'Your books' : 'Collections'}
        </Text>
        <MaterialIcons name="menu-book" size={t.size.icon.jumbo} color={c.primarySoft} />
      </View>

      <View style={[styles.chipsRow, { gap: t.space.m }]}>
        {(['All', 'Unread', 'In progress', 'Finished', 'Dropped'] as const).map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {!hasItems ? (
        <Card>
          <Text style={{ color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }}>
            No books yet
          </Text>
          <Text style={{ color: c.mutedText, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.semiBold }}>
            Use the Add button to scan a barcode, import a list, or add manually.
          </Text>
        </Card>
      ) : (
        <Card style={{ padding: t.space.l }}>
          <View style={[styles.toolsRow, { marginBottom: t.space.s }]}>
            <View style={[styles.toolsLeft, { gap: t.space.l }]}>
              <MaterialIcons name="sort" size={t.size.icon.l} color={c.mutedText} />
              <MaterialIcons name="grid-view" size={t.size.icon.l} color={c.mutedText} />
            </View>
            <MaterialIcons name="search" size={t.size.icon.l} color={c.mutedText} />
          </View>

          <View style={[styles.bookCard, { gap: t.space.m }]}>
            <Image
              source={{ uri: COVER }}
              style={{
                width: t.scale.n(76),
                height: t.scale.n(98),
                borderRadius: t.radius.m,
                backgroundColor: c.placeholder,
              }}
            />
            <View style={[styles.bookMeta, { gap: t.space.xs }]}>
              <Text style={[styles.bookTitle, { color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.black }]} numberOfLines={1}>
                The 48 laws of power
              </Text>
              <Text style={[styles.bookAuthor, { color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }]} numberOfLines={1}>
                Robert Greene
              </Text>
              <View
                style={[
                  styles.badge,
                  {
                    marginTop: t.space.s,
                    gap: t.space.xs,
                    paddingHorizontal: t.space.m,
                    paddingVertical: t.space.s,
                    borderRadius: t.radius.pill,
                    backgroundColor: c.primarySoft,
                  },
                ]}>
                <MaterialIcons name="hourglass-bottom" size={t.size.icon.s} color={c.primary} />
                <Text style={[styles.badgeText, { color: c.primary, fontSize: t.typography.size.m, fontWeight: t.typography.weight.extraBold }]}>
                  In progress
                </Text>
              </View>
            </View>
            <PrimaryButton title="Finish" onPress={() => {}} style={{ alignSelf: 'center' }} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  total: {},
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolsLeft: {
    flexDirection: 'row',
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookMeta: {
    flex: 1,
  },
  bookTitle: {},
  bookAuthor: {},
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeText: {
    
  },
});

