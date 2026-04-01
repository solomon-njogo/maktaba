import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: t.size.icon.jumbo,
          paddingHorizontal: t.space.m,
          borderRadius: t.radius.pill,
          backgroundColor: selected ? c.primary : c.background,
          borderColor: selected ? c.primary : c.border,
        },
        pressed && { opacity: 0.88 },
      ]}>
      <Text
        style={[
          styles.text,
          { fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold, color: selected ? c.onPrimary : c.text },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    // token-driven in component
  },
});

