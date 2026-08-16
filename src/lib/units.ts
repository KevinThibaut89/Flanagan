import type { MeasureUnit, UnitPreference } from '../types/database';

/**
 * Liquid amounts are stored once, in millilitres, and rendered per the user's
 * preference. Non-volume units (a dash, a barspoon, half an egg white) are kept
 * as authored, because "0.92 ml of Angostura" is not how anyone reads a recipe.
 */

export const ML_PER_OZ = 29.5735;
export const ML_PER_CL = 10;
export const ML_PER_DASH = 0.92;
export const ML_PER_BARSPOON = 5;
export const ML_PER_TSP = 5;
export const ML_PER_TBSP = 15;
export const ML_PER_SPLASH = 5;

/** Units that describe a volume and can therefore be converted between systems. */
const VOLUME_UNITS: MeasureUnit[] = ['ml', 'cl', 'oz'];

/** Units that carry their own meaning and are shown exactly as written. */
const UNIT_LABELS: Record<MeasureUnit, string> = {
  ml: 'ml',
  cl: 'cl',
  oz: 'oz',
  dash: 'dash',
  barspoon: 'barspoon',
  tsp: 'tsp',
  tbsp: 'tbsp',
  drop: 'drop',
  piece: '',
  pinch: 'pinch',
  splash: 'splash',
  top: '',
};

/** Units where "2 dashes" reads better than "2 dash". */
const PLURALISABLE: MeasureUnit[] = ['dash', 'barspoon', 'drop', 'pinch', 'splash', 'piece'];

export function isVolumeUnit(unit: MeasureUnit | null): boolean {
  return unit !== null && VOLUME_UNITS.includes(unit);
}

/** Converts an authored amount into millilitres for storage. */
export function toMl(amount: number, unit: MeasureUnit): number | null {
  switch (unit) {
    case 'ml':
      return amount;
    case 'cl':
      return amount * ML_PER_CL;
    case 'oz':
      return amount * ML_PER_OZ;
    case 'dash':
      return amount * ML_PER_DASH;
    case 'barspoon':
      return amount * ML_PER_BARSPOON;
    case 'tsp':
      return amount * ML_PER_TSP;
    case 'tbsp':
      return amount * ML_PER_TBSP;
    case 'splash':
      return amount * ML_PER_SPLASH;
    // Countable or unmeasured: there is no millilitre equivalent.
    case 'drop':
    case 'piece':
    case 'pinch':
    case 'top':
      return null;
  }
}

const FRACTIONS: Array<[number, string]> = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
];

/** 44.36 ml → "1½". Rounds to the nearest quarter ounce, as a jigger would. */
function formatOunces(ml: number): string {
  const quarters = Math.round((ml / ML_PER_OZ) * 4);
  const whole = Math.floor(quarters / 4);
  const remainder = quarters % 4;

  if (remainder === 0) return String(whole);

  const fraction = FRACTIONS.find(([value]) => Math.abs(value - remainder / 4) < 0.01)?.[1] ?? '';
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

/** Millilitres, rounded to something a jigger can actually pour. */
function formatMillilitres(ml: number): string {
  const rounded = ml >= 10 ? Math.round(ml / 5) * 5 : Math.round(ml * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatCount(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fraction = FRACTIONS.find(([v]) => Math.abs(v - (value % 1)) < 0.01)?.[1];
  if (!fraction) return String(Math.round(value * 100) / 100);
  const whole = Math.floor(value);
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

export interface Measurable {
  amount_ml: number | null;
  amount_display: number | null;
  unit_display: MeasureUnit | null;
}

/**
 * Renders an ingredient line's quantity. Returns null when the line has no
 * quantity at all — "top with soda", "absinthe rinse" — so callers can omit the
 * column rather than print a stray unit.
 */
export function formatAmount(item: Measurable, preference: UnitPreference): string | null {
  // A convertible volume: ignore how it was authored and render in the user's
  // system from the normalised value.
  if (item.amount_ml !== null && isVolumeUnit(item.unit_display)) {
    return preference === 'imperial'
      ? `${formatOunces(item.amount_ml)} oz`
      : `${formatMillilitres(item.amount_ml)} ml`;
  }

  // A volume with no explicit unit still has a normalised value to show.
  if (item.amount_ml !== null && item.unit_display === null) {
    return preference === 'imperial'
      ? `${formatOunces(item.amount_ml)} oz`
      : `${formatMillilitres(item.amount_ml)} ml`;
  }

  if (item.amount_display === null || item.unit_display === null) return null;

  const label = UNIT_LABELS[item.unit_display];
  const amount = formatCount(item.amount_display);

  if (!label) return amount;

  const plural =
    item.amount_display > 1 && PLURALISABLE.includes(item.unit_display) ? `${label}s` : label;

  return `${amount} ${plural}`;
}

/** "Top with soda" and friends have no amount but still need a verb. */
export function isTopUp(item: Measurable): boolean {
  return item.unit_display === 'top';
}

/** Formats a bottle's remaining volume for the inventory list. */
export function formatBottleSize(volumeMl: number | null, preference: UnitPreference): string | null {
  if (volumeMl === null) return null;
  if (preference === 'imperial') {
    const oz = volumeMl / ML_PER_OZ;
    return `${Math.round(oz * 10) / 10} oz`;
  }
  return volumeMl >= 1000 ? `${Math.round((volumeMl / 1000) * 100) / 100} L` : `${volumeMl} ml`;
}
