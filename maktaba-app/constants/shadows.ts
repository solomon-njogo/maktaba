import { Platform, ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

export const Shadows = {
  card: (scheme: keyof typeof Colors) =>
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: Colors[scheme].shadow,
        shadowOpacity: 0.04,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 1,
      },
      default: {
        shadowColor: Colors[scheme].shadow,
        shadowOpacity: 0.04,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
} as const;

