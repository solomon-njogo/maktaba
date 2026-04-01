import type { TextProps, TextStyle } from 'react-native';
import { Text } from 'react-native';

import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export type ThemedTextVariant = 'headline' | 'title' | 'body' | 'label' | 'caption';

export type ThemedTextProps = TextProps & {
  variant?: ThemedTextVariant;
  tone?: 'default' | 'muted' | 'tertiary' | 'onPrimary';
  align?: TextStyle['textAlign'];
};

export function ThemedText({
  variant = 'body',
  tone = 'default',
  align,
  style,
  ...props
}: ThemedTextProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const color =
    tone === 'muted'
      ? c.mutedText
      : tone === 'tertiary'
        ? (c as typeof c & { tertiary: string }).tertiary
        : tone === 'onPrimary'
          ? c.onPrimaryMuted
          : c.text;

  const base: TextStyle = {
    color,
    textAlign: align,
  };

  const variantStyle: TextStyle =
    variant === 'headline'
      ? {
          fontFamily: BrandFonts.ebGaramond.semiBold,
          fontSize: t.typography.size.headerTitle,
          lineHeight: t.typography.lineHeight.headerTitle,
          letterSpacing: -0.3,
        }
      : variant === 'title'
        ? {
            fontFamily: BrandFonts.ebGaramond.medium,
            fontSize: t.typography.size.title,
            lineHeight: t.typography.lineHeight.title,
            letterSpacing: -0.2,
          }
        : variant === 'label'
          ? {
              fontFamily: BrandFonts.manrope.semiBold,
              fontSize: t.typography.size.m,
              lineHeight: t.typography.lineHeight.m,
              letterSpacing: 0.1,
            }
          : variant === 'caption'
            ? {
                fontFamily: BrandFonts.manrope.regular,
                fontSize: t.typography.size.s,
                lineHeight: Math.round(t.typography.lineHeight.m * 0.75),
              }
            : {
                fontFamily: BrandFonts.manrope.regular,
                fontSize: t.typography.size.xl,
                lineHeight: t.typography.lineHeight.m,
              };

  return <Text style={[base, variantStyle, style]} {...props} />;
}

