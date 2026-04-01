import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { BrandFonts, Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTokens } from '@/hooks/use-tokens';

type Props = {
  visible: boolean;
  title?: string;
  subtitle?: string;
};

export function BookLookupLoadingOverlay({
  visible,
  title = 'Looking up your book',
  subtitle = 'Fetching details from Open Library…',
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const t = useTokens();
  const { width } = useWindowDimensions();

  const cardMaxW = Math.min(340, width - t.space.xl * 2);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const dotA = useRef(new Animated.Value(0.35)).current;
  const dotB = useRef(new Animated.Value(0.35)).current;
  const dotC = useRef(new Animated.Value(0.35)).current;
  const scrim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scrim.setValue(0);
      return;
    }

    Animated.timing(scrim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const stagger = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(400),
        ])
      );

    const dotsLoop = Animated.parallel([
      stagger(dotA, 0),
      stagger(dotB, 160),
      stagger(dotC, 320),
    ]);

    spinLoop.start();
    pulseLoop.start();
    dotsLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
      dotsLoop.stop();
      spin.setValue(0);
      pulse.setValue(0);
      dotA.setValue(0.35);
      dotB.setValue(0.35);
      dotC.setValue(0.35);
    };
  }, [visible, spin, pulse, dotA, dotB, dotC, scrim]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const bookScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.06],
  });

  const bookOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      accessibilityViewIsModal
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <Animated.View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: t.space.l,
          backgroundColor: c.overlayScrim,
          opacity: scrim,
        }}
      >
        <View
          style={{
            width: cardMaxW,
            borderRadius: t.radius.l,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
            paddingVertical: t.space.xl,
            paddingHorizontal: t.space.xl,
            alignItems: 'center',
            gap: t.space.m,
            shadowColor: c.shadow,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: scheme === 'dark' ? 0.45 : 0.12,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          <View style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                position: 'absolute',
                width: 96,
                height: 96,
                borderRadius: 48,
                borderWidth: 3,
                borderColor: `${c.primary}22`,
                borderTopColor: c.primary,
                borderRightColor: c.primary,
                transform: [{ rotate }],
              }}
            />
            <Animated.View style={{ transform: [{ scale: bookScale }], opacity: bookOpacity }}>
              <Ionicons name="book" size={40} color={c.primary} />
            </Animated.View>
          </View>

          <View style={{ alignItems: 'center', gap: t.space.s }}>
            <ThemedText variant="title" align="center" style={{ fontFamily: BrandFonts.ebGaramond.semiBold }}>
              {title}
            </ThemedText>
            <ThemedText tone="muted" variant="body" align="center">
              {subtitle}
            </ThemedText>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            {[dotA, dotB, dotC].map((v, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: c.primary,
                  opacity: v,
                }}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}
