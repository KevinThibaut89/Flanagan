import { useMutation } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';

export interface ClassifyBottleResponse {
  ingredient_id: string | null;
  slug: string | null;
}

/**
 * Asks the classify-bottle function what a typed bottle name counts as.
 *
 * Null is a normal answer, not a failure — the caller prefills the field on a
 * hit and does nothing on a miss. Errors are treated the same way by callers:
 * the guess is a convenience, so nothing about it should ever block the form.
 */
export function useClassifyBottle() {
  return useMutation({
    mutationFn: async (input: {
      name: string;
      brand?: string | null;
    }): Promise<ClassifyBottleResponse> => {
      const { data, error } = await supabase.functions.invoke<ClassifyBottleResponse>(
        'classify-bottle',
        { body: { name: input.name, brand: input.brand ?? '' } },
      );

      if (error) throw error;
      if (!data) throw new Error('The classification service returned nothing.');
      return data;
    },
  });
}
