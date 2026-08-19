import type { ViewStyle } from 'react-native';

import type { IngredientKind } from './types/database';

/**
 * Two palettes, one voice. The dark theme is the native one — a bar app is
 * used in dim rooms at night — and the light theme is its daylight cousin:
 * parchment and ink instead of walnut and cream, with the same copper rail.
 * Every token exists in both so components never branch on scheme; they read
 * whatever `useTheme()` hands them.
 *
 * The design language is a cocktail menu, not a dashboard: content is the
 * interface and containers are rare. Fraunces carries the voice (titles,
 * numerals, flourishes); the system sans carries the interface (buttons,
 * labels, metadata). Copper appears at most three times per screen — the
 * primary action, the active tab, one keyline or numeral — so that when it
 * does appear it reads as a brass rail, not a theme colour.
 */

export type ColorScheme = 'dark' | 'light';

export interface ThemeColors {
  bg: string;
  surface: string;
  /** Modals and sheets only. */
  surfaceRaised: string;
  /** Hairlines are derived from the text colour so they sit in the same warm register. */
  border: string;
  borderSubtle: string;
  text: string;
  textMuted: string;
  textFaint: string;
  /** Copper. The one accent — primary actions, active tab, a rare keyline. */
  accent: string;
  /** Pressed/active copper and the bright stop of the brand gradient. */
  accentSoft: string;
  /** The quiet-luxury secondary: ornaments, numerals, monograms. */
  cream: string;
  success: string;
  warning: string;
  danger: string;
  /** Translucent overlay for modals and scanner chrome. */
  scrim: string;
}

export const darkColors: ThemeColors = {
  bg: '#120E0B',
  surface: '#1C1714',
  surfaceRaised: '#262019',
  border: 'rgba(245, 237, 230, 0.10)',
  borderSubtle: 'rgba(245, 237, 230, 0.06)',
  text: '#F3EBE2',
  textMuted: '#B0A296',
  textFaint: '#6E6259',
  accent: '#C87F3C',
  accentSoft: '#E2A15D',
  cream: '#E9DCC9',
  success: '#6FA86B',
  warning: '#D4A03C',
  danger: '#C4574B',
  scrim: 'rgba(8, 6, 4, 0.78)',
};

export const lightColors: ThemeColors = {
  bg: '#F5EFE6',
  surface: '#FCF8F2',
  surfaceRaised: '#FFFFFF',
  border: 'rgba(30, 20, 12, 0.12)',
  borderSubtle: 'rgba(30, 20, 12, 0.07)',
  text: '#1F1610',
  textMuted: '#6A5B50',
  textFaint: '#9C8D80',
  /** A touch deeper than the dark copper so it holds up on parchment. */
  accent: '#B0672A',
  accentSoft: '#C87F3C',
  /** Bronze — the quiet secondary reads dark-on-light here. */
  cream: '#8A6A46',
  success: '#4F8A4B',
  warning: '#A5761A',
  danger: '#B4453A',
  scrim: 'rgba(30, 20, 12, 0.45)',
};

// Category accents, used for bottle type pills and recipe base-spirit tags.
//
// Keyed by `ingredient_kind`, which is the only thing `colorForKind` ever looks
// up. Typed as a total record so the next enum value added to the database is a
// compile error here rather than a silently grey dot in the picker.
export const darkCategoryColors: Record<IngredientKind, string> = {
  spirit: '#C08A4A',
  liqueur: '#B07FA8',
  vermouth: '#A46B72',
  amaro: '#8B5A52',
  bitters: '#9C4A42',
  fortified: '#A4685C',
  wine: '#8E4A5C',
  beer: '#C9A24A',
  sake: '#C7CBB0',
  cider: '#D0B45E',
  mixer: '#6E8B93',
  syrup: '#B08A5E',
  juice: '#C08658',
  garnish: '#7C9A63',
  other: '#8A7C74',
};

/** The same hues pulled down so they still read as ink on parchment. */
export const lightCategoryColors: Record<IngredientKind, string> = {
  spirit: '#9A6A2E',
  liqueur: '#8A5A82',
  vermouth: '#8A4E57',
  amaro: '#744339',
  bitters: '#8A3B33',
  fortified: '#83473C',
  wine: '#7A3A4B',
  beer: '#8F6E1E',
  sake: '#7E8560',
  cider: '#9C7A24',
  mixer: '#4F6E77',
  syrup: '#8A6540',
  juice: '#9A6538',
  garnish: '#5A7A42',
  other: '#6F625A',
};

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  categoryColors: Record<IngredientKind, string>;
  /**
   * The one gradient in the app: copper sheen on primary CTAs. Everything else
   * sits on flat surfaces — flat is what expensive looks like in the dark.
   */
  gradients: { brand: readonly [string, string] };
  /** One soft elevation for floating elements; nothing else casts. */
  shadows: { card: ViewStyle };
}

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: darkColors,
  categoryColors: darkCategoryColors,
  gradients: { brand: ['#E2A15D', '#C87F3C'] },
  shadows: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  },
};

export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  categoryColors: lightCategoryColors,
  gradients: { brand: ['#C87F3C', '#B0672A'] },
  shadows: {
    card: {
      shadowColor: '#1F1610',
      shadowOpacity: 0.10,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** Horizontal screen inset. Every screen shares this left edge. */
  gutter: 20,
  /** Vertical rhythm between sections. */
  section: 36,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Fraunces = voice, system sans = interface. If a string is tappable chrome
 * it is sans; if it is content with personality it is Fraunces. Fraunces is
 * never set below 16pt and never positively letterspaced.
 */
export const typography = {
  // Fraunces — voice.
  display: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: 'Fraunces_600SemiBold',
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  heading: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  /** Recipe descriptions and other prose with personality. */
  serifBody: { fontFamily: 'Fraunces_400Regular', fontSize: 16, lineHeight: 24 },
  /** Italic flourishes: "No. 12", invitations, empty-state lines. */
  flourish: { fontFamily: 'Fraunces_400Regular_Italic', fontSize: 16, lineHeight: 22 },
  /** Ledger numerals on Home. */
  statNumeral: { fontFamily: 'Fraunces_500Medium', fontSize: 28, lineHeight: 32 },

  // System sans — interface.
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  /** Letterspaced uppercase label — the workhorse section/field label. */
  overline: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
} as const;
