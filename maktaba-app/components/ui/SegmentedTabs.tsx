import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/radius';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

  return (
    <View style={[styles.wrap, { borderColor: c.border, backgroundColor: c.card }]}>
      {items.map((it) => {
        const selected = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="button"
            onPress={() => onChange(it.key)}
            style={({ pressed }) => [
              styles.item,
              selected && { borderBottomColor: c.primary, borderBottomWidth: 2 },
              pressed && { opacity: 0.9 },
            ]}>
            <Text style={[styles.label, { color: selected ? c.text : c.mutedText }]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: Radius.l,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});

