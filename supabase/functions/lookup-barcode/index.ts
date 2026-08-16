import { createClient } from 'npm:@supabase/supabase-js@2';

import { fetchFromOpenFoodFacts } from './off.ts';

/**
 * Resolves a scanned barcode to a bottle.
 *
 * Runs server-side for three reasons: Open Food Facts requires an identifying
 * User-Agent, the result is cached into the shared `products` catalogue so the
 * next person to scan that bottle gets an instant hit, and writing to that
 * catalogue on someone's behalf needs more than their own row-level grants.
 *
 * Never fails the request on a lookup miss — a miss is a normal outcome that
 * sends the user to the manual form with the barcode pre-filled.
 */

interface LookupResponse {
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify the caller with their own token before doing anything else. The
  // service-role client below bypasses RLS, so it must never be reachable by an
  // unauthenticated request.
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await asUser.auth.getUser();

  if (authError || !user) {
    return json({ error: 'Not signed in.' }, 401);
  }

  let barcode: string;
  try {
    const body = await request.json();
    barcode = String(body?.barcode ?? '').trim();
  } catch {
    return json({ error: 'Expected a JSON body with a barcode.' }, 400);
  }

  // EAN-8 through EAN-13/UPC, digits only. Rejecting early avoids sending
  // junk to OFF and keeps it out of the catalogue.
  if (!/^\d{8,14}$/.test(barcode)) {
    return json({ error: 'That is not a product barcode.' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // 1. The shared catalogue — a hit here costs nothing and is already curated.
  const { data: cached, error: cacheError } = await admin
    .from('products')
    .select('id, barcode, name, brand, ingredient_id, abv, volume_ml, country, image_url')
    .eq('barcode', barcode)
    .maybeSingle();

  if (cacheError) {
    return json({ error: cacheError.message }, 500);
  }

  if (cached) {
    return json({ found: true, source: 'catalog', product: cached } satisfies LookupResponse);
  }

  // 2. Open Food Facts.
  let off;
  try {
    off = await fetchFromOpenFoodFacts(barcode);
  } catch (cause) {
    // The network failing is not the user's problem to solve — report the miss
    // and let them fill the form in by hand.
    console.error('Open Food Facts lookup failed', cause);
    return json({ found: false, source: null, product: null } satisfies LookupResponse);
  }

  if (!off) {
    return json({ found: false, source: null, product: null } satisfies LookupResponse);
  }

  // Resolve the category tag to a canonical ingredient id.
  let ingredientId: string | null = null;
  if (off.ingredientSlug) {
    const { data: ingredient } = await admin
      .from('ingredients')
      .select('id')
      .eq('slug', off.ingredientSlug)
      .maybeSingle();
    ingredientId = ingredient?.id ?? null;
  }

  // 3. Cache it for everyone. `created_by` stays null: this row came from OFF,
  // not from a person, and null is what keeps it out of the "contributors can
  // correct their own products" policy.
  const { data: inserted, error: insertError } = await admin
    .from('products')
    .upsert(
      {
        barcode,
        name: off.name,
        brand: off.brand,
        ingredient_id: ingredientId,
        abv: off.abv,
        volume_ml: off.volumeMl,
        country: off.country,
        image_url: off.imageUrl,
        source: 'off',
      },
      { onConflict: 'barcode' },
    )
    .select('id, barcode, name, brand, ingredient_id, abv, volume_ml, country, image_url')
    .single();

  if (insertError) {
    // Caching is an optimisation. If it fails, the user still gets their bottle.
    console.error('Failed to cache product', insertError);
    return json({
      found: true,
      source: 'off',
      product: {
        id: null,
        barcode,
        name: off.name,
        brand: off.brand,
        ingredient_id: ingredientId,
        abv: off.abv,
        volume_ml: off.volumeMl,
        country: off.country,
        image_url: off.imageUrl,
      },
    } satisfies LookupResponse);
  }

  return json({ found: true, source: 'off', product: inserted } satisfies LookupResponse);
});
