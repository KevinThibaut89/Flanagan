import OpenAI from 'npm:openai@^6.9.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { embedTexts } from '../_shared/embeddings.ts';
import { json } from '../_shared/http.ts';
import {
  LIBRARY_DISCOVER_MAX,
  LIBRARY_DISCOVER_MIN_SIMILARITY,
  type LibraryRow,
} from '../_shared/library.ts';

/**
 * Semantic search over the shared recipe library, for the Discover screen.
 *
 * This exists only because the embedding needs the OpenAI key, which lives
 * here and not in the app. The work is two calls: embed the words the person
 * typed, then `library_search` with their own user id so every row comes back
 * with whether they can make it tonight. Browsing without a query does not
 * come through here — the app calls `library_browse` directly.
 *
 * Each search costs an embedding of a few words: a fraction of a thousandth of
 * a cent, recorded in ai_usage under `embed_query` and metered by no plan. The
 * app debounces and requires a couple of characters; if that ever proves
 * insufficient, a plan_limits row for `embed_query` and a checkQuota call here
 * is all the plumbing needed.
 */

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return json({ error: 'The library search is not configured.' }, 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await asUser.auth.getUser();
  if (authError || !user) return json({ error: 'Not signed in.' }, 401);

  let query: string;
  let onlyMakeable = false;
  let limit = LIBRARY_DISCOVER_MAX;
  try {
    const body = await request.json();
    query = String(body?.query ?? '').trim();
    onlyMakeable = body?.only_makeable === true;
    if (Number.isFinite(Number(body?.limit))) {
      limit = Math.max(1, Math.min(LIBRARY_DISCOVER_MAX, Math.floor(Number(body.limit))));
    }
  } catch {
    return json({ error: 'Expected a JSON body with a query.' }, 400);
  }

  if (!query) return json({ error: 'Type a few words to search the library.' }, 400);
  if (query.length > 200) return json({ error: 'That search is too long.' }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  let embedding: number[] | undefined;
  try {
    [embedding] = await embedTexts(openai, admin, {
      userId: user.id,
      key: 'embed_query',
      texts: [query],
    });
  } catch (cause) {
    console.error('Query embedding failed', cause);
  }
  if (!embedding) {
    return json({ error: 'Could not reach the search service. Try again in a moment.' }, 502);
  }

  const { data, error } = await admin.rpc('library_search', {
    p_user_id: user.id,
    p_embedding: embedding,
    p_count: limit,
    p_min_similarity: LIBRARY_DISCOVER_MIN_SIMILARITY,
    p_only_makeable: onlyMakeable,
  });

  if (error) {
    console.error('library_search failed', error);
    return json({ error: error.message }, 500);
  }

  const recipes = (data ?? []) as LibraryRow[];
  console.log(`search-library: "${query.slice(0, 40)}" → ${recipes.length} rows`);

  return json({ recipes });
});
