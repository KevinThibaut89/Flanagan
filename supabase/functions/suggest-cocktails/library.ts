import { buildEmbedText, fingerprint } from '../_shared/library.ts';
import type { SuggestedRecipe } from './schema.ts';
import { toMl } from './units.ts';

/**
 * The half of the library plumbing that depends on the model's output schema:
 * turning a validated `SuggestedRecipe` into the jsonb element `library_upsert`
 * takes. Lives next to the schema it depends on; `_shared/library.ts` holds
 * what `search-library` also needs.
 */

export interface IngredientRef {
  id: string;
  slug: string;
  name: string;
}

/** Slugs of the required (non-optional, non-garnish) lines. */
export function requiredSlugs(recipe: SuggestedRecipe): string[] {
  return recipe.ingredients
    .filter((line) => !line.is_garnish && !line.is_optional)
    .map((line) => line.ingredient);
}

/** Embedding input for one suggestion, ingredient names resolved through the vocabulary. */
export function embedTextFor(recipe: SuggestedRecipe, bySlug: Map<string, IngredientRef>): string {
  return buildEmbedText({
    title: recipe.title,
    flavor_tags: recipe.flavor_tags,
    method: recipe.method,
    glass: recipe.glass || null,
    ice: recipe.ice,
    baseName: bySlug.get(recipe.base_ingredient)?.name ?? null,
    lines: recipe.ingredients.map((line) => ({
      name: bySlug.get(line.ingredient)?.name ?? line.ingredient,
      amount: line.amount,
      unit: line.unit,
      is_garnish: line.is_garnish,
      is_optional: line.is_optional,
    })),
    rationale: recipe.rationale || null,
  });
}

/**
 * One element of `library_upsert`'s `p_recipes`. The line mapping is the same
 * as `toDraft` in index.ts — it has to be, so a library recipe and a fresh one
 * render identically.
 */
export function toLibraryRow(
  recipe: SuggestedRecipe,
  bySlug: Map<string, IngredientRef>,
  embedText: string,
  embedding: number[] | null,
  embedModel: string,
) {
  return {
    fingerprint: fingerprint(recipe.title, requiredSlugs(recipe)),
    title: recipe.title,
    rationale: recipe.rationale || null,
    glass: recipe.glass || null,
    method: recipe.method,
    ice: recipe.ice,
    garnish: recipe.garnish || null,
    instructions: recipe.instructions,
    flavor_tags: recipe.flavor_tags,
    base_ingredient_id: bySlug.get(recipe.base_ingredient)?.id ?? null,
    abv_estimate: Number.isFinite(recipe.abv_estimate) ? recipe.abv_estimate : null,
    servings: recipe.servings > 0 ? recipe.servings : 1,
    embed_text: embedText,
    embed_model: embedding ? embedModel : null,
    embedding,
    ingredients: recipe.ingredients.map((line) => {
      const ingredient = bySlug.get(line.ingredient);
      return {
        ingredient_id: ingredient?.id ?? null,
        free_text: ingredient ? null : line.ingredient,
        amount_ml: line.amount > 0 ? toMl(line.amount, line.unit) : null,
        amount_display: line.amount > 0 ? line.amount : null,
        unit_display: line.unit,
        is_optional: line.is_optional,
        is_garnish: line.is_garnish,
        note: line.note || null,
      };
    }),
  };
}
