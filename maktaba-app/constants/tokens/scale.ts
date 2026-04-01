import { PixelRatio } from 'react-native';

export type TokenScaleInput = {
  width: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Scales token sizes based on device width and pixel density.
 * The goal is consistent perceived sizing across phones/tablets/web
 * while keeping tokens as the single source of numeric truth.
 */
export function createTokenScaler({ width }: TokenScaleInput) {
  const normalizedWidth = clamp(width, 360, 1024);
  const widthFactor = normalizedWidth / 390;
  const density = PixelRatio.get();
  const densityFactor = clamp(density / 2, 0.95, 1.1);
  const scaleFactor = clamp(widthFactor * densityFactor, 0.9, 1.25);

  return {
    n: (value: number) => Math.round(PixelRatio.roundToNearestPixel(value * scaleFactor)),
  } as const;
}

