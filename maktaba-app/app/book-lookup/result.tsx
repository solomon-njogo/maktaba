import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Colors } from '@/constants/theme';
import { validateIsbnCandidate } from '@/lib/isbn';
import { fetchBookByIsbn, OpenLibraryBook } from '@/lib/openlibrary';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; book: OpenLibraryBook | null }
  | { status: 'error'; message: string };

export default function BookLookupResult() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const params = useLocalSearchParams<{ isbn?: string; source?: string }>();
  const isbnParam = typeof params.isbn === 'string' ? params.isbn : '';

  const isbnValidation = useMemo(() => validateIsbnCandidate(isbnParam), [isbnParam]);
  const isbn = isbnValidation.ok ? isbnValidation.normalized : null;

  const [state, setState] = useState<LoadState>({ status: 'idle' });

  useEffect(() => {
    if (!isbn) {
      setState({ status: 'error', message: 'Invalid ISBN. Go back and try again.' });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading' });
    fetchBookByIsbn(isbn, { signal: controller.signal })
      .then((book) => setState({ status: 'loaded', book }))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setState({ status: 'error', message: msg });
      });

    return () => controller.abort();
  }, [isbn]);

  const headerSubtitle =
    state.status === 'loading'
      ? 'Looking it up in Open Library…'
      : state.status === 'loaded' && state.book
        ? `ISBN ${state.book.isbn}`
        : isbn
          ? `ISBN ${isbn}`
          : 'Book lookup';

  const content = (() => {
    if (state.status === 'loading' || state.status === 'idle') {
      return (
        <Card style={{ padding: t.space.l }}>
          <Text style={{ color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }}>
            Searching…
          </Text>
          <Text style={{ color: c.mutedText, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.semiBold }}>
            This usually takes a second.
          </Text>
        </Card>
      );
    }

    if (state.status === 'error') {
      return (
        <Card style={{ padding: t.space.l }}>
          <Text style={{ color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }}>
            Something went wrong
          </Text>
          <Text style={{ color: c.mutedText, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.semiBold }}>
            {state.message}
          </Text>
          <View style={{ height: t.space.m }} />
          <View style={{ flexDirection: 'row', gap: t.space.m }}>
            <PrimaryButton title="Try again" onPress={() => isbn && router.replace({ pathname: '/book-lookup/result', params: { isbn } })} style={{ flex: 1 }} />
            <PrimaryButton title="Back" variant="outline" onPress={() => router.back()} />
          </View>
        </Card>
      );
    }

    if (!state.book) {
      return (
        <Card style={{ padding: t.space.l }}>
          <Text style={{ color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }}>
            No match found
          </Text>
          <Text style={{ color: c.mutedText, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.semiBold }}>
            Open Library didn’t return a book for this ISBN.
          </Text>
          <View style={{ height: t.space.m }} />
          <View style={{ flexDirection: 'row', gap: t.space.m }}>
            <PrimaryButton title="Try another ISBN" onPress={() => router.replace('/book-lookup/manual')} style={{ flex: 1 }} />
            <PrimaryButton title="Scan" variant="outline" onPress={() => router.replace('/book-lookup/scan')} />
          </View>
        </Card>
      );
    }

    const book = state.book;
    const authorLine = book.authors.length ? book.authors.join(', ') : 'Unknown author';
    const metaBits = [
      book.publishDate ? `Published ${book.publishDate}` : null,
      typeof book.numberOfPages === 'number' ? `${book.numberOfPages} pages` : null,
    ].filter((x): x is string => Boolean(x));

    return (
      <View style={{ gap: t.space.l }}>
        <Card style={{ padding: t.space.l }}>
          <View style={[styles.row, { gap: t.space.m, alignItems: 'flex-start' }]}>
            {book.coverUrl ? (
              <Image
                source={{ uri: book.coverUrl }}
                style={{
                  width: t.scale.n(92),
                  height: t.scale.n(120),
                  borderRadius: t.radius.m,
                  backgroundColor: c.placeholder,
                }}
              />
            ) : (
              <View
                style={{
                  width: t.scale.n(92),
                  height: t.scale.n(120),
                  borderRadius: t.radius.m,
                  backgroundColor: c.placeholder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <MaterialIcons name="menu-book" size={t.size.icon.xl} color={c.mutedText} />
              </View>
            )}
            <View style={{ flex: 1, gap: t.space.xs }}>
              <Text style={{ color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }}>
                {book.title}
              </Text>
              {book.subtitle ? (
                <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.bold }}>
                  {book.subtitle}
                </Text>
              ) : null}
              <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold }}>
                {authorLine}
              </Text>
              {metaBits.length ? (
                <Text style={{ color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.semiBold }}>
                  {metaBits.join(' • ')}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {book.description ? (
          <Card style={{ padding: t.space.l }}>
            <Text style={{ color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.black }}>
              About
            </Text>
            <View style={{ height: t.space.s }} />
            <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold }}>
              {book.description}
            </Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: t.space.m }}>
          <PrimaryButton title="Done" onPress={() => router.back()} style={{ flex: 1 }} />
          <PrimaryButton title="Search another" variant="outline" onPress={() => router.replace('/book-lookup/manual')} />
        </View>
      </View>
    );
  })();

  return (
    <Screen
      header={
        <AppHeader
          title="Book preview"
          subtitle={headerSubtitle}
          leftVisual={<MaterialIcons name="menu-book" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: t.space.s }}>
              <MaterialIcons name="close" size={t.size.icon.xl} color={c.onPrimary} />
            </Pressable>
          }
        />
      }
      // Avoid pulling content under the header curve on this screen
      // (the preview card is tall and can get overlapped).
      contentStyle={{ marginTop: t.space.l }}>
      {content}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});

