import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export function AppHeader({
  title,
  subtitle,
  leftVisual,
  rightVisual,
  children,
}: PropsWithChildren<{
  title: ReactNode;
  subtitle?: ReactNode;
  leftVisual?: ReactNode;
  rightVisual?: ReactNode;
}>) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const { width } = useWindowDimensions();
  const headerH = Math.max(t.size.header.minHeight, Math.min(t.size.header.maxHeight, width * t.size.header.heightWidthRatio));

  return (
    <View style={[styles.wrap, { height: headerH, backgroundColor: c.primary }]}>
      <View style={[styles.content, { paddingTop: t.platform.headerPadTop, paddingHorizontal: t.size.header.contentPadX }]}>
        <View style={[styles.row, { gap: t.size.header.rowGap }]}>
          <View
            style={[
              styles.left,
              {
                width: t.size.header.sideSlot,
                height: t.size.header.sideSlot,
                borderRadius: t.size.header.sideSlotRadius,
                backgroundColor: c.onPrimaryOverlay,
              },
            ]}>
            {leftVisual ?? <MaterialIcons name="auto-stories" size={t.size.icon.headerLeft} color={c.onPrimary} />}
          </View>
          <View style={[styles.center, { gap: t.size.header.centerGap }]}>
            <Text
              style={[
                styles.title,
                { color: c.onPrimary, fontSize: t.typography.size.headerTitle, fontWeight: t.typography.weight.extraBold, lineHeight: t.typography.lineHeight.headerTitle },
              ]}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: c.onPrimaryMuted, fontSize: t.typography.size.l, fontWeight: t.typography.weight.semiBold }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View style={[styles.right, { width: t.size.header.sideSlot }]}>{rightVisual}</View>
        </View>
        {children}
      </View>

      <View
        style={[
          styles.curve,
          {
            backgroundColor: c.background,
            left: -t.size.header.curveLeftRight,
            right: -t.size.header.curveLeftRight,
            bottom: -t.size.header.curveBottom,
            height: t.size.header.curveHeight,
            borderTopLeftRadius: t.size.header.curveRadius,
            borderTopRightRadius: t.size.header.curveRadius,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    // token-driven in component
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  title: {
    // token-driven in component
  },
  subtitle: {
    // token-driven in component
  },
  curve: {
    position: 'absolute',
    // token-driven in component
  },
});

