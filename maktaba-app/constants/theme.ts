/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const primaryLight = '#F37A2C';
const primaryDark = '#F9A25A';

const primarySoftLight = '#FFE2D0';
const primarySoftDark = '#3A261A';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#F6EFEA',
    card: '#FFFFFF',
    mutedText: '#6B6F76',
    border: '#ECE2DA',
    primary: primaryLight,
    primarySoft: primarySoftLight,
    onPrimary: '#FFFFFF',
    tint: primaryLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: primaryLight,
    overlayScrim: 'rgba(0,0,0,0.35)',
    pressOverlay: 'rgba(0,0,0,0.03)',
    onPrimaryOverlay: 'rgba(255,255,255,0.18)',
    onPrimaryMuted: 'rgba(255,255,255,0.9)',
    placeholder: '#DDDDDD',
    shadow: '#000000',
  },
  dark: {
    text: '#ECEDEE',
    background: '#0F1113',
    card: '#171A1D',
    mutedText: '#A8B0B7',
    border: '#252A2F',
    primary: primaryDark,
    primarySoft: primarySoftDark,
    onPrimary: '#0F1113',
    tint: '#FFFFFF',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#FFFFFF',
    overlayScrim: 'rgba(0,0,0,0.55)',
    pressOverlay: 'rgba(255,255,255,0.06)',
    onPrimaryOverlay: 'rgba(255,255,255,0.14)',
    onPrimaryMuted: 'rgba(255,255,255,0.92)',
    placeholder: '#30353A',
    shadow: '#000000',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
