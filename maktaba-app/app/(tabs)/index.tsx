import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AppName } from '@/components/AppName';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type HomeInProgressBook = {
  title: string;
  author?: string;
  coverUrl?: string | null;
  progressPct?: number | null; // 0..1
};

type HomeStats = {
  totalBooks?: number | null;
  inProgress?: number | null;
  finished?: number | null;
  unread?: number | null;
  dropped?: number | null;
};

type HomeChallenge = {
  yearLabel?: string | null;
  current?: number | null;
  target?: number | null;
};

type HomeWeeklyGoal = {
  label?: string | null;
  valueText?: string | null;
  ctaLabel?: string | null;
  onPress?: () => void;
};

type HomeData = {
  userName?: string | null;
  inProgressBook?: HomeInProgressBook | null;
  stats?: HomeStats | null;
  challenge?: HomeChallenge | null;
  weeklyGoal?: HomeWeeklyGoal | null;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function ProgressBar({ value }: { value?: number | null }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const v = typeof value === 'number' ? clamp01(value) : null;

  return (
    <View
      style={{
        height: 6,
        borderRadius: 6,
        backgroundColor: c.border,
        overflow: 'hidden',
      }}
      accessibilityRole="progressbar"
      accessibilityValue={v === null ? undefined : { min: 0, max: 100, now: Math.round(v * 100) }}
    >
      <View
        style={{
          height: '100%',
          width: v === null ? '0%' : `${Math.round(v * 100)}%`,
          backgroundColor: c.primary,
          borderRadius: 6,
        }}
      />
    </View>
  );
}

function Donut({
  value,
  size,
  strokeWidth,
  labelTop,
  labelBottom,
}: {
  value?: number | null; // 0..1
  size: number;
  strokeWidth: number;
  labelTop?: string;
  labelBottom?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const v = typeof value === 'number' ? clamp01(value) : null;
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circum = 2 * Math.PI * r;
  const dash = v === null ? 0 : circum * v;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={c.border} strokeWidth={strokeWidth} fill="transparent" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={c.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={`${dash} ${Math.max(1, circum - dash)}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>

      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {labelTop ? (
          <ThemedText variant="headline" style={{ fontSize: Math.round(t.typography.size.title * 1.25) }}>
            {labelTop}
          </ThemedText>
        ) : (
          <ThemedText variant="headline" style={{ fontSize: Math.round(t.typography.size.title * 1.25) }}>
            —
          </ThemedText>
        )}
        {labelBottom ? (
          <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            {labelBottom}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

function useHomeData(): HomeData {
  // Wire to your store/API later. This keeps UI non-blocking with safe empty states.
  return useMemo(() => ({}), []);
}

export default function HomeScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const data = useHomeData();

  const scale = useMemo(() => {
    const clamped = Math.max(0, Math.min(1, (width - 360) / 520));
    return 1 + clamped * 0.28;
  }, [width]);

  const coverW = Math.round(112 * scale);
  const coverH = Math.round(148 * scale);
  const donutSize = Math.round(120 * scale);
  const donutStroke = Math.max(10, Math.round(14 * scale));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: t.space.xl,
          paddingBottom: t.space.xxl,
          gap: t.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppName variant="title" size={Math.round(t.typography.size.title * scale)} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My profile"
            onPress={() => router.push('/my-info')}
            style={({ pressed }) => [
              {
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="person-outline" size={18} color={c.icon} />
          </Pressable>
        </View>

        {/* Greeting */}
        <View style={{ gap: 4 }}>
          <ThemedText
            variant="headline"
            style={{
              fontSize: Math.round(t.typography.size.headerTitle * scale),
              lineHeight: Math.round(t.typography.lineHeight.headerTitle * scale),
            }}
          >
            {data.userName ? `Hello, ${data.userName}` : 'Hello'}
          </ThemedText>
          <ThemedText tone="muted" style={{ maxWidth: 320 }}>
            Curating your literary journey today.
          </ThemedText>
        </View>

        {/* Books in progress */}
        <View style={{ gap: t.space.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Books in Progress
            </ThemedText>
            <Button
              variant="link"
              onPress={() => router.push('/my-books')}
              style={{ paddingVertical: 0, alignSelf: 'flex-end' }}
              labelStyle={{ letterSpacing: 1.2, textTransform: 'uppercase' }}
            >
              View all
            </Button>
          </View>

          <Card padded={false} style={{ overflow: 'hidden' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open current book"
              onPress={() => router.push('/my-books')}
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
              <View style={{ padding: t.space.xl, flexDirection: 'row', gap: t.space.l }}>
                <View
                  style={{
                    width: coverW,
                    height: coverH,
                    borderRadius: 14,
                    backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(31, 26, 22, 0.06)',
                    borderWidth: 1,
                    borderColor: c.border,
                    overflow: 'hidden',
                  }}
                >
                  {data.inProgressBook?.coverUrl ? (
                    <Image
                      source={{ uri: data.inProgressBook.coverUrl }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={120}
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="book-outline" size={28} color={c.icon} />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 6 }}>
                  <View style={{ gap: 6 }}>
                    <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
                      Currently Reading
                    </ThemedText>

                    <ThemedText variant="title" numberOfLines={2}>
                      {data.inProgressBook?.title ?? '—'}
                    </ThemedText>

                    <ThemedText tone="muted" numberOfLines={1}>
                      {data.inProgressBook?.author ?? ''}
                    </ThemedText>
                  </View>

                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <ThemedText variant="caption" tone="muted">
                        Progress
                      </ThemedText>
                      <ThemedText variant="caption" tone="muted">
                        {typeof data.inProgressBook?.progressPct === 'number'
                          ? `${Math.round(clamp01(data.inProgressBook.progressPct) * 100)}%`
                          : '—'}
                      </ThemedText>
                    </View>
                    <ProgressBar value={data.inProgressBook?.progressPct ?? null} />
                  </View>
                </View>
              </View>
            </Pressable>
          </Card>
        </View>

        {/* Statistics */}
        <View style={{ gap: t.space.m }}>
          <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Statistics
          </ThemedText>

          <Card padded={false}>
            <View style={{ padding: t.space.xl, flexDirection: 'row', alignItems: 'center', gap: t.space.l }}>
              <Donut
                size={donutSize}
                strokeWidth={donutStroke}
                value={
                  typeof data.challenge?.current === 'number' && typeof data.challenge?.target === 'number' && data.challenge.target > 0
                    ? data.challenge.current / data.challenge.target
                    : null
                }
                labelTop={typeof data.stats?.totalBooks === 'number' ? `${data.stats.totalBooks}` : undefined}
                labelBottom="Total Books"
              />

              <View style={{ flex: 1, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    In progress
                  </ThemedText>
                  <ThemedText variant="caption">{typeof data.stats?.inProgress === 'number' ? `${data.stats.inProgress}` : '—'}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    Finished
                  </ThemedText>
                  <ThemedText variant="caption">{typeof data.stats?.finished === 'number' ? `${data.stats.finished}` : '—'}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    Unread
                  </ThemedText>
                  <ThemedText variant="caption">{typeof data.stats?.unread === 'number' ? `${data.stats.unread}` : '—'}</ThemedText>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <ThemedText variant="caption" tone="muted">
                    Dropped
                  </ThemedText>
                  <ThemedText variant="caption">{typeof data.stats?.dropped === 'number' ? `${data.stats.dropped}` : '—'}</ThemedText>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Challenge + weekly goal */}
        <View style={{ gap: t.space.m }}>
          <Card padded={false}>
            <View style={{ padding: t.space.xl, gap: t.space.l }}>
              <View style={{ gap: 4 }}>
                <ThemedText variant="title">
                  {data.challenge?.yearLabel ? `Book Challenge ${data.challenge.yearLabel}` : 'Book Challenge'}
                </ThemedText>
                <ThemedText tone="muted">You are ahead of schedule! Keep the momentum.</ThemedText>
              </View>

              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <ThemedText variant="headline" style={{ fontSize: Math.round(t.typography.size.headerTitle * 0.9 * scale) }}>
                    {typeof data.challenge?.current === 'number' ? `${data.challenge.current}` : '—'}
                  </ThemedText>
                  <ThemedText tone="muted">
                    / {typeof data.challenge?.target === 'number' ? `${data.challenge.target}` : '—'} books
                  </ThemedText>
                </View>

                <ProgressBar
                  value={
                    typeof data.challenge?.current === 'number' && typeof data.challenge?.target === 'number' && data.challenge.target > 0
                      ? data.challenge.current / data.challenge.target
                      : null
                  }
                />
              </View>
            </View>
          </Card>

          <Card padded={false}>
            <View
              style={{
                padding: t.space.xl,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: t.space.l,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
                  {data.weeklyGoal?.label ?? 'Weekly Reading Goal'}
                </ThemedText>
                <ThemedText variant="title">{data.weeklyGoal?.valueText ?? '—'}</ThemedText>
              </View>

              <Button variant="secondary" onPress={data.weeklyGoal?.onPress ?? (() => {})}>
                {data.weeklyGoal?.ctaLabel ?? 'Edit'}
              </Button>
            </View>
          </Card>
        </View>

        <Button variant="primary" onPress={() => router.push('/my-books')} style={{ borderRadius: 14 }}>
          Update progress
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

