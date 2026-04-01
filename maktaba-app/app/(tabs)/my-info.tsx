import React, { useMemo } from 'react';
import { Pressable, SafeAreaView, ScrollView, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { AppName } from '@/components/AppName';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  tone?: 'default' | 'danger';
  onPress?: () => void;
};

function SettingsRow({ icon, title, subtitle, tone = 'default', onPress }: SettingsRowProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const isDanger = tone === 'danger';
  const iconBg = isDanger ? 'rgba(140, 60, 60, 0.14)' : c.primarySoft;
  const iconFg = isDanger ? (c as typeof c & { tertiary: string }).tertiary : c.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: t.space.xxl,
          paddingVertical: t.space.xl,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.l,
          backgroundColor: pressed ? c.pressOverlay : 'transparent',
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <Ionicons name={icon} size={20} color={iconFg} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText variant="body" tone={isDanger ? 'tertiary' : 'default'} style={{ fontSize: t.typography.size.l }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={18} color={c.icon} />
    </Pressable>
  );
}

export default function MyInfoScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const { width } = useWindowDimensions();

  const scale = useMemo(() => {
    // A small, predictable scale that keeps the design feeling consistent on tablets.
    const clamped = Math.max(0, Math.min(1, (width - 360) / 520));
    return 1 + clamped * 0.35;
  }, [width]);

  const avatarSize = Math.round(96 * scale);
  const avatarRing = Math.round(8 * scale);
  const topPad = Math.round(t.space.xxl * scale);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.xl,
          paddingTop: topPad,
          paddingBottom: t.space.xxl,
          gap: t.space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s }}>
            <Ionicons name="book" size={18} color={c.primary} />
            <AppName variant="title" size={Math.round(t.typography.size.title * 0.95)} />
          </View>

          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c.primarySoft,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="person" size={18} color={c.primary} />
          </View>
        </View>

        {/* Profile */}
        <View style={{ alignItems: 'center', gap: t.space.s }}>
          <View style={{ width: avatarSize, height: avatarSize }}>
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: avatarSize / 2,
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
              }}
            />
            <View
              style={{
                position: 'absolute',
                inset: avatarRing,
                borderRadius: (avatarSize - avatarRing * 2) / 2,
                backgroundColor: 'rgba(31, 26, 22, 0.92)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person-circle" size={Math.round(54 * scale)} color="rgba(255,255,255,0.72)" />
            </View>

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                {
                  position: 'absolute',
                  right: Math.round(4 * scale),
                  bottom: Math.round(6 * scale),
                  width: Math.round(34 * scale),
                  height: Math.round(34 * scale),
                  borderRadius: Math.round(17 * scale),
                  backgroundColor: c.primary,
                  borderWidth: 2,
                  borderColor: c.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: [{ translateY: pressed ? 1 : 0 }],
                },
              ]}
              onPress={() => {}}
            >
              <Ionicons name="pencil" size={Math.round(16 * scale)} color={c.onPrimary} />
            </Pressable>
          </View>

          <ThemedText
            variant="headline"
            align="center"
            style={{ fontSize: Math.round(t.typography.size.headerTitle * scale) }}
          >
            Solomon Njogo
          </ThemedText>
          <ThemedText variant="caption" tone="muted" align="center">
            Reader since October 2023
          </ThemedText>
        </View>

        {/* Account settings */}
        <ThemedText
          variant="caption"
          tone="muted"
          style={{ paddingHorizontal: t.space.xs, letterSpacing: 1.4, textTransform: 'uppercase' }}
        >
          Account Settings
        </ThemedText>
        <Card padded={false}>
          <View style={{ overflow: 'hidden', borderRadius: t.radius.m }}>
            <SettingsRow icon="person-outline" title="Personal information" onPress={() => {}} />
            <View style={{ height: 1, backgroundColor: c.border, marginLeft: t.space.xxl + 44 + t.space.l }} />
            <SettingsRow icon="lock-closed-outline" title="Password" onPress={() => {}} />
            <View style={{ height: 1, backgroundColor: c.border, marginLeft: t.space.xxl + 44 + t.space.l }} />
            <SettingsRow icon="globe-outline" title="Language" subtitle="English (US)" onPress={() => {}} />
          </View>
        </Card>

        {/* Preferences */}
        <ThemedText
          variant="caption"
          tone="muted"
          style={{ paddingHorizontal: t.space.xs, letterSpacing: 1.4, textTransform: 'uppercase' }}
        >
          Preferences
        </ThemedText>
        <Card padded={false}>
          <View style={{ overflow: 'hidden', borderRadius: t.radius.m }}>
            <SettingsRow icon="star-outline" title="Rating System" onPress={() => {}} />
            <View style={{ height: 1, backgroundColor: c.border, marginLeft: t.space.xxl + 44 + t.space.l }} />
            <SettingsRow icon="help-circle-outline" title="Help & Feedback" onPress={() => {}} />
          </View>
        </Card>

        {/* Delete account */}
        <Card padded={false} style={{ borderColor: 'rgba(140, 60, 60, 0.22)' }}>
          <View style={{ overflow: 'hidden', borderRadius: t.radius.m }}>
            <SettingsRow icon="trash-outline" title="Delete account" tone="danger" onPress={() => {}} />
          </View>
        </Card>

        {/* Logout */}
        <View style={{ paddingTop: t.space.s, gap: t.space.m }}>
          <Button
            variant="primary"
            style={{
              borderRadius: 14,
              minHeight: Math.round(t.size.button.minHeight * 1.06),
            }}
            onPress={() => {}}
          >
            Logout
          </Button>

          <View style={{ alignItems: 'center', gap: 2, paddingBottom: t.space.xl }}>
            <ThemedText variant="caption" tone="muted" style={{ letterSpacing: 1.2 }}>
              MKATABA APP
            </ThemedText>
            <ThemedText variant="caption" tone="muted">
              v1.0.0
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

