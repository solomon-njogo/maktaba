import React, { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Radius } from '@/constants/radius';
import { Shadows } from '@/constants/shadows';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function Card({
  children,
  style,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return <View style={[styles.base, { backgroundColor: c.card }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.l,
    padding: 16,
    ...Shadows.card,
  },
});

