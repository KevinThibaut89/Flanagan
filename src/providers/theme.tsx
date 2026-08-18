import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { darkTheme, lightTheme, type ColorScheme, type Theme } from '../theme';

/** What the user asked for. `system` defers to the OS appearance. */
export type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'flanagan.theme';
const PREFERENCES: readonly ThemePreference[] = ['dark', 'light', 'system'];

function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value);
}

/**
 * Reads the stored preference. Called once at boot, before the tree renders,
 * so the first frame is already in the right scheme. Defaults to dark — the
 * app's native register.
 */
export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return isThemePreference(raw) ? raw : 'dark';
  } catch {
    return 'dark';
  }
}

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  // React Native's own override: forcing a scheme here makes `useColorScheme`
  // report it *and* flips native chrome (keyboard, alerts, sheet backdrops)
  // to match, so the app never shows a light keyboard over a dark room.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? null : preference);
  }, [preference]);

  const scheme = useColorScheme() ?? 'dark';
  const theme = scheme === 'light' ? lightTheme : darkTheme;

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {
      // A failed write only means the choice won't survive a relaunch.
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Pins a subtree to one scheme regardless of the user's choice. The scanner
 * lives here: its chrome floats over a black camera feed, so it is always the
 * dark room even when the rest of the app is in daylight.
 */
export function ThemeScope({ scheme, children }: { scheme: ColorScheme; children: ReactNode }) {
  const parent = useThemeContext();
  const value = useMemo<ThemeContextValue>(
    () => ({ ...parent, theme: scheme === 'light' ? lightTheme : darkTheme }),
    [parent, scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>');
  return value;
}

/** The resolved theme — palette, category colours, gradient, shadow. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** The stored choice and its setter; only Settings needs this. */
export function useThemePreference(): Pick<ThemeContextValue, 'preference' | 'setPreference'> {
  const { preference, setPreference } = useThemeContext();
  return { preference, setPreference };
}

/**
 * Builds a stylesheet from the current theme, rebuilt only when the scheme
 * changes. Keep the factory at module scope so its identity is stable:
 *
 *   const makeStyles = ({ colors }: Theme) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
