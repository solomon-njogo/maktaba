import type { ComponentProps } from 'react';
import { useState } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { TextInput, View } from 'react-native';

import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export type TextFieldProps = Omit<ComponentProps<typeof TextInput>, 'style'> & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  invalid?: boolean;
};

export function TextField({ containerStyle, inputStyle, invalid, ...props }: TextFieldProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const [focused, setFocused] = useState(false);

  const baseBorder = invalid ? (c as typeof c & { tertiary: string }).tertiary : c.border;
  const borderColor = focused ? c.primary : baseBorder;

  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderColor,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: t.space.l,
          paddingVertical: t.space.m,
        },
        containerStyle,
      ]}
    >
      <TextInput
        placeholderTextColor={c.placeholder}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            fontFamily: BrandFonts.manrope.regular,
            fontSize: t.typography.size.xl,
            lineHeight: t.typography.lineHeight.m,
            color: c.text,
            padding: 0,
          },
          inputStyle,
        ]}
      />
    </View>
  );
}

