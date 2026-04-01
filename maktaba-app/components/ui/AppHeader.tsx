import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { PropsWithChildren, ReactNode } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const { width } = useWindowDimensions();
  const headerH = Math.max(160, Math.min(220, width * 0.48));

  return (
    <View style={[styles.wrap, { height: headerH, backgroundColor: c.primary }]}>
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.left}>
            {leftVisual ?? <MaterialIcons name="auto-stories" size={38} color="#fff" />}
          </View>
          <View style={styles.center}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.right}>{rightVisual}</View>
        </View>
        {children}
      </View>

      <View style={[styles.curve, { backgroundColor: c.background }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    paddingTop: Platform.select({ ios: 54, default: 44 }),
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  center: {
    flex: 1,
    gap: 2,
  },
  right: {
    width: 48,
    alignItems: 'flex-end',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  curve: {
    position: 'absolute',
    left: -120,
    right: -120,
    bottom: -140,
    height: 220,
    borderTopLeftRadius: 280,
    borderTopRightRadius: 280,
  },
});

