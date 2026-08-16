import { useMutation } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { RecipeDraft } from './recipes';
import type { RecipeWithIngredients } from './recipes';

/** A draft straight from the model, plus its one-line justification. */
export interface SuggestedRecipe extends RecipeDraft {
  rationale: string;
}

export interface SuggestionResponse {
  recipes: SuggestedRecipe[];
  /** How many suggestions were dropped for needing something not in stock. */
  rejected: number;
  message: string | null;
}

export function useSuggestCocktails() {
  return useMutation({
    mutationFn: async (query: string): Promise<SuggestionResponse> => {
      const { data, error } = await supabase.functions.invoke<SuggestionResponse>(
        'suggest-cocktails',
        { body: { query } },
      );

      if (error) throw error;
      if (!data) throw new Error('The suggestion service returned nothing.');
      return data;
    },
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
    ai_prompt: draft.ai_prompt ?? null,
    ai_model: draft.ai_model ?? null,
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
