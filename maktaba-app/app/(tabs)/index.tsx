import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { DonutMetric } from '@/components/ui/DonutMetric';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatRow } from '@/components/ui/StatRow';
import { Radius } from '@/constants/radius';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const COVER =
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop&q=60';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { width } = useWindowDimensions();

  const pad = Math.max(14, Math.min(20, width * 0.05));
  const twoCol = width >= 820;

  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <AppHeader
          title="Hello,"
          subtitle="Solomon Njogo"
          leftVisual={<MaterialIcons name="emoji-nature" size={34} color="#fff" />}
          rightVisual={<MaterialIcons name="menu" size={26} color="#fff" />}
        />

        <View style={{ paddingHorizontal: pad, marginTop: -54, gap: 16 }}>
          <Card style={{ padding: 16 }}>
            <Text style={[styles.cardTitle, { color: c.text }]}>Books in Progress: 1</Text>
            <View style={styles.progressRow}>
              <Image source={{ uri: COVER }} style={styles.cover} />
              <View style={styles.progressMeta}>
                <Text style={[styles.bookTitle, { color: c.text }]} numberOfLines={1}>
                  The 48 laws of ...
                </Text>
                <Text style={[styles.bookAuthor, { color: c.mutedText }]} numberOfLines={1}>
                  Robert Greene
                </Text>
                <PrimaryButton title="Finish" onPress={() => {}} style={{ alignSelf: 'flex-start' }} />
              </View>
            </View>
          </Card>

          <Card style={{ padding: 16 }}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>Statistics</Text>
            <View style={[styles.statsWrap, twoCol && { flexDirection: 'row', gap: 16 }]}>
              <View style={[styles.statsList, twoCol && { flex: 1 }]}>
                <StatRow icon="hourglass-bottom" iconBg="#F3B23A" label="In progress" value={1} />
                <StatRow icon="check-circle" iconBg="#A7D948" label="Finished" value={0} />
                <StatRow icon="schedule" iconBg="#F37A2C" label="Unread" value={0} />
                <StatRow icon="cancel" iconBg="#59B6F2" label="Dropped" value={0} />
              </View>
              <View style={[styles.donutWrap, twoCol && { width: 200, alignItems: 'center' }]}>
                <DonutMetric value={1} label="All books" progress={0.72} size={150} stroke={16} />
              </View>
            </View>
          </Card>

          <Card style={{ padding: 16 }}>
            <View style={styles.challengeTitleRow}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Book Challenge 2026</Text>
              <MaterialIcons name="more-vert" size={20} color={c.mutedText} />
            </View>

            <View style={[styles.progressBarOuter, { backgroundColor: c.border }]}>
              <View style={[styles.progressBarInner, { backgroundColor: c.primary, width: '18%' }]} />
            </View>

            <View style={styles.challengeMeta}>
              <Text style={[styles.challengeCount, { color: c.mutedText }]}>1 / 100</Text>
            </View>

            <View style={styles.miniTimeline}>
              {Array.from({ length: 12 }).map((_, i) => {
                const active = i === 3;
                return (
                  <View key={i} style={styles.tickWrap}>
                    <Text style={[styles.tickLabel, { color: c.mutedText }]}>{i === 0 ? '0' : ''}</Text>
                    <View
                      style={[
                        styles.tick,
                        { backgroundColor: active ? c.primary : c.border },
                        active && { height: 62 },
                      ]}
                    />
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
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  cover: {
    width: 86,
    height: 110,
    borderRadius: Radius.m,
    backgroundColor: '#ddd',
  },
  progressMeta: {
    flex: 1,
    gap: 6,
  },
  bookTitle: { fontSize: 14, fontWeight: '800' },
  bookAuthor: { fontSize: 12, fontWeight: '600' },
  statsWrap: { gap: 14 },
  statsList: { gap: 12 },
  donutWrap: { alignItems: 'flex-end' },
  challengeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBarOuter: {
    height: 14,
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: 14,
    borderRadius: 10,
  },
  challengeMeta: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  challengeCount: { fontSize: 12, fontWeight: '700' },
  miniTimeline: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  tickWrap: {
    alignItems: 'center',
    gap: 6,
    width: 18,
  },
  tickLabel: { fontSize: 10, fontWeight: '700' },
  tick: {
    width: 10,
    height: 44,
    borderRadius: 6,
  },
});
