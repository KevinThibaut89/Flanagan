import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { normalize } from '../lib/text';
import type { Ingredient } from '../types/database';
import { queryKeys } from './keys';

/**
 * The whole vocabulary is a few hundred small rows, so it is fetched once
 * and kept for the session. Autocomplete, category pills, and makeability
 * checks all read from this one cache entry rather than hitting the network.
 */
export function useIngredients() {
  return useQuery({
    queryKey: queryKeys.ingredients(),
    staleTime: Infinity,
    queryFn: async (): Promise<Ingredient[]> => {
      const { data, error } = await supabase
        .from('ingredients')
        .select('*')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export interface IngredientIndex {
  byId: Map<string, Ingredient>;
  bySlug: Map<string, Ingredient>;
  /** Every ancestor of an ingredient, nearest first. Excludes the ingredient itself. */
  ancestorsOf: (id: string) => Ingredient[];
  /** Ingredient ids satisfied by owning `id` — itself plus all its ancestors. */
  coveredBy: (id: string) => string[];
  search: (term: string, limit?: number) => Ingredient[];
}

/** One row's searchable text, folded once when the index is built. */
interface SearchRow {
  row: Ingredient;
  name: string;
  /** The slug with hyphens as spaces, so it reads like the name. */
  slug: string;
  aliases: string[];
}

export function useIngredientIndex(): { index: IngredientIndex | null; isLoading: boolean } {
  const { data, isLoading } = useIngredients();

  const index = useMemo<IngredientIndex | null>(() => {
    if (!data) return null;
    const rows = data;

    const byId = new Map(rows.map((row) => [row.id, row]));
    const bySlug = new Map(rows.map((row) => [row.slug, row]));

    function ancestorsOf(id: string): Ingredient[] {
      const chain: Ingredient[] = [];
      const seen = new Set<string>([id]);
      let current = byId.get(id)?.parent_id ?? null;
      // The guard is for safety only — the seed data has no cycles, but a
      // hand-edited row could introduce one and an infinite loop here would
      // freeze the list screen.
      while (current && !seen.has(current)) {
        seen.add(current);
        const parent = byId.get(current);
        if (!parent) break;
        chain.push(parent);
        current = parent.parent_id;
      }
      return chain;
    }

    function coveredBy(id: string): string[] {
      return [id, ...ancestorsOf(id).map((row) => row.id)];
    }

    // Folded once per fetch rather than once per keystroke. With four hundred
    // rows carrying a thousand aliases between them, re-lowercasing the whole
    // vocabulary on every character typed was showing up as lag.
    const searchRows: SearchRow[] = rows.map((row) => ({
      row,
      name: normalize(row.name),
      // Hyphens become spaces so "poire williams" reaches poire-williams.
      slug: normalize(row.slug).replace(/-/g, ' '),
      aliases: row.aliases.map(normalize),
    }));

    function search(term: string, limit = 12): Ingredient[] {
      // normalize also lowercases and trims, and strips diacritics on top —
      // "palinka" has to find "Pálinka" without anyone hand-writing an alias
      // for every accented name in the vocabulary.
      const needle = normalize(term);
      if (!needle) return [];

      const scored = searchRows
        .map((entry) => {
          const { name, slug, aliases } = entry;
          // An exact slug hit is as unambiguous as an exact name hit; a slug
          // *substring* is the weakest signal here, since the slug is derived
          // from the name, so it sits below everything else.
          if (name === needle || slug === needle) return { row: entry.row, score: 0 };
          if (name.startsWith(needle)) return { row: entry.row, score: 1 };
          if (aliases.some((alias) => alias === needle)) return { row: entry.row, score: 2 };
          if (aliases.some((alias) => alias.startsWith(needle))) return { row: entry.row, score: 3 };
          if (name.includes(needle)) return { row: entry.row, score: 4 };
          if (aliases.some((alias) => alias.includes(needle))) return { row: entry.row, score: 5 };
          if (slug.includes(needle)) return { row: entry.row, score: 6 };
          return null;
        })
        .filter((entry): entry is { row: Ingredient; score: number } => entry !== null)
        .sort((a, b) => a.score - b.score || a.row.sort_order - b.row.sort_order);

      return scored.slice(0, limit).map((entry) => entry.row);
    }

    return { byId, bySlug, ancestorsOf, coveredBy, search };
  }, [data]);

  return { index, isLoading };
}

/** The items offered on the one-tap Staples screen. */
export function useStapleIngredients() {
  const { data, ...rest } = useIngredients();
  const staples = useMemo(() => (data ?? []).filter((row) => row.is_staple), [data]);
  return { staples, ...rest };
}
