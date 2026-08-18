import { useMutation } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';

export type IdentifyConfidence = 'high' | 'medium' | 'low';

/** One bottle the model read off the photo, slug already validated server-side. */
export interface IdentifiedBottle {
  name: string;
  brand: string | null;
  ingredient_id: string | null;
  slug: string | null;
  abv: number | null;
  volume_ml: number | null;
  confidence: IdentifyConfidence;
}

export interface IdentifyResponse {
  bottles: IdentifiedBottle[];
  /** Set when the list is empty: what to tell the user instead of a blank screen. */
  message: string | null;
}

export type ShelfMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

/**
 * Asks the identify-bottles function what is on a photographed shelf.
 *
 * Like classify-bottle, the answer is a prefill — here for a review list the
 * user ticks through — so an empty list is a normal result, and callers show
 * the returned `message` rather than treating it as a failure.
 */
export function useIdentifyBottles() {
  return useMutation({
    mutationFn: async (input: {
      base64: string;
      mimeType: ShelfMimeType;
    }): Promise<IdentifyResponse> => {
      const { data, error } = await supabase.functions.invoke<IdentifyResponse>(
        'identify-bottles',
        { body: { image: input.base64, mimeType: input.mimeType } },
      );

      if (error) throw error;
      if (!data) throw new Error('The recognition service returned nothing.');
      return data;
    },
  });
}
