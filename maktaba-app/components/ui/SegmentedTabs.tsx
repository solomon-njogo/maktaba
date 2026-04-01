import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export type SegmentedTabItem<T extends string> = {
  key: T;
  label: string;
};

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const indicatorW = t.space.xs;

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card, borderRadius: t.radius.l }]}>
      {items.map((it) => {
        const selected = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="button"
            onPress={() => onChange(it.key)}
            style={({ pressed }) => [
              styles.item,
              { paddingVertical: t.space.m },
              selected && { borderBottomColor: c.primary, borderBottomWidth: indicatorW },
              pressed && { opacity: 0.9 },
            ]}>
            <Text
              style={[
                styles.label,
                { color: selected ? c.text : c.mutedText, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.bold },
              ]}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    // token-driven in component
  },
});

