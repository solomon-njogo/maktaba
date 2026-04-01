import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type Row = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
};

const ROWS: Row[] = [
  { icon: 'person-outline', label: 'Personal information' },
  { icon: 'lock-outline', label: 'Password' },
  { icon: 'language', label: 'Language' },
  { icon: 'star-outline', label: 'Rating System' },
  { icon: 'delete-outline', label: 'Delete account' },
  { icon: 'help-outline', label: 'Help & Feedback' },
];

export default function InfoScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <Screen
      header={
        <AppHeader title="Profile" subtitle="Settings" leftVisual={<MaterialIcons name="person-outline" size={t.size.icon.jumbo} color={c.onPrimary} />} />
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth }}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {ROWS.map((r, idx) => (
          <Pressable
            key={r.label}
            onPress={() => {}}
            style={({ pressed }) => [
              styles.row,
              {
                borderBottomColor: c.border,
                minHeight: t.scale.n(56),
                paddingHorizontal: t.space.l,
                gap: t.space.l,
              },
              pressed && { backgroundColor: c.pressOverlay },
              idx === ROWS.length - 1 && { borderBottomWidth: 0 },
            ]}>
            <View
              style={[
                styles.rowIcon,
                {
                  backgroundColor: c.primarySoft,
                  width: t.scale.n(36),
                  height: t.scale.n(36),
                  borderRadius: t.radius.s,
                },
              ]}>
              <MaterialIcons name={r.icon} size={t.size.icon.m} color={c.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.bold }]}>
              {r.label}
            </Text>
            <MaterialIcons name="chevron-right" size={t.size.icon.l} color={c.mutedText} />
          </Pressable>
        ))}
      </Card>

      <Text style={[styles.version, { color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }]}>
        v.1.12.164
      </Text>

      <PrimaryButton title="Logout" variant="outline" onPress={() => {}} style={{ borderRadius: t.radius.l }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  version: {
    textAlign: 'center',
  },
});

