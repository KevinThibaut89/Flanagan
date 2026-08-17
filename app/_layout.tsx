import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading } from '../src/components/ui';
import { nativeHeader } from '../src/lib/navigation';
import { AuthProvider, useAuth } from '../src/providers/auth';
import { PreferencesProvider } from '../src/providers/preferences';
import { colors } from '../src/theme';

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

  if (loading) return <Loading />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="bottle/[id]" options={nativeHeader} />
      <Stack.Screen name="bottle/new" options={{ ...nativeHeader, title: 'Add a bottle' }} />
      <Stack.Screen name="recipe/[id]" options={nativeHeader} />
      <Stack.Screen name="recipe/new" options={nativeHeader} />
      <Stack.Screen
        name="settings"
        options={{ ...nativeHeader, presentation: 'modal', title: 'Settings' }}
      />
      <Stack.Screen
        name="staples"
        options={{ ...nativeHeader, presentation: 'modal', title: 'Staples' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PreferencesProvider>
            <StatusBar style="light" />
            <AuthGate />
          </PreferencesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
