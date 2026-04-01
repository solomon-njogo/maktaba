import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { TokenBase, createTokenScaler } from '@/constants/tokens';

export function useTokens() {
  const { width } = useWindowDimensions();

  return useMemo(() => {
    const s = createTokenScaler({ width });
    const b = TokenBase;

    const scaleObj = <T extends Record<string, unknown>>(obj: T): T => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'number') {
          // Treat ratios/opacities as unitless — don't pixel-scale or round them.
          out[k] = v < 2 ? v : s.n(v);
        }
        else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = scaleObj(v as Record<string, unknown>);
        else out[k] = v;
      }
      return out as T;
    };

    const layout = b.layout;
    const breakpoints = b.breakpoints;
    const space = scaleObj(b.spacing);
    const radius = scaleObj(b.radius);
    const typography = {
      size: scaleObj(b.typography.size),
      weight: b.typography.weight,
      lineHeight: scaleObj(b.typography.lineHeight),
    } as const;
    const size = scaleObj(b.sizing);

    const platform = {
      tabBarHeight: Platform.select({ ios: size.tabBar.heightIos, default: size.tabBar.heightAndroid })!,
      tabBarPadBottom: Platform.select({ ios: size.tabBar.padBottomIos, default: size.tabBar.padBottomAndroid })!,
      headerPadTop: Platform.select({ ios: size.header.contentPadTopIos, default: size.header.contentPadTopAndroid })!,
    } as const;

    return { layout, breakpoints, space, radius, typography, size, platform, scale: s } as const;
  }, [width]);
}

