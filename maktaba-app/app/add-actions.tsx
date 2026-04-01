import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type Action = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  subtitle?: string;
};

const ACTIONS: Action[] = [
  { icon: 'qr-code-scanner', title: 'Scan Barcode' },
  { icon: 'file-upload', title: 'Import books' },
  { icon: 'edit', title: 'Add manually' },
];

export default function AddActionsModal() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <View style={styles.backdropWrap} pointerEvents="box-none">
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlayScrim }]} onPress={() => router.back()} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: c.card,
            borderColor: c.border,
            paddingTop: t.space.s,
            paddingHorizontal: t.space.xl,
            paddingBottom: t.space.xl,
            borderTopLeftRadius: t.radius.xl,
            borderTopRightRadius: t.radius.xl,
          },
        ]}>
        <View
          style={[
            styles.grabber,
            {
              width: t.size.icon.headerLeft,
              height: t.space.xs,
              borderRadius: t.radius.s,
              backgroundColor: c.border,
              marginBottom: t.space.s,
            },
          ]}
        />
        <Text style={[styles.title, { color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.bold, marginBottom: t.space.l }]}>
          Add
        </Text>

        <View style={[styles.actionsRow, { gap: t.space.m }]}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.title}
              onPress={() => {
                if (a.title === 'Scan Barcode') {
                  router.replace('/book-lookup/scan');
                  return;
                }
                if (a.title === 'Add manually') {
                  router.replace('/book-lookup/manual');
                  return;
                }
                router.back();
              }}
              style={({ pressed }) => [
                styles.action,
                {
                  backgroundColor: c.background,
                  borderRadius: t.radius.l,
                  paddingVertical: t.space.l,
                  paddingHorizontal: t.space.m,
                  gap: t.space.s,
                },
                pressed && { opacity: 0.85 },
              ]}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: c.primarySoft,
                    width: t.size.header.sideSlot,
                    height: t.size.header.sideSlot,
                    borderRadius: t.size.header.sideSlot / 2,
                  },
                ]}>
                <MaterialIcons name={a.icon} size={t.size.icon.l} color={c.primary} />
              </View>
              <Text
                style={[
                  styles.actionTitle,
                  { color: c.text, fontSize: t.typography.size.l, fontWeight: t.typography.weight.bold },
                ]}>
                {a.title}
              </Text>
              {a.subtitle ? (
                <Text style={[styles.actionSubtitle, { color: c.mutedText, fontSize: t.typography.size.m }]}>
                  {a.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
  },
  action: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    textAlign: 'center',
  },
  actionSubtitle: {
    textAlign: 'center',
  },
});

