import { Platform, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

export const Shadows = {
  card: (scheme: keyof typeof Colors) =>
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: Colors[scheme].shadow,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: Colors[scheme].shadow,
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
} as const;

