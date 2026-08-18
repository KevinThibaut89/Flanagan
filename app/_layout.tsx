import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';

import { Loading } from '../src/components/ui';
import { AuthProvider, useAuth } from '../src/providers/auth';
import { PreferencesProvider } from '../src/providers/preferences';
import {
  ThemeProvider,
  loadThemePreference,
  useTheme,
  type ThemePreference,
} from '../src/providers/theme';
import { darkTheme } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A bar's contents change slowly; avoid refetching on every screen focus.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/**
 * Keeps the visible route in step with the session. Everything outside
 * `(auth)` requires a signed-in user.
 */
function AuthGate() {
  const { session, loading } = useAuth();
  const { colors, scheme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {loading ? (
        <Loading />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="staples" options={{ presentation: 'modal' }} />
        </Stack>
      )}
    </>
  );
}

export default function RootLayout() {
  // Fraunces carries every title in the app; rendering before it loads would
  // flash system-font headings, so the whole tree waits behind the same
  // loading state used for auth.
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
  });

  // The theme choice is read before first paint for the same reason: a
  // light-mode user should never see a dark frame settle into parchment.
  const [themePreference, setThemePreference] = useState<ThemePreference | null>(null);
  useEffect(() => {
    void loadThemePreference().then(setThemePreference);
  }, []);

  // A bare theme-coloured view, not the styled Loading: that one sets its
  // labels in Fraunces, which is exactly what has not loaded yet. This sits
  // outside every provider, so it can only paint the default scheme.
  if (!fontsLoaded || !themePreference) {
    return <View style={{ flex: 1, backgroundColor: darkTheme.colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider initialPreference={themePreference}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PreferencesProvider>
              <AuthGate />
            </PreferencesProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
