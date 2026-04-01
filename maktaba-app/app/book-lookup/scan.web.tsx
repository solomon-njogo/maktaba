import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Colors } from '@/constants/theme';
import { barcodeToIsbnCandidate, validateIsbnCandidate } from '@/lib/isbn';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type DetectResult =
  | { status: 'idle' }
  | { status: 'unsupported' }
  | { status: 'requesting' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export default function ScanBarcodeWeb() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const [state, setState] = useState<DetectResult>({ status: 'idle' });
  const [hint, setHint] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const supports = useMemo(() => {
    const hasMedia = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    return { hasMedia, hasDetector };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function start() {
    setHint(null);
    if (!supports.hasMedia || !supports.hasDetector) {
      setState({ status: 'unsupported' });
      return;
    }

    try {
      setState({ status: 'requesting' });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('VideoUnavailable');
      video.srcObject = stream;
      await video.play();

      setState({ status: 'ready' });

      const detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
      });

      const tick = async () => {
        if (!videoRef.current) return;
        try {
          const results: any[] = await detector.detect(videoRef.current);
          if (Array.isArray(results) && results.length) {
            const raw = String(results[0]?.rawValue ?? '');
            const candidate = barcodeToIsbnCandidate(raw);
            if (!candidate) {
              setHint('Detected a barcode, but it doesn’t look like an ISBN/EAN.');
            } else {
              const v = validateIsbnCandidate(candidate);
              if (v.ok) {
                streamRef.current?.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
                router.replace({ pathname: '/book-lookup/result', params: { isbn: v.normalized, source: 'scan_web' } });
                return;
              }
              setHint('Detected a barcode, but it doesn’t validate as an ISBN.');
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          setState({ status: 'error', message: msg });
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setState({ status: 'error', message: msg });
    }
  }

  useEffect(() => {
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      scroll={false}
      header={
        <AppHeader
          title="Scan barcode"
          subtitle="Web scanner (BarcodeDetector)"
          leftVisual={<MaterialIcons name="qr-code-scanner" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: t.space.s }}>
              <MaterialIcons name="close" size={t.size.icon.xl} color={c.onPrimary} />
            </Pressable>
          }
        />
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth, flex: 1 }}>
      {state.status === 'unsupported' ? (
        <View style={{ gap: t.space.l }}>
          <Card style={{ padding: t.space.l }}>
            <Text style={{ color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }}>
              Scanner not supported in this browser
            </Text>
            <Text style={{ color: c.mutedText, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.semiBold }}>
              Your browser doesn’t support the BarcodeDetector API. You can still type an ISBN to search Open Library.
            </Text>
          </Card>
          <View style={{ flexDirection: 'row', gap: t.space.m }}>
            <PrimaryButton title="Type ISBN" onPress={() => router.replace('/book-lookup/manual')} style={{ flex: 1 }} />
            <PrimaryButton title="Back" variant="outline" onPress={() => router.back()} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, gap: t.space.m }}>
          <View style={{ flex: 1 }}>
            <View style={[styles.videoWrap, { borderRadius: t.radius.xl, borderColor: c.border, backgroundColor: c.card }]}>
              <video
                ref={(el) => {
                  videoRef.current = el;
                }}
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: t.radius.xl }}
              />
              <View pointerEvents="none" style={[styles.frame, { borderColor: c.onPrimaryOverlay, borderRadius: t.radius.xl, margin: t.space.l }]} />
            </View>
          </View>

          <Card style={{ padding: t.space.l }}>
            <View style={[styles.row, { gap: t.space.m }]}>
              <MaterialIcons name="info-outline" size={t.size.icon.l} color={c.mutedText} />
              <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold, flex: 1 }}>
                Allow camera access, then hold the barcode steady in the frame.
              </Text>
            </View>
            {hint ? (
              <View style={{ marginTop: t.space.s }}>
                <Text style={{ color: c.text, fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }}>
                  {hint}
                </Text>
              </View>
            ) : null}
            {state.status === 'error' ? (
              <View style={{ marginTop: t.space.s }}>
                <Text style={{ color: '#D9534F', fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }}>
                  Error: {state.message}
                </Text>
              </View>
            ) : null}
          </Card>

          <View style={{ flexDirection: 'row', gap: t.space.m }}>
            <PrimaryButton title="Type ISBN" variant="outline" onPress={() => router.replace('/book-lookup/manual')} style={{ flex: 1 }} />
            <PrimaryButton title="Retry" onPress={() => start()} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  videoWrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
  },
});

