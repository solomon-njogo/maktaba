import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Modal, Pressable, SafeAreaView, ScrollView, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { AppName } from '@/components/AppName';
import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { addBook } from '@/lib/db/books';
import { barcodeToIsbnCandidate, validateIsbnCandidate } from '@/lib/isbn';
import { fetchBookByIsbn, type OpenLibraryBook } from '@/lib/openlibrary';

type ActionCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function ActionCard({ icon, label, onPress }: ActionCardProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          transform: [{ translateY: pressed ? 1 : 0 }],
        },
      ]}
    >
      <Card
        padded={false}
        style={[
          {
            borderRadius: 14,
          },
        ]}
      >
        <View
          style={{
            paddingHorizontal: t.space.xl,
            paddingVertical: t.space.l,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: t.space.m,
            minHeight: Math.round(t.size.button.minHeight * 1.12),
          }}
        >
          <Ionicons name={icon} size={22} color={c.primary} />
          <ThemedText variant="body" style={{ fontFamily: BrandFonts.manrope.semiBold }}>
            {label}
          </ThemedText>
        </View>
      </Card>
    </Pressable>
  );
}

export default function AddBookScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [query, setQuery] = useState(''); // title/author (future)
  const [isbnInput, setIsbnInput] = useState('');
  const [mode, setMode] = useState<'none' | 'isbn' | 'scan'>('none');

  const [permission, requestPermission] = useCameraPermissions();
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OpenLibraryBook | null>(null);

  const lastScannedRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const approvalY = useRef(new Animated.Value(1)).current; // 1 = hidden, 0 = shown
  const [approvalOpen, setApprovalOpen] = useState(false);

  const scale = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, (width - 360) / 520));
    return 1 + clamped * 0.25;
  }, [width]);

  const titleSize = Math.round(t.typography.size.headerTitle * 1.02 * scale);
  const subtitleSize = Math.round(t.typography.size.l * scale);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function openApprovalSheet() {
    setApprovalOpen(true);
    approvalY.stopAnimation();
    approvalY.setValue(1);
    Animated.timing(approvalY, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }

  function closeApprovalSheet() {
    approvalY.stopAnimation();
    Animated.timing(approvalY, { toValue: 1, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setApprovalOpen(false);
    });
  }

  async function runLookup(isbnCandidate: string) {
    const v = validateIsbnCandidate(isbnCandidate);
    if (!v.ok) {
      setLookupError(
        v.reason === 'empty'
          ? 'Please enter an ISBN.'
          : v.reason === 'too_short'
            ? 'That ISBN looks too short.'
            : v.reason === 'invalid_checksum'
              ? 'That ISBN checksum is invalid.'
              : 'Please enter a valid ISBN-10 or ISBN-13.'
      );
      setPreview(null);
      return;
    }

    setLookupError(null);
    setLookupLoading(true);
    setPreview(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const book = await fetchBookByIsbn(v.normalized, { signal: controller.signal });
      if (!book) {
        setLookupError('No results found for that ISBN.');
        setPreview(null);
        return;
      }
      setPreview(book);
      setIsbnInput(v.normalized);
      if (mode === 'scan') openApprovalSheet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lookup failed';
      setLookupError(msg.startsWith('OpenLibraryError:') ? 'OpenLibrary lookup failed. Try again.' : msg);
      setPreview(null);
    } finally {
      setLookupLoading(false);
    }
  }

  async function savePreview() {
    if (!preview) return;
    const id =
      typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `book_${Date.now()}`;

    try {
      await addBook({
        id,
        isbn: preview.isbn,
        title: preview.subtitle ? `${preview.title}: ${preview.subtitle}` : preview.title,
        author: preview.authors?.length ? preview.authors.join(', ') : null,
        pages: preview.numberOfPages ?? null,
        description: preview.description ?? null,
        coverUri: preview.coverUrl ?? null,
        status: 'tbr',
      });

      Alert.alert('Saved', 'Book added to your library.');
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      // SQLite unique constraint on ISBN can surface as a generic error; keep it user-friendly.
      if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('constraint')) {
        Alert.alert('Already added', 'This ISBN is already in your library.');
        return;
      }
      Alert.alert('Could not save', msg);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.xxl,
          paddingBottom: t.space.xxl,
          gap: t.space.xl,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s }}>
            <Ionicons name="book-outline" size={20} color={c.primary} />
            <AppName variant="title" size={Math.round(t.typography.size.title * scale)} />
          </View>
        </View>

        {/* Title */}
        <View style={{ gap: Math.max(6, Math.round(t.space.xs * scale)) }}>
          <ThemedText
            variant="headline"
            style={{
              fontFamily: BrandFonts.ebGaramond.semiBold,
              fontSize: titleSize,
            }}
          >
            Add a Book
          </ThemedText>
          <ThemedText tone="muted" style={{ fontSize: subtitleSize }}>
            Search by title, author, or ISBN
          </ThemedText>
        </View>

        {/* Search */}
        <View style={{ gap: t.space.l }}>
          <View
            style={{
              backgroundColor: c.card,
              borderColor: c.primary,
              borderWidth: 1.25,
              borderRadius: 14,
              paddingHorizontal: t.space.l,
              paddingVertical: t.space.m,
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.space.m,
            }}
          >
            <Ionicons name="search-outline" size={20} color={c.primary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Great Gatsby, Orwell…"
              placeholderTextColor={c.placeholder}
              returnKeyType="search"
              style={{
                flex: 1,
                fontFamily: BrandFonts.manrope.regular,
                fontSize: Math.round(t.typography.size.l * scale),
                color: c.text,
                padding: 0,
              }}
            />
          </View>

          {/* ISBN flow */}
          {mode === 'isbn' ? (
            <Card>
              <View style={{ gap: t.space.m }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.m }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s }}>
                    <Ionicons name="pricetag-outline" size={18} color={c.primary} />
                    <ThemedText variant="title">Add by ISBN</ThemedText>
                  </View>
                  <Button variant="link" onPress={() => setMode('none')}>
                    Close
                  </Button>
                </View>

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
                    gap: t.space.m,
                  }}
                >
                  <Ionicons name="barcode-outline" size={18} color={c.icon} />
                  <TextInput
                    value={isbnInput}
                    onChangeText={setIsbnInput}
                    placeholder="ISBN-10 or ISBN-13"
                    placeholderTextColor={c.placeholder}
                    keyboardType="number-pad"
                    returnKeyType="search"
                    onSubmitEditing={() => runLookup(isbnInput)}
                    style={{
                      flex: 1,
                      fontFamily: BrandFonts.manrope.regular,
                      fontSize: Math.round(t.typography.size.l * scale),
                      color: c.text,
                      padding: 0,
                    }}
                  />
                  <Button variant="secondary" onPress={() => runLookup(isbnInput)} disabled={lookupLoading}>
                    {lookupLoading ? 'Searching…' : 'Search'}
                  </Button>
                </View>

                {lookupError ? (
                  <ThemedText tone="muted" style={{ color: c.tertiary }}>
                    {lookupError}
                  </ThemedText>
                ) : null}

                {preview ? (
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
                        {preview.coverUrl ? (
                          <Image source={{ uri: preview.coverUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : (
                          <Ionicons name="book-outline" size={26} color={c.icon} />
                        )}
                      </View>

                      <View style={{ flex: 1, gap: 6 }}>
                        <ThemedText variant="title" numberOfLines={2}>
                          {preview.title}
                        </ThemedText>
                        {preview.subtitle ? (
                          <ThemedText tone="muted" numberOfLines={1}>
                            {preview.subtitle}
                          </ThemedText>
                        ) : null}
                        <ThemedText tone="muted" numberOfLines={1}>
                          {preview.authors?.length ? preview.authors.join(', ') : 'Unknown author'}
                        </ThemedText>
                        <ThemedText variant="caption" tone="muted">
                          ISBN: {preview.isbn}
                          {preview.numberOfPages ? ` · ${preview.numberOfPages} pages` : ''}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={{ paddingHorizontal: t.space.l, paddingBottom: t.space.l, gap: t.space.s }}>
                      <Button variant="primary" onPress={savePreview} style={{ borderRadius: 14 }}>
                        Save to My Books
                      </Button>
                      <Button variant="secondary" onPress={() => setPreview(null)} style={{ borderRadius: 14 }}>
                        Not this one
                      </Button>
                    </View>
                  </Card>
                ) : null}
              </View>
            </Card>
          ) : null}

          {/* Scan flow */}
          {mode === 'scan' ? (
            <Card>
              <View style={{ gap: t.space.m }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.m }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s }}>
                    <Ionicons name="barcode-outline" size={18} color={c.primary} />
                    <ThemedText variant="title">Scan ISBN</ThemedText>
                  </View>
                  <Button variant="link" onPress={() => setMode('none')}>
                    Close
                  </Button>
                </View>

                {permission?.granted ? (
                  <View
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor: c.card,
                      height: 320,
                    }}
                  >
                    <CameraView
                      style={{ flex: 1 }}
                      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'upc_e', 'ean8', 'code128', 'code39', 'qr'] }}
                      onBarcodeScanned={(result) => {
                        if (approvalOpen) return;
                        const data = result?.data ?? '';
                        const candidate = barcodeToIsbnCandidate(data) ?? data;
                        if (!candidate) return;

                        // Prevent rapid duplicate scans
                        if (lastScannedRef.current === candidate) return;
                        lastScannedRef.current = candidate;

                        setIsbnInput(candidate);
                        void runLookup(candidate);
                      }}
                    />
                  </View>
                ) : (
                  <View style={{ gap: t.space.s }}>
                    <ThemedText tone="muted">Camera permission is required to scan barcodes.</ThemedText>
                    <Button variant="primary" onPress={() => requestPermission()} style={{ borderRadius: 14 }}>
                      Allow camera
                    </Button>
                  </View>
                )}

                {lookupLoading ? <ThemedText tone="muted">Looking up book…</ThemedText> : null}
                {lookupError ? (
                  <ThemedText tone="muted" style={{ color: c.tertiary }}>
                    {lookupError}
                  </ThemedText>
                ) : null}

                {preview ? (
                  <ThemedText tone="muted">
                    Found a match — review it in the bottom sheet to approve & save.
                  </ThemedText>
                ) : null}
              </View>
            </Card>
          ) : null}

          <View style={{ gap: t.space.m }}>
            <ActionCard
              icon="barcode-outline"
              label="Scan Barcode"
              onPress={async () => {
                setLookupError(null);
                setPreview(null);
                setMode('scan');
                if (!permission?.granted) await requestPermission();
              }}
            />
            <ActionCard
              icon="pricetag-outline"
              label="Add by ISBN"
              onPress={() => {
                setLookupError(null);
                setPreview(null);
                setMode('isbn');
              }}
            />
            <ActionCard icon="cloud-upload-outline" label="Import books" onPress={() => {}} />
            <ActionCard icon="create-outline" label="Add Manually" onPress={() => {}} />
          </View>
        </View>

        {/* Bottom actions (optional, matches existing wiring) */}
        <View style={{ paddingTop: t.space.s, gap: t.space.m }}>
          <Button variant="link" onPress={() => router.back()} style={{ alignSelf: 'center' }}>
            Close
          </Button>
        </View>
      </ScrollView>

      <Modal visible={approvalOpen} transparent animationType="none" onRequestClose={closeApprovalSheet}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close preview"
            onPress={closeApprovalSheet}
            style={{ flex: 1 }}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
          </Pressable>

          <Animated.View
            style={{
              transform: [
                {
                  translateY: approvalY.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.min(520, Math.round(height * 0.72))],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                backgroundColor: c.background,
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                borderWidth: 1,
                borderColor: c.border,
                paddingHorizontal: t.space.xl,
                paddingTop: t.space.m,
                paddingBottom: t.space.xl,
                gap: t.space.m,
                maxHeight: Math.min(560, Math.round(height * 0.78)),
              }}
            >
              <View style={{ alignItems: 'center', paddingVertical: 6 }}>
                <View
                  style={{
                    width: 44,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(31, 26, 22, 0.16)',
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.m }}>
                <ThemedText variant="title">Approve book?</ThemedText>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeApprovalSheet}>
                  <Ionicons name="close" size={22} color={c.icon} />
                </Pressable>
              </View>

              {preview ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: t.space.m }}>
                  <Card padded={false} style={{ overflow: 'hidden' }}>
                    <View style={{ padding: t.space.l, flexDirection: 'row', gap: t.space.l }}>
                      <View
                        style={{
                          width: 92,
                          height: 124,
                          borderRadius: 12,
                          backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(31, 26, 22, 0.06)',
                          borderWidth: 1,
                          borderColor: c.border,
                          overflow: 'hidden',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {preview.coverUrl ? (
                          <Image source={{ uri: preview.coverUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : (
                          <Ionicons name="book-outline" size={26} color={c.icon} />
                        )}
                      </View>

                      <View style={{ flex: 1, gap: 6 }}>
                        <ThemedText variant="title" numberOfLines={2}>
                          {preview.title}
                        </ThemedText>
                        {preview.subtitle ? (
                          <ThemedText tone="muted" numberOfLines={2}>
                            {preview.subtitle}
                          </ThemedText>
                        ) : null}
                        <ThemedText tone="muted" numberOfLines={1}>
                          {preview.authors?.length ? preview.authors.join(', ') : 'Unknown author'}
                        </ThemedText>
                        <ThemedText variant="caption" tone="muted">
                          ISBN: {preview.isbn}
                          {preview.numberOfPages ? ` · ${preview.numberOfPages} pages` : ''}
                        </ThemedText>
                      </View>
                    </View>
                  </Card>

                  <View style={{ gap: t.space.s }}>
                    <Button
                      variant="primary"
                      onPress={async () => {
                        closeApprovalSheet();
                        await savePreview();
                      }}
                      style={{ borderRadius: 14 }}
                    >
                      Approve & save
                    </Button>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        closeApprovalSheet();
                        setPreview(null);
                        setLookupError(null);
                        lastScannedRef.current = null;
                      }}
                      style={{ borderRadius: 14 }}
                    >
                      Not this one (rescan)
                    </Button>
                  </View>
                </ScrollView>
              ) : (
                <View style={{ gap: 6 }}>
                  <ThemedText variant="title">No preview</ThemedText>
                  <ThemedText tone="muted">Scan an ISBN to see book details here.</ThemedText>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

