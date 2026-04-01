import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius } from '@/constants/radius';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const { width } = useWindowDimensions();
  const pad = Math.max(14, Math.min(20, width * 0.05));

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <AppHeader
          title="LibRoom"
          leftVisual={<MaterialIcons name="menu-book" size={34} color="#fff" />}
        />

        <View style={{ paddingHorizontal: pad, marginTop: -54, gap: 16 }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {ROWS.map((r, idx) => (
              <Pressable
                key={r.label}
                onPress={() => {}}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: c.border },
                  pressed && { backgroundColor: 'rgba(0,0,0,0.03)' },
                  idx === ROWS.length - 1 && { borderBottomWidth: 0 },
                ]}>
                <View style={[styles.rowIcon, { backgroundColor: c.primarySoft }]}>
                  <MaterialIcons name={r.icon} size={20} color={c.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: c.text }]}>{r.label}</Text>
                <MaterialIcons name="chevron-right" size={22} color={c.mutedText} />
              </Pressable>
            ))}
          </Card>

          <Text style={[styles.version, { color: c.mutedText }]}>v.1.12.164</Text>

          <PrimaryButton title="Logout" variant="outline" onPress={() => {}} style={styles.logout} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  logout: {
    borderRadius: Radius.l,
  },
});

