import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { nativeHeader } from '../../../src/lib/navigation';
import { colors } from '../../../src/theme';

/**
 * The Bar tab gets its own native stack so it can use a real UINavigationBar:
 * a collapsing large title, a pull-down search field, and blur under the bar.
 * Android has none of those, so it keeps a plain opaque header.
 */
export default function BarStackLayout() {
  return (
    <Stack
      screenOptions={{
        ...nativeHeader,
        headerLargeTitle: true,
        headerLargeTitleShadowVisible: false,
        headerLargeTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg },
        ...(Platform.OS === 'ios'
          ? { headerTransparent: true, headerBlurEffect: 'systemChromeMaterialDark' as const }
          : null),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Bar' }} />
    </Stack>
  );
}
