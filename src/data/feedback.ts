import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth';
import { queryKeys } from './keys';

/**
 * Thumbs on the Barkeep's suggestions: one vote per person per library recipe,
 * written straight to `library_feedback` under RLS (the same trust model as
 * bottles and recipes). A thumb down means "never pour this again" — the
 * ranking RPCs hard-exclude it server-side; a thumb up nudges similar drinks
 * upward. Saving and favouriting count too, but those signals are derived from
 * the `recipes` table at ranking time and need no rows here.
 */

export type Vote = 1 | -1;

/** All of this person's votes, as recipe id → vote. Small by nature. */
export function useMyLibraryFeedback() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.libraryFeedback(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<Map<string, Vote>> => {
      const { data, error } = await supabase.from('library_feedback').select('recipe_id, vote');
      if (error) throw error;
      return new Map(data.map((row) => [row.recipe_id, row.vote as Vote]));
    },
  });
}

/**
 * Cast, change, or withdraw a vote (`vote: null` deletes the row — tapping the
 * active thumb clears it). Optimistic, like the unit toggle in
 * `providers/preferences.tsx`: the icon fills the instant it is tapped and a
 * failed write rolls back.
 */
export function useVoteLibraryRecipe() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = queryKeys.libraryFeedback(user?.id);

  return useMutation({
    mutationFn: async ({ recipeId, vote }: { recipeId: string; vote: Vote | null }) => {
      if (!user) throw new Error('Not signed in.');

      if (vote === null) {
        const { error } = await supabase
          .from('library_feedback')
          .delete()
          .match({ user_id: user.id, recipe_id: recipeId });
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('library_feedback').upsert(
        { user_id: user.id, recipe_id: recipeId, vote, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,recipe_id' },
      );
      if (error) throw error;
    },
    onMutate: async ({ recipeId, vote }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Map<string, Vote>>(key);
      queryClient.setQueryData<Map<string, Vote>>(key, (old) => {
        const next = new Map(old ?? []);
        if (vote === null) next.delete(recipeId);
        else next.set(recipeId, vote);
        return next;
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
