/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const BrandFonts = {
  manrope: {
    regular: 'Manrope_400Regular',
    semiBold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
  },
  ebGaramond: {
    regular: 'EBGaramond_400Regular',
    medium: 'EBGaramond_500Medium',
    semiBold: 'EBGaramond_600SemiBold',
  },
} as const;

const primary = '#c2652a'; // Mkataba primary (burnt sienna)
const tertiary = '#8c3c3c'; // Mkataba tertiary (dusty rose)

const warmLinen = '#faf5ee';
const warmInk = '#1f1a16';
const warmInkMuted = '#6f6158';
const warmBorder = 'rgba(216, 208, 200, 0.6)'; // #d8d0c8 @ 60%
const warmShadow = '#3a302a';

export const Colors = {
  light: {
    text: warmInk,
    background: warmLinen,
    card: '#ffffff',
    mutedText: warmInkMuted,
    border: warmBorder,
    primary,
    tertiary,
    primarySoft: 'rgba(194, 101, 42, 0.14)',
    onPrimary: '#FFFFFF',
    tint: primary,
    icon: warmInkMuted,
    tabIconDefault: warmInkMuted,
    tabIconSelected: primary,
    overlayScrim: 'rgba(0,0,0,0.35)',
    pressOverlay: 'rgba(0,0,0,0.03)',
    onPrimaryOverlay: 'rgba(255,255,255,0.18)',
    onPrimaryMuted: 'rgba(255,255,255,0.9)',
    placeholder: 'rgba(31, 26, 22, 0.22)',
    shadow: warmShadow,
  },
  dark: {
    text: '#f3ede6',
    background: '#14100d',
    card: '#1b1612',
    mutedText: 'rgba(243, 237, 230, 0.74)',
    border: 'rgba(216, 208, 200, 0.22)',
    primary: '#d07a43',
    tertiary,
    primarySoft: 'rgba(208, 122, 67, 0.16)',
    onPrimary: '#1a120d',
    tint: '#f3ede6',
    icon: 'rgba(243, 237, 230, 0.72)',
    tabIconDefault: 'rgba(243, 237, 230, 0.72)',
    tabIconSelected: '#f3ede6',
    overlayScrim: 'rgba(0,0,0,0.55)',
    pressOverlay: 'rgba(255,255,255,0.06)',
    onPrimaryOverlay: 'rgba(255,255,255,0.14)',
    onPrimaryMuted: 'rgba(255,255,255,0.92)',
    placeholder: 'rgba(243, 237, 230, 0.26)',
    shadow: warmShadow,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: BrandFonts.manrope.regular,
    serif: BrandFonts.ebGaramond.regular,
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: BrandFonts.manrope.regular,
    serif: BrandFonts.ebGaramond.regular,
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "Manrope, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "EB Garamond, Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
