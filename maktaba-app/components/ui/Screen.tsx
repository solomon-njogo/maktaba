import React, { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export function Screen({
  children,
  header,
  scroll = true,
  style,
  contentStyle,
}: PropsWithChildren<{
  header?: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const containerStyle: ViewStyle = {
    flex: t.layout.flex1,
    backgroundColor: c.background,
  };

  const contentContainerStyle: ViewStyle = {
    paddingBottom: t.space.xl,
  };

  const innerStyle: ViewStyle = {
    paddingHorizontal: t.space.xl,
    gap: t.space.l,
  };

  if (!scroll) {
    return (
      <View style={[containerStyle, style]}>
        {header}
        <View style={[innerStyle, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      {header}
      <ScrollView contentContainerStyle={contentContainerStyle} showsVerticalScrollIndicator={false}>
        <View style={[innerStyle, contentStyle]}>{children}</View>
      </ScrollView>
    </View>
  );
}

