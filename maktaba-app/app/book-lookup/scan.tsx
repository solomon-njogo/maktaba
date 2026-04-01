import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Colors } from '@/constants/theme';
import { barcodeToIsbnCandidate, validateIsbnCandidate } from '@/lib/isbn';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function ScanBarcodeNative() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const [permission, requestPermission] = useCameraPermissions();
  const [isLocked, setIsLocked] = useState(false);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const permissionState = useMemo(() => {
    if (!permission) return 'loading';
    if (permission.granted) return 'granted';
    if (permission.canAskAgain) return 'denied_can_ask';
    return 'denied';
  }, [permission]);

  const handleCode = useCallback(
    (data: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.value === data && now - last.at < 1500) return;
      lastScanRef.current = { value: data, at: now };

      const candidate = barcodeToIsbnCandidate(data);
      if (!candidate) {
        setHint('That barcode doesn’t look like an ISBN/EAN. Try again.');
        return;
      }

      const v = validateIsbnCandidate(candidate);
      if (!v.ok) {
        setHint('Scanned barcode, but it doesn’t validate as an ISBN. Try another angle.');
        return;
      }

      if (isLocked) return;
      setIsLocked(true);
      router.replace({ pathname: '/book-lookup/result', params: { isbn: v.normalized, source: 'scan' } });
    },
    [isLocked]
  );

  return (
    <Screen
      scroll={false}
      header={
        <AppHeader
          title="Scan barcode"
          subtitle="Point your camera at the ISBN"
          leftVisual={<MaterialIcons name="qr-code-scanner" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: t.space.s }}>
              <MaterialIcons name="close" size={t.size.icon.xl} color={c.onPrimary} />
            </Pressable>
          }
        />
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth, flex: 1 }}>
      {permissionState !== 'granted' ? (
        <View style={{ gap: t.space.l }}>
          <Card style={{ padding: t.space.l }}>
            <Text style={{ color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }}>
              Camera access needed
            </Text>
            <Text style={{ color: c.mutedText, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.semiBold }}>
              To scan a barcode, allow camera access. You can also type the ISBN manually.
            </Text>
          </Card>

          <View style={{ flexDirection: 'row', gap: t.space.m }}>
            <PrimaryButton
              title={permissionState === 'denied_can_ask' ? 'Allow camera' : 'Retry'}
              onPress={() => requestPermission()}
              style={{ flex: 1 }}
            />
            <PrimaryButton title="Type ISBN" variant="outline" onPress={() => router.replace('/book-lookup/manual')} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, gap: t.space.m }}>
          <View style={{ flex: 1 }}>
            <CameraView
              style={[styles.camera, { borderRadius: t.radius.xl }]}
              facing="back"
              onBarcodeScanned={(ev) => {
                if (isLocked) return;
                const d = typeof ev.data === 'string' ? ev.data : '';
                if (!d) return;
                handleCode(d);
              }}
            />

            <View
              pointerEvents="none"
              style={[
                styles.frame,
                {
                  borderColor: c.onPrimaryOverlay,
                  borderRadius: t.radius.xl,
                  margin: t.space.l,
                },
              ]}
            />
          </View>

          <Card style={{ padding: t.space.l }}>
            <View style={[styles.row, { gap: t.space.m }]}>
              <MaterialIcons name="info-outline" size={t.size.icon.l} color={c.mutedText} />
              <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold, flex: 1 }}>
                Scan the barcode on the back cover. If you keep getting failures, try better lighting or type the ISBN.
              </Text>
            </View>
            {hint ? (
              <View style={{ marginTop: t.space.s }}>
                <Text style={{ color: c.text, fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }}>
                  {hint}
                </Text>
              </View>
            ) : null}
          </Card>

          <View style={{ flexDirection: 'row', gap: t.space.m }}>
            <PrimaryButton title="Type ISBN" variant="outline" onPress={() => router.replace('/book-lookup/manual')} style={{ flex: 1 }} />
            <PrimaryButton title="Cancel" onPress={() => router.back()} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  camera: { width: '100%', height: '100%', overflow: 'hidden' },
  frame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
  },
});

