import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

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
  const t = useTokens();

  const isOutline = variant === 'outline';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          minHeight: t.size.button.minHeight,
          paddingHorizontal: t.size.header.contentPadX,
          borderRadius: t.radius.pill,
        },
        isOutline
          ? { backgroundColor: 'transparent', borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }
          : { backgroundColor: c.primary },
        pressed && { opacity: 0.9 },
        style,
      ]}>
      <Text
        style={[
          styles.text,
          { fontSize: t.typography.size.xl, fontWeight: t.typography.weight.bold, color: c.onPrimary },
          isOutline && { color: c.text },
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    // token-driven in component
  },
});

