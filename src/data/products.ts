import { supabase } from '../lib/supabase';

export interface BarcodeLookupResult {
  found: boolean;
  source: 'catalog' | 'off' | null;
  product: {
    id: string | null;
    barcode: string;
    name: string;
    brand: string | null;
    ingredient_id: string | null;
    abv: number | null;
    volume_ml: number | null;
    country: string | null;
    image_url: string | null;
  } | null;
}

/**
 * Resolves a barcode via the `lookup-barcode` edge function, which checks the
 * shared catalogue first and falls back to Open Food Facts.
 *
 * A miss is not an error — it returns `found: false` and the caller sends the
 * user to the manual form. Only a genuine failure (no network, function down)
 * throws.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const { data, error } = await supabase.functions.invoke<BarcodeLookupResult>('lookup-barcode', {
    body: { barcode },
  });

  if (error) throw error;
  if (!data) throw new Error('The barcode lookup returned nothing.');

  return data;
}
