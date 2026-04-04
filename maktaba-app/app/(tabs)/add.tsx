import { View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AddTab() {
  const scheme = useColorScheme() ?? 'light';
  return <View style={{ flex: 1, backgroundColor: Colors[scheme].background }} />;
}
