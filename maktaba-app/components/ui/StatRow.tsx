import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

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
  const t = useTokens();

  return (
    <View style={[styles.row, { gap: t.space.s }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: iconBg, width: t.size.icon.jumbo, height: t.size.icon.jumbo, borderRadius: t.radius.s },
        ]}>
        <MaterialIcons name={icon} size={t.size.icon.m} color={c.onPrimary} />
      </View>
      <View style={[styles.textWrap, { gap: t.space.xs }]}>
        <Text style={[styles.value, { color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.extraBold }]}>
          {value}
        </Text>
        <Text style={[styles.label, { color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.semiBold }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
  },
  value: {
    // token-driven in component
  },
  label: {
    // token-driven in component
  },
});

