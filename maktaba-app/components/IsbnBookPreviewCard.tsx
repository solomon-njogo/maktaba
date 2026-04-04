import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import type { OpenLibraryBook } from '@/middleware';

type Props = {
  book: OpenLibraryBook;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  coverRecyclingKeySuffix?: string;
};

export function IsbnBookPreviewCard({
  book,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  coverRecyclingKeySuffix = '',
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ padding: t.space.l, flexDirection: 'row', gap: t.space.l }}>
        <View
          style={{
            width: 84,
            height: 112,
            borderRadius: 12,
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(31, 26, 22, 0.06)',
            borderWidth: 1,
            borderColor: c.border,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {book.coverUrl ? (
            <Image
              recyclingKey={`${book.isbn}${coverRecyclingKeySuffix}`}
              source={{ uri: book.coverUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              priority="high"
              allowDownscaling
              transition={0}
            />
          ) : (
            <Ionicons name="book-outline" size={26} color={c.icon} />
          )}
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <ThemedText variant="title" numberOfLines={2}>
            {book.title}
          </ThemedText>
          {book.subtitle ? (
            <ThemedText tone="muted" numberOfLines={1}>
              {book.subtitle}
            </ThemedText>
          ) : null}
          <ThemedText tone="muted" numberOfLines={1}>
            {book.authors?.length ? book.authors.join(', ') : 'Unknown author'}
          </ThemedText>
          <ThemedText variant="caption" tone="muted">
            ISBN: {book.isbn}
            {book.numberOfPages ? ` · ${book.numberOfPages} pages` : ''}
          </ThemedText>
        </View>
      </View>

      <View style={{ paddingHorizontal: t.space.l, paddingBottom: t.space.l, gap: t.space.s }}>
        <Button variant="primary" onPress={onPrimary} style={{ borderRadius: 14 }}>
          {primaryLabel}
        </Button>
        <Button variant="secondary" onPress={onSecondary} style={{ borderRadius: 14 }}>
          {secondaryLabel}
        </Button>
      </View>
    </Card>
  );
}
