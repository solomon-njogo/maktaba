import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { DonutMetric } from '@/components/ui/DonutMetric';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { StatRow } from '@/components/ui/StatRow';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

const COVER =
  'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop&q=60';

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const { width } = useWindowDimensions();
  const twoCol = width >= t.breakpoints.tablet;

  return (
    <Screen
      header={
        <AppHeader
          title="Hello,"
          subtitle="Solomon Njogo"
          leftVisual={<MaterialIcons name="emoji-nature" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={<MaterialIcons name="menu" size={t.size.icon.xl} color={c.onPrimary} />}
        />
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth }}>
      <Card>
        <Text style={[styles.cardTitle, { color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.extraBold }]}>
          Books in Progress: 1
        </Text>
        <View style={[styles.progressRow, { gap: t.space.l }]}>
          <Image
            source={{ uri: COVER }}
            style={{ width: t.scale.n(86), height: t.scale.n(110), borderRadius: t.radius.m, backgroundColor: c.placeholder }}
          />
          <View style={[styles.progressMeta, { gap: t.space.xs }]}>
            <Text style={[styles.bookTitle, { color: c.text, fontSize: t.typography.size.xl, fontWeight: t.typography.weight.extraBold }]} numberOfLines={1}>
              The 48 laws of ...
            </Text>
            <Text style={[styles.bookAuthor, { color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.semiBold }]} numberOfLines={1}>
              Robert Greene
            </Text>
            <PrimaryButton title="Finish" onPress={() => {}} style={{ alignSelf: 'flex-start' }} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: c.text, fontSize: t.typography.size.xxl, fontWeight: t.typography.weight.black }]}>
          Statistics
        </Text>
        <View style={[styles.statsWrap, { gap: t.space.l }, twoCol && { flexDirection: 'row', gap: t.space.l }]}>
          <View style={[styles.statsList, { gap: t.space.m }, twoCol && { flex: t.layout.flex1 }]}>
            <StatRow icon="hourglass-bottom" iconBg={c.primary} label="In progress" value={1} />
            <StatRow icon="check-circle" iconBg={c.primary} label="Finished" value={0} />
            <StatRow icon="schedule" iconBg={c.primary} label="Unread" value={0} />
            <StatRow icon="cancel" iconBg={c.primary} label="Dropped" value={0} />
          </View>
          <View style={[styles.donutWrap, twoCol && { width: t.scale.n(200), alignItems: 'center' }]}>
            <DonutMetric value={1} label="All books" progress={0.72} size={t.scale.n(150)} stroke={t.space.l} />
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {},
  sectionTitle: {},
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressMeta: {
    flex: 1,
  },
  bookTitle: {},
  bookAuthor: {},
  statsWrap: {},
  statsList: {},
  donutWrap: { alignItems: 'flex-end' },
});
