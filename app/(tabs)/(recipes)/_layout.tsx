import { Platform } from 'react-native';
import { Stack } from 'expo-router';

import { nativeHeader } from '../../../src/lib/navigation';
import { colors } from '../../../src/theme';

/** Same native large-title treatment as the Bar tab. */
export default function RecipesStackLayout() {
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
      <Stack.Screen name="recipes" options={{ title: 'Recipes' }} />
    </Stack>
  );
}
