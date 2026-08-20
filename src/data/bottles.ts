import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth';
import type { Bottle, BottleInsert, BottleStatus, BottleUpdate } from '../types/database';
import { useIngredientIndex } from './ingredients';
import { queryKeys } from './keys';

export function useBottles() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.bottles(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Bottle[]> => {
      const { data, error } = await supabase
        .from('bottles')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useBottle(id: string) {
  return useQuery({
    queryKey: queryKeys.bottle(id),
    queryFn: async (): Promise<Bottle> => {
      const { data, error } = await supabase.from('bottles').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * The set of ingredient ids the user can currently satisfy — every in-stock
 * item plus everything it stands in for. Owning `london-dry-gin` puts both it
 * and `gin` in the set.
 *
 * Computed on the client from two already-cached queries so the recipe list can
 * filter without a round trip. `can_make()` in Postgres applies the same rule
 * for server-side callers.
 */
export function useAvailableIngredientIds(): Set<string> {
  const { data: bottles } = useBottles();
  const { index } = useIngredientIndex();

  return useMemo(() => {
    const available = new Set<string>();
    if (!bottles || !index) return available;

    for (const bottle of bottles) {
      if (bottle.status !== 'in_stock' || !bottle.ingredient_id) continue;
      for (const id of index.coveredBy(bottle.ingredient_id)) available.add(id);
    }
    return available;
  }, [bottles, index]);
}

function useInvalidateInventory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.bottles(user?.id) });
    // Availability changes ripple into which recipes are makeable — in the
    // notebook and in the shared library.
    void queryClient.invalidateQueries({ queryKey: queryKeys.makeableRecipeIds(user?.id) });
    void queryClient.invalidateQueries({ queryKey: ['library'] });
  };
}

export function useAddBottle() {
  const { user } = useAuth();
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: async (input: Omit<BottleInsert, 'user_id'>): Promise<Bottle> => {
      if (!user) throw new Error('Not signed in.');
      const { data, error } = await supabase
        .from('bottles')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

/**
 * Adds several bottles in one insert — the shelf-photo review screen commits
 * its ticked rows through here. One round trip and one invalidation, and the
 * whole batch lands or none of it does.
 */
export function useAddBottles() {
  const { user } = useAuth();
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: async (inputs: Array<Omit<BottleInsert, 'user_id'>>): Promise<Bottle[]> => {
      if (!user) throw new Error('Not signed in.');
      if (inputs.length === 0) return [];
      const { data, error } = await supabase
        .from('bottles')
        .insert(inputs.map((input) => ({ ...input, user_id: user.id })))
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateBottle() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: async ({ id, ...patch }: BottleUpdate & { id: string }): Promise<Bottle> => {
      const { data, error } = await supabase
        .from('bottles')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (bottle) => {
      queryClient.setQueryData(queryKeys.bottle(bottle.id), bottle);
      invalidate();
    },
  });
}

export function useDeleteBottle() {
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bottles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/**
 * Toggling a staple on the Staples screen: create an in-stock row if it is
 * missing, otherwise flip the existing row's status. Rows are kept rather than
 * deleted so a bottle's notes and price survive being marked finished.
 */
export function useToggleStaple() {
  const { user } = useAuth();
  const { data: bottles } = useBottles();
  const invalidate = useInvalidateInventory();

  return useMutation({
    mutationFn: async ({
      ingredientId,
      name,
      inStock,
    }: {
      ingredientId: string;
      name: string;
      inStock: boolean;
    }) => {
      if (!user) throw new Error('Not signed in.');

      const existing = bottles?.find(
        (bottle) => bottle.kind === 'staple' && bottle.ingredient_id === ingredientId,
      );
      const status: BottleStatus = inStock ? 'in_stock' : 'finished';

      if (existing) {
        const { error } = await supabase.from('bottles').update({ status }).eq('id', existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('bottles').insert({
        user_id: user.id,
        ingredient_id: ingredientId,
        name,
        kind: 'staple',
        status,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
