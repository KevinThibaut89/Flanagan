import { useMutation } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { asQuotaError, useInvalidatePlan } from './plan';
import type { RecipeDraft } from './recipes';
import type { RecipeWithIngredients } from './recipes';

/** A draft straight from the model, plus its one-line justification. */
export interface SuggestedRecipe extends RecipeDraft {
  rationale: string;
  /**
   * The house-book row behind this suggestion — what a thumb up/down attaches
   * to. Null when the library write failed (or from an older deployment of the
   * function); the thumbs are simply hidden then.
   */
  library_recipe_id: string | null;
}

export interface SuggestionResponse {
  recipes: SuggestedRecipe[];
  /** How many suggestions were dropped for needing something not in stock. */
  rejected: number;
  /**
   * True when the answer came from the shared library — recipes the Barkeep
   * has served before for a near-identical ask — without calling the model or
   * spending one of the month's asks.
   */
  from_library: boolean;
  message: string | null;
}

export interface SuggestionRequest {
  query: string;
  /** Skip the library shortcut and ask the model — "Ask the Barkeep anyway". */
  forceAi?: boolean;
}

export function useSuggestCocktails() {
  const invalidatePlan = useInvalidatePlan();
  return useMutation({
    mutationFn: async ({ query, forceAi = false }: SuggestionRequest): Promise<SuggestionResponse> => {
      const { data, error } = await supabase.functions.invoke<SuggestionResponse>(
        'suggest-cocktails',
        { body: { query, force_ai: forceAi } },
      );

      // A 402 is not a failure of the service; it is the month's allowance,
      // and the screen offers Plus rather than an error line.
      if (error) throw await asQuotaError(error);
      if (!data) throw new Error('The suggestion service returned nothing.');
      // Older deployments of the function do not send the flag or the library
      // ids; read them as "no" and "none".
      return {
        ...data,
        from_library: data.from_library === true,
        recipes: (data.recipes ?? []).map((recipe) => ({
          ...recipe,
          library_recipe_id: recipe.library_recipe_id ?? null,
        })),
      };
    },
    // A model answer costs an ask; the "N left" line should move straight away.
    // (A library answer does not, and invalidating is still the cheap, honest
    // thing to do.)
    onSettled: () => void invalidatePlan(),
  });
}

/**
 * Wraps an unsaved draft so the normal recipe components can render it.
 *
 * The ids are synthetic and never leave the screen — they exist only because
 * `RecipeCard` and `RecipeIngredientList` key off them. Reusing those components
 * is deliberate: a suggestion should look exactly like the saved recipe it is
 * about to become, so there is no surprise after tapping Save.
 */
export function draftToPreview(draft: SuggestedRecipe, index: number): RecipeWithIngredients {
  const id = `preview-${index}`;
  const now = new Date().toISOString();

  return {
    id,
    user_id: 'preview',
    title: draft.title,
    source: draft.source,
    glass: draft.glass,
    method: draft.method,
    ice: draft.ice,
    garnish: draft.garnish,
    instructions: draft.instructions,
    notes: draft.notes,
    flavor_tags: draft.flavor_tags,
    base_ingredient_id: draft.base_ingredient_id,
    abv_estimate: draft.abv_estimate,
    servings: draft.servings,
    is_favorite: false,
    image_url: null,
    ai_prompt: draft.ai_prompt ?? null,
    ai_model: draft.ai_model ?? null,
    library_recipe_id: draft.library_recipe_id ?? null,
    created_at: now,
    updated_at: now,
    recipe_ingredients: draft.ingredients.map((line, position) => ({
      id: `${id}-${position}`,
      recipe_id: id,
      ingredient_id: line.ingredient_id,
      free_text: line.free_text,
      amount_ml: line.amount_ml,
      amount_display: line.amount_display,
      unit_display: line.unit_display,
      is_optional: line.is_optional,
      is_garnish: line.is_garnish,
      position,
      note: line.note,
    })),
  };
}
