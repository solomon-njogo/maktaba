import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Radius } from '@/constants/radius';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const { width } = useWindowDimensions();
  const pad = Math.max(14, Math.min(20, width * 0.05));

  const cells = useMemo(() => buildApril2026(), []);
  const colGap = 10;
  const cellW = (width - pad * 2 - colGap * 6) / 7;
  const cellH = Math.max(46, cellW * 1.05);

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <AppHeader
          title="April 2026"
          leftVisual={<MaterialIcons name="calendar-month" size={34} color="#fff" />}
          rightVisual={<MaterialIcons name="chevron-right" size={30} color="#fff" />}
        />

        <View style={{ paddingHorizontal: pad, marginTop: -54 }}>
          <Card style={{ padding: 14 }}>
            <View style={styles.weekHeader}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <Text key={d} style={[styles.weekLabel, { color: c.mutedText, width: cellW }]}>
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
                      },
                    ]}>
                    {cell.day ? (
                      <Text style={[styles.dayNum, { color: c.mutedText }]}>{cell.day}</Text>
                    ) : null}
                    {showCover ? <Image source={{ uri: COVER }} style={styles.thumb} /> : null}
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.m,
    paddingTop: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayNum: {
    position: 'absolute',
    top: 6,
    left: 8,
    fontSize: 10,
    fontWeight: '700',
  },
  thumb: {
    width: '90%',
    height: '70%',
    borderRadius: Radius.s,
  },
});

