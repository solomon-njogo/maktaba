import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

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

type BookPreview = {
  title: string;
  subtitle?: string;
  authors: string[];
  publishedYear?: number;
  language?: string;
  edition?: string;
  publisher?: string;
  categories?: string[];
  tags?: string[];
  description?: string;
  isbn10?: string;
  isbn13?: string;
  format?: string;
  pages?: number;
  averageRating?: number;
  ratingsCount?: number;
  status?: Filter;
  progressPercent?: number;
  startedAt?: string;
  lastReadAt?: string;
  coverUrl?: string;
  location?: string;
  availability?: 'Available' | 'Borrowed' | 'Reserved';
};

function FieldRow({
  label,
  value,
  t,
  c,
}: {
  label: string;
  value: React.ReactNode;
  t: ReturnType<typeof useTokens>;
  c: (typeof Colors)['light'];
}) {
  return (
    <View style={[styles.fieldRow, { gap: t.space.s }]}>
      <Text style={{ color: c.mutedText, fontSize: t.typography.size.s, fontWeight: t.typography.weight.bold }}>
        {label}
      </Text>
      <View style={{ flex: 1 }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text style={{ color: c.text, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold }}>
            {String(value)}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export default function BooksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const { width } = useWindowDimensions();

  const [topTab, setTopTab] = useState<TopTab>('books');
  const [filter, setFilter] = useState<Filter>('All');

  const totalLabel = useMemo(() => (topTab === 'books' ? '1 book' : '0 collections'), [topTab]);
  const hasItems = true;
  // Breakpoints are unitless thresholds — don't scale them.
  const wide = width >= t.breakpoints.tablet;

  const book: BookPreview = useMemo(
    () => ({
      title: 'The 48 Laws of Power',
      subtitle: 'A Modern Classic on Power & Strategy',
      authors: ['Robert Greene'],
      publishedYear: 1998,
      language: 'English',
      edition: 'Reprint',
      publisher: 'Viking',
      categories: ['Self-help', 'Psychology', 'Strategy'],
      tags: ['Non-fiction', 'Leadership', 'Mindset'],
      description:
        'A guide to understanding the dynamics of power—through historical examples, practical lessons, and cautions about misuse.',
      isbn10: '0670881465',
      isbn13: '9780670881468',
      format: 'Paperback',
      pages: 452,
      averageRating: 4.4,
      ratingsCount: 210000,
      status: 'In progress',
      progressPercent: 46,
      startedAt: '2026-03-12',
      lastReadAt: '2026-04-01',
      coverUrl: COVER,
      location: 'Shelf A • Row 2',
      availability: 'Available',
    }),
    []
  );

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

          <View style={[styles.previewWrap, { gap: t.space.l }]}>
            <View style={[styles.previewTop, { gap: t.space.l, flexDirection: wide ? 'row' : 'column' }]}>
              <View style={[styles.coverRow, { gap: t.space.m }]}>
                <Image
                  source={{ uri: book.coverUrl ?? COVER }}
                  style={{
                    width: t.scale.n(wide ? 104 : 88),
                    height: t.scale.n(wide ? 140 : 118),
                    borderRadius: t.radius.l,
                    backgroundColor: c.placeholder,
                  }}
                />
                <View style={[styles.titleBlock, { gap: t.space.xs }]}>
                  <Text
                    style={{ color: c.text, fontSize: t.typography.size.title, fontWeight: t.typography.weight.black }}
                    numberOfLines={2}>
                    {book.title}
                  </Text>
                  {!!book.subtitle && (
                    <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold }} numberOfLines={2}>
                      {book.subtitle}
                    </Text>
                  )}
                  <Text style={{ color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }} numberOfLines={1}>
                    {book.authors.join(', ')}
                  </Text>

                  <View style={[styles.badge, { marginTop: t.space.s, gap: t.space.xs, paddingHorizontal: t.space.m, paddingVertical: t.space.s, borderRadius: t.radius.pill, backgroundColor: c.primarySoft }]}>
                    <MaterialIcons name="hourglass-bottom" size={t.size.icon.s} color={c.primary} />
                    <Text style={{ color: c.primary, fontSize: t.typography.size.m, fontWeight: t.typography.weight.extraBold }}>
                      {book.status ?? 'Unread'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.actionsBlock, { gap: t.space.s }]}>
                <PrimaryButton title={book.status === 'Finished' ? 'Read again' : 'Continue'} onPress={() => {}} />
                <PrimaryButton title="Details" onPress={() => {}} variant="outline" />
              </View>
            </View>

            <View style={[styles.detailsGrid, { gap: t.space.l, flexDirection: wide ? 'row' : 'column' }]}>
              <View style={[styles.detailsCol, { gap: t.space.m }]}>
                <Text style={{ color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.black }}>About</Text>
                <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold, lineHeight: t.typography.lineHeight.m }}>
                  {book.description ?? 'No description yet.'}
                </Text>
              </View>

              <View style={[styles.detailsCol, { gap: t.space.m }]}>
                <Text style={{ color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.black }}>Details</Text>

                <View style={[styles.fieldsGroup, { gap: t.space.s }]}>
                  <FieldRow label="Year" value={book.publishedYear ?? '—'} t={t} c={c} />
                  <FieldRow label="Publisher" value={book.publisher ?? '—'} t={t} c={c} />
                  <FieldRow label="Edition" value={book.edition ?? '—'} t={t} c={c} />
                  <FieldRow label="Language" value={book.language ?? '—'} t={t} c={c} />
                  <FieldRow label="Format" value={book.format ?? '—'} t={t} c={c} />
                  <FieldRow label="Pages" value={book.pages ?? '—'} t={t} c={c} />
                  <FieldRow label="ISBN-10" value={book.isbn10 ?? '—'} t={t} c={c} />
                  <FieldRow label="ISBN-13" value={book.isbn13 ?? '—'} t={t} c={c} />
                  <FieldRow
                    label="Rating"
                    value={
                      <Text style={{ color: c.text, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold }}>
                        {book.averageRating ? `${book.averageRating.toFixed(1)} / 5` : '—'}{' '}
                        <Text style={{ color: c.mutedText, fontWeight: t.typography.weight.bold }}>
                          {book.ratingsCount ? `(${Intl.NumberFormat().format(book.ratingsCount)})` : ''}
                        </Text>
                      </Text>
                    }
                    t={t}
                    c={c}
                  />
                  <FieldRow label="Availability" value={book.availability ?? '—'} t={t} c={c} />
                  <FieldRow label="Location" value={book.location ?? '—'} t={t} c={c} />
                  <FieldRow label="Started" value={book.startedAt ?? '—'} t={t} c={c} />
                  <FieldRow label="Last read" value={book.lastReadAt ?? '—'} t={t} c={c} />
                  <FieldRow
                    label="Progress"
                    value={book.progressPercent != null ? `${book.progressPercent}%` : '—'}
                    t={t}
                    c={c}
                  />
                </View>
              </View>
            </View>

            <View style={[styles.metaChips, { gap: t.space.s }]}>
              {!!book.categories?.length && (
                <View style={[styles.metaChipsRow, { gap: t.space.s }]}>
                  {book.categories.map((x) => (
                    <Chip key={`cat-${x}`} label={x} selected={false} onPress={() => {}} />
                  ))}
                </View>
              )}
              {!!book.tags?.length && (
                <View style={[styles.metaChipsRow, { gap: t.space.s }]}>
                  {book.tags.map((x) => (
                    <Chip key={`tag-${x}`} label={x} selected={false} onPress={() => {}} />
                  ))}
                </View>
              )}
            </View>
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
  previewWrap: {},
  previewTop: {
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleBlock: {
    flex: 1,
  },
  actionsBlock: {
    alignSelf: 'flex-start',
    minWidth: 160,
  },
  detailsGrid: {},
  detailsCol: {
    flex: 1,
  },
  fieldsGroup: {},
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaChips: {},
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

