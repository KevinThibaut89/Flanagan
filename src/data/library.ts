import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { useAuth } from '../providers/auth';
import type { Database, LibraryRecipe, LibraryRecipeIngredient } from '../types/database';
import { queryKeys } from './keys';
import type { RecipeDraft, RecipeWithIngredients } from './recipes';

/**
 * The shared recipe library — every drink the Barkeep has ever produced for
 * anyone, anonymised, embedded and searchable. Read-only from the app: rows
 * are written by the `suggest-cocktails` function, and the only way a library
 * recipe becomes *yours* is "Save to my recipes", which goes through the same
 * `useSaveRecipe` path as a fresh suggestion or a hand-written recipe.
 *
 * Three reads: browse (an authenticated RPC, sorted, optionally only what you
 * can make), search (the `search-library` function, because the query has to
 * be embedded server-side), and one recipe by id (plain PostgREST). All three
 * hand back the same `LibraryRecipeRow`, and two mappers turn that into the
 * shapes the rest of the app already renders and saves.
 */

/** Rows as every library read returns them. `similarity` only on search. */
export interface LibraryRecipeRow {
  id: string;
  title: string;
  rationale: string | null;
  glass: string | null;
  method: Database['public']['Enums']['recipe_method'] | null;
  ice: Database['public']['Enums']['recipe_ice'] | null;
  garnish: string | null;
  instructions: string[];
  flavor_tags: string[];
  base_ingredient_id: string | null;
  abv_estimate: number | null;
  servings: number;
  required_ingredient_ids: string[];
  ai_model: string;
  times_suggested: number;
  created_at: string;
  ingredients: LibraryRecipeIngredient[];
  /** Computed server-side against the caller's bar. */
  makeable: boolean;
  similarity?: number;
}

export type LibrarySort = 'newest' | 'popular';

/** Public columns only — never the 1536-float embedding or its source text. */
const LIBRARY_COLUMNS =
  'id, title, rationale, glass, method, ice, garnish, instructions, flavor_tags, base_ingredient_id, abv_estimate, servings, required_ingredient_ids, ai_model, times_suggested, created_at';

/** The RPCs hand lines back as jsonb; type them once, sorted by position. */
function linesFrom(raw: unknown): LibraryRecipeIngredient[] {
  const lines = Array.isArray(raw) ? (raw as LibraryRecipeIngredient[]) : [];
  return [...lines].sort((a, b) => a.position - b.position);
}

function rowFrom(raw: Record<string, unknown>): LibraryRecipeRow {
  return {
    ...(raw as unknown as Omit<LibraryRecipeRow, 'ingredients' | 'makeable'>),
    ingredients: linesFrom(raw.ingredients),
    makeable: raw.makeable === true,
  };
}

export function useLibraryBrowse({
  makeable,
  sort,
}: {
  makeable: boolean;
  sort: LibrarySort;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.libraryBrowse(userId, { makeable, sort }),
    enabled: Boolean(userId),
    queryFn: async (): Promise<LibraryRecipeRow[]> => {
      const { data, error } = await supabase.rpc('library_browse', {
        p_only_makeable: makeable,
        p_sort: sort,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []).map((row) => rowFrom(row as unknown as Record<string, unknown>));
    },
  });
}

/**
 * Semantic search. Debounced, and not run at all for fewer than two
 * characters — every call is an embedding on the server. A query searched once
 * in a session stays fresh for a while; the library does not change under you
 * fast enough to matter.
 */
export function useLibrarySearch(query: string, { makeable }: { makeable: boolean }) {
  const { user } = useAuth();
  const userId = user?.id;
  const debounced = useDebouncedValue(query.trim(), 400);
  const active = debounced.length >= 2;

  const result = useQuery({
    queryKey: queryKeys.librarySearch(userId, debounced, makeable),
    enabled: Boolean(userId) && active,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LibraryRecipeRow[]> => {
      const { data, error } = await supabase.functions.invoke<{ recipes: Record<string, unknown>[] }>(
        'search-library',
        { body: { query: debounced, only_makeable: makeable } },
      );
      if (error) throw error;
      return (data?.recipes ?? []).map(rowFrom);
    },
  });

  return { ...result, active, debounced };
}

export function useLibraryRecipe(id: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.libraryRecipe(user?.id, id),
    enabled: Boolean(user?.id && id),
    queryFn: async (): Promise<LibraryRecipeRow> => {
      const { data, error } = await supabase
        .from('library_recipes')
        .select(`${LIBRARY_COLUMNS}, library_recipe_ingredients(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      const { library_recipe_ingredients, ...recipe } = data as unknown as Omit<
        LibraryRecipe,
        'embedding' | 'embed_text' | 'embed_model' | 'embedded_at' | 'fingerprint' | 'prompt_version' | 'last_suggested_at'
      > & { library_recipe_ingredients: LibraryRecipeIngredient[] };
      // Makeability is computed on the client here (the detail screen already
      // has the bar in hand); `canMake` on the preview does the work.
      return { ...recipe, ingredients: linesFrom(library_recipe_ingredients), makeable: false };
    },
  });
}

/**
 * Wraps a library row so the normal recipe components render it — the same
 * trick `draftToPreview` plays for an unsaved suggestion. `user_id` is a
 * marker, never a real owner; nothing here is written back.
 */
export function libraryToPreview(row: LibraryRecipeRow): RecipeWithIngredients {
  return {
    id: row.id,
    user_id: 'library',
    title: row.title,
    source: 'ai',
    glass: row.glass,
    method: row.method,
    ice: row.ice,
    garnish: row.garnish,
    instructions: row.instructions,
    notes: null,
    flavor_tags: row.flavor_tags,
    base_ingredient_id: row.base_ingredient_id,
    abv_estimate: row.abv_estimate,
    servings: row.servings,
    is_favorite: false,
    image_url: null,
    ai_prompt: null,
    ai_model: row.ai_model,
    library_recipe_id: row.id,
    created_at: row.created_at,
    updated_at: row.created_at,
    recipe_ingredients: row.ingredients.map((line, position) => ({
      id: line.id,
      recipe_id: row.id,
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

/** What "Save to my recipes" hands to `useSaveRecipe`. */
export function libraryToDraft(row: LibraryRecipeRow): RecipeDraft {
  return {
    title: row.title,
    source: 'ai',
    glass: row.glass,
    method: row.method,
    ice: row.ice,
    garnish: row.garnish,
    instructions: row.instructions,
    notes: null,
    flavor_tags: row.flavor_tags,
    base_ingredient_id: row.base_ingredient_id,
    abv_estimate: row.abv_estimate,
    servings: row.servings,
    ai_prompt: null,
    ai_model: row.ai_model,
    // The link back to the house book: saving from Discover is a taste signal.
    library_recipe_id: row.id,
    ingredients: row.ingredients.map((line) => ({
      ingredient_id: line.ingredient_id,
      free_text: line.free_text,
      amount_ml: line.amount_ml,
      amount_display: line.amount_display,
      unit_display: line.unit_display,
      is_optional: line.is_optional,
      is_garnish: line.is_garnish,
      note: line.note,
    })),
  };
}
