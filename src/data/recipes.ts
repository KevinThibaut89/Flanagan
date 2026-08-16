import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth';
import type { Database, Recipe, RecipeIngredient } from '../types/database';
import { queryKeys } from './keys';

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[];
}

/**
 * The shape both the recipe editor and the AI response are converted into
 * before saving. Keeping one draft type is what stops the two paths from
 * drifting apart.
 */
export interface RecipeDraft {
  title: string;
  source: Database['public']['Enums']['recipe_source'];
  glass: string | null;
  method: Database['public']['Enums']['recipe_method'] | null;
  ice: Database['public']['Enums']['recipe_ice'] | null;
  garnish: string | null;
  instructions: string[];
  notes: string | null;
  flavor_tags: string[];
  base_ingredient_id: string | null;
  abv_estimate: number | null;
  servings: number;
  ai_prompt?: string | null;
  ai_model?: string | null;
  ingredients: RecipeIngredientDraft[];
}

export interface RecipeIngredientDraft {
  ingredient_id: string | null;
  free_text: string | null;
  amount_ml: number | null;
  amount_display: number | null;
  unit_display: Database['public']['Enums']['measure_unit'] | null;
  is_optional: boolean;
  is_garnish: boolean;
  note: string | null;
}

const RECIPE_SELECT = '*, recipe_ingredients(*)';

export function useRecipes() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.recipes(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<RecipeWithIngredients[]> => {
      const { data, error } = await supabase
        .from('recipes')
        .select(RECIPE_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as RecipeWithIngredients[]).map(sortIngredients);
    },
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: queryKeys.recipe(id),
    // The editor calls this with an empty id when writing a new recipe.
    enabled: id.length > 0,
    queryFn: async (): Promise<RecipeWithIngredients> => {
      const { data, error } = await supabase
        .from('recipes')
        .select(RECIPE_SELECT)
        .eq('id', id)
        .single();
      if (error) throw error;
      return sortIngredients(data as RecipeWithIngredients);
    },
  });
}

function sortIngredients(recipe: RecipeWithIngredients): RecipeWithIngredients {
  return {
    ...recipe,
    recipe_ingredients: [...recipe.recipe_ingredients].sort((a, b) => a.position - b.position),
  };
}

/**
 * A recipe is makeable when every required line — non-optional, non-garnish —
 * resolves to an ingredient you have. A line with only free text counts as not
 * satisfied: there is no id to check, and claiming availability the app cannot
 * verify would be worse than under-reporting.
 *
 * Mirrors `public.can_make()` in the database.
 */
export function canMake(recipe: RecipeWithIngredients, available: Set<string>): boolean {
  return recipe.recipe_ingredients.every((line) => {
    if (line.is_optional || line.is_garnish) return true;
    return line.ingredient_id !== null && available.has(line.ingredient_id);
  });
}

/** The required lines a recipe is short of, for the "you're missing" list. */
export function missingIngredients(
  recipe: RecipeWithIngredients,
  available: Set<string>,
): RecipeIngredient[] {
  return recipe.recipe_ingredients.filter((line) => {
    if (line.is_optional || line.is_garnish) return false;
    return line.ingredient_id === null || !available.has(line.ingredient_id);
  });
}

export function useSaveRecipe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (draft: RecipeDraft): Promise<Recipe> => {
      if (!user) throw new Error('Not signed in.');

      const { ingredients, ...recipe } = draft;

      const { data: saved, error } = await supabase
        .from('recipes')
        .insert({ ...recipe, user_id: user.id })
        .select()
        .single();
      if (error) throw error;

      if (ingredients.length > 0) {
        const { error: linesError } = await supabase.from('recipe_ingredients').insert(
          ingredients.map((line, position) => ({ ...line, recipe_id: saved.id, position })),
        );
        // PostgREST has no multi-statement transaction, so a failed second
        // insert would leave a recipe with no ingredients. Remove it rather
        // than stranding a shell in the library.
        if (linesError) {
          await supabase.from('recipes').delete().eq('id', saved.id);
          throw linesError;
        }
      }

      return saved;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes(user?.id) });
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: RecipeDraft }): Promise<void> => {
      const { ingredients, ...recipe } = draft;

      const { error } = await supabase.from('recipes').update(recipe).eq('id', id);
      if (error) throw error;

      // Ingredient lines are replaced wholesale: reordering and removing lines
      // in place would need diffing for no real benefit at this scale.
      const { error: deleteError } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', id);
      if (deleteError) throw deleteError;

      if (ingredients.length > 0) {
        const { error: insertError } = await supabase.from('recipe_ingredients').insert(
          ingredients.map((line, position) => ({ ...line, recipe_id: id, position })),
        );
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipe(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes(user?.id) });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from('recipes')
        .update({ is_favorite: isFavorite })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipe(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes(user?.id) });
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      // recipe_ingredients cascade on delete.
      const { error } = await supabase.from('recipes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes(user?.id) });
    },
  });
}
