import type { PropsWithChildren } from 'react';
import type { PressableProps, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';

import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';
import { ThemedText } from '@/components/ThemedText';

export type ButtonVariant = 'primary' | 'secondary' | 'link';

export type ButtonProps = PropsWithChildren<
  Omit<PressableProps, 'style'> & {
    variant?: ButtonVariant;
    style?: StyleProp<ViewStyle>;
    labelStyle?: StyleProp<TextStyle>;
  }
>;

export function Button({
  children,
  variant = 'primary',
  style,
  labelStyle,
  disabled,
  ...props
}: ButtonProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const isLink = variant === 'link';
  const radius = isLink ? 0 : 8; // Sahara: 8px radius for buttons

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...props}
      style={({ pressed }) => [
        {
          opacity: disabled ? 0.6 : 1,
        },
        pressed && isLink ? { opacity: 0.7 } : null,
        style,
      ]}
    >
      {({ pressed, hovered }) => {
        const bg =
          variant === 'primary'
            ? c.primary
            : variant === 'secondary'
              ? 'transparent'
              : 'transparent';
        const borderWidth = variant === 'secondary' ? 1 : 0;
        const borderColor = variant === 'secondary' ? c.border : 'transparent';

        const textTone = variant === 'primary' ? 'onPrimary' : 'default';
        const textDecorationLine = variant === 'link' && (hovered || pressed) ? 'underline' : 'none';

        return (
          <View
            style={[
              {
                minHeight: t.size.button.minHeight,
                paddingHorizontal: t.space.xl,
                paddingVertical: t.space.m,
                borderRadius: radius,
                backgroundColor: bg,
                borderWidth,
                borderColor,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              },
              variant === 'primary' && pressed ? { backgroundColor: c.primary } : null,
              !isLink && pressed ? { transform: [{ translateY: 1 }] } : null,
            ]}
          >
            {!isLink && pressed ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: variant === 'primary' ? c.onPrimaryOverlay : c.pressOverlay,
                }}
              />
            ) : null}

            <ThemedText
              variant="label"
              tone={textTone}
              style={[
                {
                  fontFamily: BrandFonts.manrope.semiBold,
                  textDecorationLine,
                },
                labelStyle,
              ]}
            >
              {children}
            </ThemedText>
          </View>
        );
      }}
    </Pressable>
  );
}

