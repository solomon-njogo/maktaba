import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Colors } from '@/constants/theme';
import { normalizeIsbnCandidate, validateIsbnCandidate } from '@/lib/isbn';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

export default function ManualIsbnLookup() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();

  const [raw, setRaw] = useState('');
  const normalized = useMemo(() => normalizeIsbnCandidate(raw), [raw]);
  const validation = useMemo(() => validateIsbnCandidate(raw), [raw]);

  const canSearch = validation.ok && normalized != null;
  const err = !raw.trim()
    ? null
    : validation.ok
      ? null
      : validation.reason === 'too_short'
        ? 'Too short — enter ISBN-10 or ISBN-13.'
        : validation.reason === 'invalid_checksum'
          ? 'That ISBN looks invalid (checksum mismatch).'
          : 'Enter an ISBN-10 or ISBN-13.';

  return (
    <Screen
      header={
        <AppHeader
          title="Type ISBN"
          subtitle="Paste or type an ISBN to look it up"
          leftVisual={<MaterialIcons name="edit" size={t.size.icon.jumbo} color={c.onPrimary} />}
          rightVisual={
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: t.space.s }}>
              <MaterialIcons name="close" size={t.size.icon.xl} color={c.onPrimary} />
            </Pressable>
          }
        />
      }
      contentStyle={{ marginTop: -t.size.fab.wrapWidth }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Card style={{ padding: t.space.l }}>
          <Text style={{ color: c.text, fontSize: t.typography.size.l, fontWeight: t.typography.weight.bold }}>
            ISBN
          </Text>
          <View style={{ height: t.space.s }} />
          <TextInput
            value={raw}
            onChangeText={setRaw}
            placeholder="e.g. 9780141036144"
            placeholderTextColor={c.mutedText}
            keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            style={[
              styles.input,
              {
                borderColor: err ? '#D9534F' : c.border,
                color: c.text,
                backgroundColor: c.background,
                borderRadius: t.radius.l,
                paddingHorizontal: t.space.l,
                paddingVertical: t.space.m,
                fontSize: t.typography.size.xl,
                fontWeight: t.typography.weight.black,
              },
            ]}
          />
          <View style={{ height: t.space.s }} />
          {normalized ? (
            <Text style={{ color: c.mutedText, fontSize: t.typography.size.m, fontWeight: t.typography.weight.semiBold }}>
              Normalized: {normalized}
            </Text>
          ) : null}
          {err ? (
            <Text style={{ color: '#D9534F', fontSize: t.typography.size.m, fontWeight: t.typography.weight.bold }}>
              {err}
            </Text>
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: t.space.m }}>
          <PrimaryButton
            title="Search"
            onPress={() => {
              if (!canSearch || !normalized) return;
              router.push({ pathname: '/book-lookup/result', params: { isbn: normalized, source: 'manual' } });
            }}
            style={{ flex: 1 }}
          />
          <PrimaryButton title="Scan" variant="outline" onPress={() => router.push('/book-lookup/scan')} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});

