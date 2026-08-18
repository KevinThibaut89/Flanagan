import type { RecipeIce, RecipeMethod } from '../types/database';

/** Human labels for the recipe enums, shared by the detail screen and filters. */
export const METHOD_LABELS: Record<RecipeMethod, string> = {
  shake: 'Shake',
  stir: 'Stir',
  build: 'Build in glass',
  blend: 'Blend',
  throw: 'Throw',
  swizzle: 'Swizzle',
  muddle: 'Muddle',
};

export const ICE_LABELS: Record<RecipeIce, string> = {
  none: 'No ice',
  cubed: 'Cubed ice',
  crushed: 'Crushed ice',
  large_cube: 'One large cube',
  block: 'Block ice',
};
