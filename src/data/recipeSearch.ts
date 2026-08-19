import type { IngredientIndex } from './ingredients';
import { normalize } from '../lib/text';
import type { RecipeWithIngredients } from './recipes';
import { METHOD_LABELS } from '../lib/recipeLabels';
import type { Ingredient, RecipeMethod } from '../types/database';

/**
 * Pure search, facet and sort helpers for the recipe library. Nothing here
 * touches React or Supabase: the screen builds the inputs from its query
 * caches and these functions only derive views over them.
 */

// ---------------------------------------------------------------------------
// Text search
// ---------------------------------------------------------------------------

// `normalize` and `searchTerms` live in ../lib/text so the ingredient index can
// share them. Re-exported here because the recipe screens import them from this
// module, and where they are defined is not those screens' business.
export { normalize, searchTerms } from '../lib/text';

/**
 * Everything on a recipe worth searching, folded into one normalized string.
 * Ingredient names come from the index; while it is still loading only the
 * fields stored on the recipe itself are searchable, and the caller's memo
 * rebuilds this once the index arrives.
 */
export function recipeHaystack(
  recipe: RecipeWithIngredients,
  index: IngredientIndex | null,
): string {
  const parts: Array<string | null | undefined> = [recipe.title, recipe.glass, recipe.garnish];

  for (const line of recipe.recipe_ingredients) {
    const ingredient = line.ingredient_id ? index?.byId.get(line.ingredient_id) : null;
    if (ingredient) {
      parts.push(ingredient.name, ...ingredient.aliases);
    }
    parts.push(line.free_text);
  }

  parts.push(...recipe.flavor_tags);

  const base = baseSpiritOf(recipe, index);
  if (base) parts.push(base.name);
  const own = recipe.base_ingredient_id ? index?.byId.get(recipe.base_ingredient_id) : null;
  if (own && own.id !== base?.id) parts.push(own.name);

  return parts
    .filter((part): part is string => Boolean(part))
    .map(normalize)
    .join(' | ');
}

/** Every term must appear somewhere in the haystack. */
export function matchesSearch(haystack: string, terms: string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------

export type RecipeSort = 'newest' | 'alpha' | 'number';

export const SORT_OPTIONS: Array<{ key: RecipeSort; label: string }> = [
  { key: 'newest', label: 'Newest' },
  { key: 'alpha', label: 'A–Z' },
  { key: 'number', label: 'Notebook No.' },
];

/** Multi-select per group; a group with nothing selected does not constrain. */
export interface RecipeFacetSelection {
  /** Ids of top-level base ingredients (Gin, Rum, …). */
  bases: string[];
  methods: RecipeMethod[];
  /** Normalized flavour tags. */
  tags: string[];
}

export const EMPTY_FACETS: RecipeFacetSelection = { bases: [], methods: [], tags: [] };

export interface FacetOption<K extends string = string> {
  key: K;
  label: string;
  count: number;
}

export interface RecipeFacets {
  bases: FacetOption[];
  methods: FacetOption<RecipeMethod>[];
  tags: FacetOption[];
}

/**
 * The family a recipe belongs to: the top-most ancestor of its base
 * ingredient, so "London dry gin" and "Old Tom gin" both file under Gin. An
 * ingredient with no parent is its own family.
 */
export function baseSpiritOf(
  recipe: RecipeWithIngredients,
  index: IngredientIndex | null,
): Ingredient | null {
  if (!index || !recipe.base_ingredient_id) return null;
  const chain = index.ancestorsOf(recipe.base_ingredient_id);
  return chain[chain.length - 1] ?? index.byId.get(recipe.base_ingredient_id) ?? null;
}

/**
 * The options offered in the filter sheet, derived from the whole library so
 * counts stay put while the user toggles. Only values that actually occur are
 * offered — an empty group is hidden by the sheet.
 */
export function recipeFacets(
  recipes: RecipeWithIngredients[],
  index: IngredientIndex | null,
): RecipeFacets {
  const bases = new Map<string, FacetOption>();
  const methods = new Map<RecipeMethod, FacetOption<RecipeMethod>>();
  const tags = new Map<string, FacetOption>();

  for (const recipe of recipes) {
    const base = baseSpiritOf(recipe, index);
    if (base) {
      const entry = bases.get(base.id) ?? { key: base.id, label: base.name, count: 0 };
      entry.count += 1;
      bases.set(base.id, entry);
    }

    if (recipe.method) {
      const entry = methods.get(recipe.method) ?? {
        key: recipe.method,
        label: METHOD_LABELS[recipe.method],
        count: 0,
      };
      entry.count += 1;
      methods.set(recipe.method, entry);
    }

    // A recipe listing the same tag twice ("Dry, dry") should count once.
    const seen = new Set<string>();
    for (const raw of recipe.flavor_tags) {
      const key = normalize(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = tags.get(key) ?? { key, label: raw.trim(), count: 0 };
      entry.count += 1;
      tags.set(key, entry);
    }
  }

  const byCountThenLabel = <K extends string>(a: FacetOption<K>, b: FacetOption<K>) =>
    b.count - a.count || a.label.localeCompare(b.label);

  return {
    bases: [...bases.values()].sort(byCountThenLabel),
    methods: [...methods.values()].sort(byCountThenLabel),
    tags: [...tags.values()].sort(byCountThenLabel),
  };
}

/** OR within a group, AND across groups. */
export function matchesFacets(
  recipe: RecipeWithIngredients,
  selection: RecipeFacetSelection,
  index: IngredientIndex | null,
): boolean {
  if (selection.bases.length > 0) {
    const base = baseSpiritOf(recipe, index);
    if (!base || !selection.bases.includes(base.id)) return false;
  }

  if (selection.methods.length > 0) {
    if (!recipe.method || !selection.methods.includes(recipe.method)) return false;
  }

  if (selection.tags.length > 0) {
    const own = recipe.flavor_tags.map(normalize);
    if (!selection.tags.some((tag) => own.includes(tag))) return false;
  }

  return true;
}

export function activeFacetCount(selection: RecipeFacetSelection): number {
  return selection.bases.length + selection.methods.length + selection.tags.length;
}

/** Add the key if absent, remove it if present. */
export function toggleKey<K extends string>(list: K[], key: K): K[] {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

/** Always returns a new array; 'newest' keeps the query's created_at-desc order. */
export function sortRecipes(
  recipes: RecipeWithIngredients[],
  sort: RecipeSort,
): RecipeWithIngredients[] {
  const copy = [...recipes];
  switch (sort) {
    case 'alpha':
      return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    case 'number':
      return copy.sort((a, b) => a.created_at.localeCompare(b.created_at));
    default:
      return copy;
  }
}
