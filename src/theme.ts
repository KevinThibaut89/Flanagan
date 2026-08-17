/**
 * A single dark theme. A bar app is used in dim rooms at night, so there is no
 * light variant to maintain — every colour here is tuned against `bg`.
 */

export const colors = {
  bg: '#14100E',
  surface: '#1F1917',
  surfaceRaised: '#2A2321',
  border: '#3A302C',
  borderSubtle: '#2C2422',

  text: '#F5EDE6',
  textMuted: '#A89A90',
  textFaint: '#75675F',

  /** Copper. Primary actions, active tabs, links. */
  accent: '#C87F3C',
  accentSoft: '#E5A96A',
  accentDim: '#4A3524',
  /** Translucent copper wash for highlighted surfaces and icon wells. */
  accentGlow: 'rgba(200, 127, 60, 0.14)',

  success: '#6FA86B',
  warning: '#D4A03C',
  danger: '#C4574B',

  /** Translucent overlay for modals and scanner chrome. */
  scrim: 'rgba(10, 7, 6, 0.75)',
} as const;

// Category accents, used for bottle type pills and recipe base-spirit tags.
export const categoryColors: Record<string, string> = {
  gin: '#8FB8C9',
  whisky: '#C08A4A',
  rum: '#B5763F',
  vodka: '#B9C3C7',
  tequila: '#C3B36A',
  mezcal: '#9A8B55',
  brandy: '#B06A3E',
  liqueur: '#B07FA8',
  vermouth: '#A46B72',
  amaro: '#8B5A52',
  bitters: '#9C4A42',
  wine: '#8E4A5C',
  beer: '#C9A24A',
  mixer: '#6E8B93',
  syrup: '#B08A5E',
  juice: '#C08658',
  garnish: '#7C9A63',
  other: '#8A7C74',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Gradient stops for `expo-linear-gradient`. Kept here so every gradient in
 * the app comes from the same small set, tuned against `bg`.
 */
export const gradients = {
  /** Warm candle-lit surface for the hero card on Home. */
  hero: ['#38271A', '#241A13', '#1C1512'] as const,
  /** Copper sheen for the brand mark and raised primary actions. */
  brand: ['#E5A96A', '#C87F3C'] as const,
  /** Barely-there lift for secondary cards. */
  card: ['#241D1A', '#1F1917'] as const,
} as const;

/** Elevation presets — RN needs both the iOS shadow and Android elevation. */
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#C87F3C',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
} as const;

export const typography = {
  /** Oversized numerals and the Home greeting. */
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  subheading: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6 },
} as const;
