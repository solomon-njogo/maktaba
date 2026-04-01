import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

const COVER =
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop&q=60';

function buildApril2026() {
  // April 2026: 30 days, 1st is Wednesday (Mon=0 => Wed=2)
  const startOffset = 2;
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const cells: { day?: number }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({});
  for (const d of days) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({});
  return cells;
}

export default function CalendarScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const { width } = useWindowDimensions();

  const cells = useMemo(() => buildApril2026(), []);
  const colGap = t.space.m;
  const cellW = (width - t.space.xl * 2 - colGap * t.space.xs) / 7;
  const cellH = Math.max(t.size.button.minHeight, cellW * (t.size.header.heightWidthRatio + t.size.header.heightWidthRatio));

  return (
    <Screen
      header={
        <AppHeader
          title="Calendar"
          subtitle="April 2026"
          leftVisual={<MaterialIcons name="calendar-month" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={<MaterialIcons name="chevron-right" size={t.size.icon.xxl} color={c.onPrimary} />}
        />
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth }}>
      <Card style={{ padding: t.space.l }}>
        <View style={[styles.weekHeader, { marginBottom: t.space.s }]}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <Text
              key={d}
              style={[
                styles.weekLabel,
                { color: c.mutedText, width: cellW, fontSize: t.typography.size.s, fontWeight: t.typography.weight.bold },
              ]}>
              {d}
            </Text>
          ))}
        </View>

        <View style={[styles.grid, { gap: colGap }]}>
          {cells.map((cell, idx) => {
            const showCover = cell.day === 1;
            return (
              <View
                key={idx}
                style={[
                  styles.cell,
                  {
                    width: cellW,
                    height: cellH,
                    backgroundColor: c.card,
                    borderColor: c.border,
                    borderRadius: t.radius.m,
                    paddingTop: t.space.xs,
                  },
                ]}>
                {cell.day ? (
                  <Text style={[styles.dayNum, { color: c.mutedText, top: t.space.xs, left: t.space.s, fontSize: t.typography.size.xs, fontWeight: t.typography.weight.bold }]}>
                    {cell.day}
                  </Text>
                ) : null}
                {showCover ? (
                  <Image
                    source={{ uri: COVER }}
                    style={{ width: '90%', height: '70%', borderRadius: t.radius.s, backgroundColor: c.placeholder }}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLabel: { textAlign: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayNum: {
    position: 'absolute',
  },
});

