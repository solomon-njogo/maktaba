import React, { useEffect, useRef } from 'react';
import { Alert, Pressable, SafeAreaView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookLookupLoadingOverlay } from '@/components/BookLookupLoadingOverlay';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useBulkAddQueue } from '@/contexts/bulk-add-queue';
import { useIsbnBookLookup } from '@/hooks/use-isbn-book-lookup';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { barcodeToIsbnCandidate } from '@/middleware';

export default function AddBookScanScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { queueSize, addBook: addToQueue } = useBulkAddQueue();

  const [permission, requestPermission] = useCameraPermissions();
  const lastScannedRef = useRef<string | null>(null);

  const { lookupLoading, lookupError, runLookup, resetLookup } = useIsbnBookLookup();

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (lookupError) lastScannedRef.current = null;
  }, [lookupError]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: 1, paddingHorizontal: Math.min(t.space.xl, width * 0.05), paddingTop: t.space.l, gap: t.space.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.m }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="chevron-back" size={26} color={c.primary} />
          </Pressable>
          <ThemedText variant="headline" style={{ fontFamily: BrandFonts.ebGaramond.semiBold, flex: 1 }}>
            Scan barcodes
          </ThemedText>
        </View>

        <ThemedText tone="muted">
          Point the camera at each book&apos;s ISBN barcode. Books are collected for review—you can save them all on the
          next screen.
        </ThemedText>

        {permission?.granted ? (
          <View
            style={{
              flex: 1,
              minHeight: 260,
              borderRadius: 14,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
            }}
          >
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'upc_e', 'ean8', 'code128', 'code39', 'qr'] }}
              onBarcodeScanned={(result) => {
                const data = result?.data ?? '';
                const candidate = barcodeToIsbnCandidate(data) ?? data;
                if (!candidate) return;

                if (lastScannedRef.current === candidate) return;
                lastScannedRef.current = candidate;

                void runLookup(candidate, {
                  onFound: (book) => {
                    const r = addToQueue(book);
                    if (!r.ok) {
                      Alert.alert('Already in list', 'This ISBN is already on your review list.');
                    }
                    resetLookup();
                    setTimeout(() => {
                      lastScannedRef.current = null;
                    }, 1200);
                  },
                });
              }}
            />
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', gap: t.space.m }}>
            <ThemedText tone="muted" style={{ textAlign: 'center' }}>
              Camera permission is required to scan barcodes.
            </ThemedText>
            <Button variant="primary" onPress={() => requestPermission()} style={{ borderRadius: 14 }}>
              Allow camera
            </Button>
          </View>
        )}

        {lookupError ? (
          <ThemedText tone="muted" style={{ color: c.tertiary, textAlign: 'center' }}>
            {lookupError}
          </ThemedText>
        ) : null}

        <View
          style={{
            paddingTop: t.space.m,
            paddingBottom: insets.bottom + t.space.m,
            gap: t.space.m,
            borderTopWidth: 1,
            borderColor: c.border,
          }}
        >
          <ThemedText tone="muted" style={{ textAlign: 'center', fontSize: Math.round(t.typography.size.s * 1.05) }}>
            {queueSize > 0
              ? `${queueSize} book${queueSize === 1 ? '' : 's'} ready to review`
              : 'Scan a barcode to add your first book'}
          </ThemedText>
          <Button
            variant="primary"
            disabled={queueSize === 0}
            onPress={() => router.push('/add-book-review')}
            style={{ borderRadius: 14 }}
          >
            {queueSize > 0 ? `Review books (${queueSize})` : 'Review books'}
          </Button>
        </View>
      </View>

      <BookLookupLoadingOverlay visible={lookupLoading} />
    </SafeAreaView>
  );
}
