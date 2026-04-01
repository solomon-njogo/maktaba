import type { StyleProp, TextStyle } from 'react-native';

import React from 'react';

import { BrandFonts } from '@/constants/theme';
import { useTokens } from '@/hooks/use-tokens';
import { ThemedText } from '@/components/ThemedText';

export type AppNameProps = {
  /**
   * Defaults to "Maktaba". Override only if you intentionally want a different label.
   */
  name?: string;
  /**
   * Matches `ThemedText` variants (keep it flexible for headers vs footers).
   */
  variant?: 'headline' | 'title' | 'body' | 'label' | 'caption';
  /**
   * Optional explicit size override (useful for scaled layouts).
   */
  size?: number;
  style?: StyleProp<TextStyle>;
};

export function AppName({ name = 'Maktaba', variant = 'title', size, style }: AppNameProps) {
  const t = useTokens();

  return (
    <ThemedText
      variant={variant}
      style={[
        {
          fontFamily: BrandFonts.ebGaramond.semiBold,
          ...(typeof size === 'number' ? { fontSize: size } : null),
          ...(variant === 'headline' ? { fontSize: t.typography.size.headerTitle } : null),
        },
        style,
      ]}
    >
      {name}
    </ThemedText>
  );
}

