import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type Action = {
  key: 'scan' | 'manual';
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
};

const ACTIONS: Action[] = [
  {
    key: 'scan',
    title: 'Scan barcode',
    subtitle: 'Use your camera to scan the ISBN on the back cover.',
    icon: 'qr-code-scanner',
  },
  {
    key: 'manual',
    title: 'Type ISBN',
    subtitle: 'Paste or type an ISBN-10 or ISBN-13 to look it up.',
    icon: 'edit',
  },
];

export default function BookLookupHome() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <Screen
      header={
        <AppHeader
          title="Find a book"
          subtitle="Scan or enter an ISBN"
          leftVisual={<MaterialIcons name="auto-stories" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={<MaterialIcons name="search" size={t.size.icon.xl} color={c.onPrimary} />}
        />
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth }}>
      <Text style={[styles.h1, { color: c.text, fontSize: t.typography.size.title, fontWeight: t.typography.weight.black }]}>
        How do you want to search?
      </Text>

      <View style={{ gap: t.space.m }}>
        {ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            onPress={() => router.push(a.key === 'scan' ? '/book-lookup/scan' : '/book-lookup/manual')}
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
            <Card style={[styles.actionCard, { padding: t.space.l }]}>
              <View style={[styles.row, { gap: t.space.m }]}>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      width: t.size.header.sideSlot,
                      height: t.size.header.sideSlot,
                      borderRadius: t.size.header.sideSlot / 2,
                      backgroundColor: c.primarySoft,
                    },
                  ]}>
                  <MaterialIcons name={a.icon} size={t.size.icon.l} color={c.primary} />
                </View>
                <View style={{ flex: 1, gap: t.space.xs }}>
                  <Text style={{ color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.black }}>
                    {a.title}
                  </Text>
                  <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold }}>
                    {a.subtitle}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={t.size.icon.l} color={c.mutedText} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <Card style={{ padding: t.space.l }}>
        <View style={[styles.row, { gap: t.space.m }]}>
          <MaterialIcons name="info-outline" size={t.size.icon.l} color={c.mutedText} />
          <Text style={{ color: c.mutedText, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold, flex: 1 }}>
            Tip: Most books use an EAN-13 barcode that begins with 978 or 979 (Bookland).
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: {},
  actionCard: {},
  row: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
});

