import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function StatRow({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconBg: string;
  label: string;
  value: string | number;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={18} color="#fff" />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.value, { color: c.text }]}>{value}</Text>
        <Text style={[styles.label, { color: c.mutedText }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    gap: 2,
  },
  value: {
    fontWeight: '800',
    fontSize: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

