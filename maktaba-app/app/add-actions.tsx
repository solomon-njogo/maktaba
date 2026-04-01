import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

  return (
    <View style={styles.backdropWrap} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={() => router.back()} />

      <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.grabber} />
        <Text style={[styles.title, { color: c.text }]}>Add</Text>

        <View style={styles.actionsRow}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.title}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: c.background },
                pressed && { opacity: 0.85 },
              ]}>
              <View style={[styles.iconWrap, { backgroundColor: c.primarySoft }]}>
                <MaterialIcons name={a.icon} size={22} color={c.primary} />
              </View>
              <Text style={[styles.actionTitle, { color: c.text }]}>{a.title}</Text>
              {a.subtitle ? (
                <Text style={[styles.actionSubtitle, { color: c.mutedText }]}>{a.subtitle}</Text>
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  action: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
});

