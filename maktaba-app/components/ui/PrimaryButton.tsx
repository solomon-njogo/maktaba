import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { Radius } from '@/constants/radius';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function PrimaryButton({
  title,
  onPress,
  style,
  variant = 'solid',
}: {
  title: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'solid' | 'outline';
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const isOutline = variant === 'outline';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        isOutline
          ? { backgroundColor: 'transparent', borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }
          : { backgroundColor: c.primary },
        pressed && { opacity: 0.9 },
        style,
      ]}>
      <Text style={[styles.text, isOutline && { color: c.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});

