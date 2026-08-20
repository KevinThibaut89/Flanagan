import type { MEASURE_UNITS } from './schema.ts';

type MeasureUnit = (typeof MEASURE_UNITS)[number];

/**
 * Mirrors `src/lib/units.ts` on the client. Duplicated rather than shared
 * because edge functions run on Deno and cannot import from the React Native
 * source tree; the two must be changed together.
 */
const ML_PER_UNIT: Partial<Record<MeasureUnit, number>> = {
  ml: 1,
  cl: 10,
  oz: 29.5735,
  dash: 0.92,
  barspoon: 5,
  tsp: 5,
  tbsp: 15,
  splash: 5,
};

/** Countable and unmeasured units have no millilitre equivalent. */
export function toMl(amount: number, unit: MeasureUnit): number | null {
  const factor = ML_PER_UNIT[unit];
  if (factor === undefined) return null;
  const ml = amount * factor;
  return Number.isFinite(ml) && ml > 0 ? Math.round(ml * 100) / 100 : null;
}
