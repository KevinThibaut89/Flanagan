/**
 * A single dark theme. A bar app is used in dim rooms at night, so there is no
 * light variant to maintain — every colour here is tuned against `bg`.
 *
 * Values follow the iOS system dark palette (systemBackground, systemGray6,
 * separator, label hierarchy, semantic colours), with copper kept as the one
 * tint colour.
 */

export const colors = {
  /** systemBackground */
  bg: '#000000',
  /** secondarySystemBackground / systemGray6 */
  surface: '#1C1C1E',
  /** tertiarySystemBackground / systemGray5 */
  surfaceRaised: '#2C2C2E',
  /** separator */
  border: 'rgba(84, 84, 88, 0.65)',
  borderSubtle: 'rgba(84, 84, 88, 0.36)',

  /** systemFill — gray button backgrounds. */
  fill: 'rgba(120, 120, 128, 0.36)',
  /** tertiarySystemFill — search fields, chips. */
  fillSubtle: 'rgba(120, 120, 128, 0.24)',

  /** label */
  text: '#FFFFFF',
  /** secondaryLabel */
  textMuted: 'rgba(235, 235, 245, 0.6)',
  /** tertiaryLabel */
  textFaint: 'rgba(235, 235, 245, 0.3)',

  /** Copper. The app's single tint colour: primary actions, active tabs, links. */
  accent: '#D28E4D',
  accentSoft: '#E5A96A',
  /** Tint wash for selected chips and highlighted fills. */
  accentDim: 'rgba(210, 142, 77, 0.18)',

  /** systemGreen / systemOrange / systemRed (dark) */
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',

  /** Translucent overlay for modals and scanner chrome. */
  scrim: 'rgba(0, 0, 0, 0.6)',
} as const;

// Category accents, used for bottle type pills and recipe base-spirit tags.
// Hues sit in the iOS system-colour range so they stay vivid on pure black.
export const categoryColors: Record<string, string> = {
  spirit: '#D28E4D',
  gin: '#64D2FF',
  whisky: '#FF9F0A',
  rum: '#AC8E68',
  vodka: '#AEAEB2',
  tequila: '#FFD60A',
  mezcal: '#B8A24A',
  brandy: '#E97C35',
  liqueur: '#BF5AF2',
  vermouth: '#FF6482',
  fortified: '#E06A85',
  amaro: '#D0665A',
  bitters: '#FF453A',
  wine: '#FF375F',
  beer: '#D9A62E',
  mixer: '#63E6E2',
  syrup: '#D9995A',
  juice: '#FFB340',
  garnish: '#30D158',
  other: '#98989D',
};

/**
 * An ~18% wash of a category colour, for iOS-style tinted capsules.
 * Only 6-digit hex colours can take the alpha suffix; anything else gets the
 * neutral tertiary fill.
 */
export function tintOf(color: string): string {
  return color.startsWith('#') && color.length === 7 ? `${color}2E` : colors.fillSubtle;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  /** Inset-grouped cards, search fields. */
  md: 10,
  /** Buttons and other controls. */
  control: 12,
  /** Modals and floating panels. */
  lg: 14,
  pill: 999,
} as const;

// The iOS type scale. SF applies its own optical tracking, so no manual
// letterSpacing. Legacy aliases keep older call sites on the same scale.
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const },
  title1: { fontSize: 28, fontWeight: '700' as const },
  title2: { fontSize: 22, fontWeight: '700' as const },
  title3: { fontSize: 20, fontWeight: '600' as const },
  headline: { fontSize: 17, fontWeight: '600' as const },
  body17: { fontSize: 17, fontWeight: '400' as const },
  callout: { fontSize: 16, fontWeight: '400' as const },
  subheadline: { fontSize: 15, fontWeight: '400' as const },
  footnote: { fontSize: 13, fontWeight: '400' as const },
  caption1: { fontSize: 12, fontWeight: '400' as const },
  caption2: { fontSize: 11, fontWeight: '400' as const },

  // Legacy aliases.
  title: { fontSize: 28, fontWeight: '700' as const },
  heading: { fontSize: 22, fontWeight: '700' as const },
  subheading: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 17, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  /** Uppercase grouped-section headers. */
  tiny: { fontSize: 13, fontWeight: '400' as const },
} as const;
