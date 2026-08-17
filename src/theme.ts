/**
 * A single dark theme. A bar app is used in dim rooms at night, so there is no
 * light variant to maintain — every colour here is tuned against `bg`.
 *
 * The design language is a cocktail menu, not a dashboard: content is the
 * interface and containers are rare. Fraunces carries the voice (titles,
 * numerals, flourishes); the system sans carries the interface (buttons,
 * labels, metadata). Copper appears at most three times per screen — the
 * primary action, the active tab, one keyline or numeral — so that when it
 * does appear it reads as a brass rail, not a theme colour.
 */

export const colors = {
  bg: '#120E0B',
  surface: '#1C1714',
  /** Modals and sheets only. */
  surfaceRaised: '#262019',

  /** Hairlines are derived from the text colour so they sit in the same warm register. */
  border: 'rgba(245, 237, 230, 0.10)',
  borderSubtle: 'rgba(245, 237, 230, 0.06)',

  text: '#F3EBE2',
  textMuted: '#B0A296',
  textFaint: '#6E6259',

  /** Copper. The one accent — primary actions, active tab, a rare keyline. */
  accent: '#C87F3C',
  /** Pressed/active copper and the bright stop of the brand gradient. */
  accentSoft: '#E2A15D',
  /** The quiet-luxury secondary: ornaments, numerals, monograms. */
  cream: '#E9DCC9',

  success: '#6FA86B',
  warning: '#D4A03C',
  danger: '#C4574B',

  /** Translucent overlay for modals and scanner chrome. */
  scrim: 'rgba(8, 6, 4, 0.78)',
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
 * The one gradient in the app: copper sheen on primary CTAs. Everything else
 * sits on flat surfaces — flat is what expensive looks like in the dark.
 */
export const gradients = {
  brand: ['#E2A15D', '#C87F3C'] as const,
} as const;

/** One soft elevation for floating elements; nothing else casts. */
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
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
