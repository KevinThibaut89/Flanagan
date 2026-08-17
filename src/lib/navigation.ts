import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { colors } from '../theme';

/**
 * Shared options for screens that use the native navigation bar: tinted
 * controls, no hairline shadow, and an iOS chevron-only back button.
 */
export const nativeHeader: NativeStackNavigationOptions = {
  headerShown: true,
  headerTintColor: colors.accent,
  headerTitleStyle: { color: colors.text },
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
};
