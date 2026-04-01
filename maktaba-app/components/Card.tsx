import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { Colors } from '@/constants/theme';
import { Shadows } from '@/constants/shadows';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}>;

export function Card({ children, style, padded = true }: CardProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: t.radius.m,
          padding: padded ? t.space.xxl : 0,
        },
        Shadows.card(scheme),
        style,
      ]}
    >
      {children}
    </View>
  );
}

