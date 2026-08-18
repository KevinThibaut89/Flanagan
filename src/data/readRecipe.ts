import { useMutation } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { MeasureUnit, RecipeIce, RecipeMethod } from '../types/database';
import type { ShelfMimeType } from './identify';

export type ReadConfidence = 'high' | 'medium' | 'low';

/** One ingredient line as read off the page, slug already validated server-side. */
export interface ReadLine {
  /** The ingredient as printed, e.g. "fresh lemon juice". */
  text: string;
  ingredient_id: string | null;
  slug: string | null;
  amount: number | null;
  unit: MeasureUnit | null;
  is_optional: boolean;
  is_garnish: boolean;
  note: string | null;
}

/** One recipe the model read off the photo — the editor's fields, nullable. */
export interface ReadRecipe {
  title: string;
  glass: string | null;
  method: RecipeMethod | null;
  ice: RecipeIce | null;
  garnish: string | null;
  instructions: string[];
  notes: string | null;
  flavor_tags: string[];
  servings: number | null;
  ingredients: ReadLine[];
  confidence: ReadConfidence;
}

export interface ReadRecipeResponse {
  /** A page can hold several recipes; the app lets the user pick. */
  recipes: ReadRecipe[];
  /** Set when the list is empty: what to tell the user instead of a blank form. */
  message: string | null;
}

/**
 * Asks the read-recipe function what recipe is on a photographed page.
 *
 * The answer is a prefill for the recipe editor — the editor is the review
 * step — so an empty list is a normal result, and callers show the returned
 * `message` rather than treating it as a failure.
 */
export function useReadRecipe() {
  return useMutation({
    mutationFn: async (input: {
      base64: string;
      mimeType: ShelfMimeType;
    }): Promise<ReadRecipeResponse> => {
      const { data, error } = await supabase.functions.invoke<ReadRecipeResponse>('read-recipe', {
        body: { image: input.base64, mimeType: input.mimeType },
      });

      if (error) throw error;
      if (!data) throw new Error('The recipe reader returned nothing.');
      return data;
    },
  });
}
