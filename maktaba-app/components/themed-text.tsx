import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  return (
    <Text
      style={[
        { color },
        type === 'default' ? { fontSize: t.typography.size.xxl, lineHeight: t.typography.lineHeight.m } : undefined,
        type === 'title'
          ? {
              fontSize: t.typography.size.headerTitle,
              fontWeight: t.typography.weight.bold,
              lineHeight: t.typography.lineHeight.title,
            }
          : undefined,
        type === 'defaultSemiBold'
          ? {
              fontSize: t.typography.size.xxl,
              lineHeight: t.typography.lineHeight.m,
              fontWeight: t.typography.weight.semiBold,
            }
          : undefined,
        type === 'subtitle' ? { fontSize: t.typography.size.title, fontWeight: t.typography.weight.bold } : undefined,
        type === 'link'
          ? {
              lineHeight: t.typography.lineHeight.link,
              fontSize: t.typography.size.xxl,
              color: c.primary,
            }
          : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {},
  defaultSemiBold: {},
  title: {},
  subtitle: {},
  link: {},
});
