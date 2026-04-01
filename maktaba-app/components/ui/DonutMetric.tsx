import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export function DonutMetric({
  value,
  label,
  progress,
  size,
  stroke,
}: {
  value: string | number;
  label: string;
  progress: number; // 0..1
  size?: number;
  stroke?: number;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const resolvedSize = size ?? t.scale.n(t.size.header.curveHeight);
  const resolvedStroke = stroke ?? t.space.m;

  const clamped = Math.max(0, Math.min(1, progress));
  const r = (resolvedSize - resolvedStroke) / 2;
  const cx = resolvedSize / 2;
  const cy = resolvedSize / 2;
  const circumference = 2 * Math.PI * r;
  const dash = circumference * clamped;

  return (
    <View style={[styles.wrap, { width: resolvedSize, height: resolvedSize }]}>
      <Svg width={resolvedSize} height={resolvedSize}>
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={c.border}
          strokeWidth={resolvedStroke}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={c.primary}
          strokeWidth={resolvedStroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text
          style={[
            styles.value,
            { color: c.text, fontSize: t.typography.size.headerTitle, fontWeight: t.typography.weight.black, lineHeight: t.typography.lineHeight.headerTitle },
          ]}>
          {value}
        </Text>
        <Text style={[styles.label, { color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    // token-driven in component
  },
  label: {
    // token-driven in component
  },
});

