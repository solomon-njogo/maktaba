import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, SafeAreaView, ScrollView, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { BookLookupLoadingOverlay } from '@/components/BookLookupLoadingOverlay';
import { Button } from '@/components/Button';
import { IsbnBookPreviewCard } from '@/components/IsbnBookPreviewCard';
import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useIsbnBookLookup } from '@/hooks/use-isbn-book-lookup';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { barcodeToIsbnCandidate } from '@/lib/isbn';

export default function AddBookScanScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const { height } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const lastScannedRef = useRef<string | null>(null);
  const approvalY = useRef(new Animated.Value(1)).current;
  const [approvalOpen, setApprovalOpen] = useState(false);

  const { lookupLoading, lookupError, preview, setPreview, runLookup, savePreview, resetLookup } = useIsbnBookLookup();

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  useEffect(() => {
    if (lookupError) lastScannedRef.current = null;
  }, [lookupError]);

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

  async function approveAndSave() {
    closeApprovalSheet();
    await savePreview();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ flex: 1, paddingHorizontal: t.space.xl, paddingTop: t.space.l, gap: t.space.m }}>
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
            Scan barcode
          </ThemedText>
        </View>

        <ThemedText tone="muted">Point the camera at the book ISBN barcode.</ThemedText>

        {permission?.granted ? (
          <View
            style={{
              flex: 1,
              minHeight: 280,
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
                if (approvalOpen) return;
                const data = result?.data ?? '';
                const candidate = barcodeToIsbnCandidate(data) ?? data;
                if (!candidate) return;

                if (lastScannedRef.current === candidate) return;
                lastScannedRef.current = candidate;

                void runLookup(candidate, {
                  onFound: () => {
                    openApprovalSheet();
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
      </View>

      <Modal visible={approvalOpen} transparent animationType="none" onRequestClose={closeApprovalSheet}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close preview" onPress={closeApprovalSheet} style={{ flex: 1 }}>
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
                  <IsbnBookPreviewCard
                    book={preview}
                    primaryLabel="Approve & save"
                    onPrimary={approveAndSave}
                    secondaryLabel="Not this one (rescan)"
                    onSecondary={() => {
                      closeApprovalSheet();
                      resetLookup();
                      setPreview(null);
                      lastScannedRef.current = null;
                    }}
                    coverRecyclingKeySuffix="-sheet"
                  />
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

      <BookLookupLoadingOverlay visible={lookupLoading} />
    </SafeAreaView>
  );
}
