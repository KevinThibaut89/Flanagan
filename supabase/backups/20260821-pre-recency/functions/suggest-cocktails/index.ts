import OpenAI from 'npm:openai@^6.9.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { EMBED_MODEL, embedTexts } from '../_shared/embeddings.ts';
import { json } from '../_shared/http.ts';
import {
  LIBRARY_ANSWER_EXACT_ASK_SIMILARITY,
  LIBRARY_ANSWER_MAX,
  LIBRARY_ANSWER_MIN_ASK_SIMILARITY,
  LIBRARY_ANSWER_MIN_HITS,
  LIBRARY_RAG_MIN_SIMILARITY,
  LIBRARY_RAG_TOP_K,
  LIBRARY_SEARCH_COUNT,
  formatLibraryBlock,
  formatTasteBlock,
  libraryRowToDraft,
  type LibraryRow,
  type TasteProfile,
} from '../_shared/library.ts';
import { checkQuota, recordUsage } from '../_shared/quota.ts';
import { embedTextFor, requiredSlugs, toLibraryRow } from './library.ts';
import { SUGGESTION_SCHEMA, type SuggestedRecipe } from './schema.ts';
import { toMl } from './units.ts';

/**
 * Turns "a gin-based dry cocktail with floral notes" into recipes the drinker
 * can actually make tonight.
 *
 * The shape of this function is dictated by one rule: only suggest what they
 * own. That means the inventory is read server-side from their own rows (not
 * sent by the client, which could lie or drift), the model is given an explicit
 * list of available ingredient slugs, and — because a model asked for
 * constraints will still occasionally reach past them — the response is
 * re-checked against that list before it is returned. A confidently suggested
 * drink you cannot make is worse than one fewer suggestion.
 *
 * The prompt and model are not in this file. They live in `public.ai_prompts`,
 * so the bartender can be re-tuned with an UPDATE and no redeploy. What stays
 * here is everything that has to be code: gathering the inventory, and refusing
 * to return a drink that cannot be poured.
 *
 * The house book. Every recipe the model produces is kept in the shared
 * library (20260819120000_recipe_library.sql), embedded, and used twice on the
 * way in: the ask is embedded and the library searched first, and if enough
 * close recipes are makeable with this bar they are returned without calling
 * the model or spending an ask; otherwise the closest ones are handed to the
 * model as reference ({{LIBRARY}}). One rule governs all of it: the library
 * must never fail an answer. Every library step is wrapped, and a failure
 * degrades to exactly the behaviour this function had before it existed.
 */

/** Which `ai_prompts` row configures this function. */
const PROMPT_KEY = 'suggest_cocktails';

interface PromptConfig {
  system_prompt: string;
  model: string;
  max_output_tokens: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high' | null;
  version: number;
}

interface AvailableIngredient {
  slug: string;
  name: string;
  kind: string;
  /** What the drinker's own bottle is called, when they own this directly. */
  label: string | null;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return json({ error: 'The suggestion service is not configured.' }, 500);
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
  // "Ask the Barkeep anyway": skip the answer-from-library shortcut. The
  // library is still searched (for grounding) and still written to.
  let forceAi = false;
  try {
    const body = await request.json();
    query = String(body?.query ?? '').trim();
    forceAi = body?.force_ai === true;
  } catch {
    return json({ error: 'Expected a JSON body with a query.' }, 400);
  }

  if (!query) return json({ error: 'Tell me what you feel like drinking.' }, 400);
  if (query.length > 500) return json({ error: 'That request is too long.' }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  // ── What's on the shelf ────────────────────────────────────────────────────
  // Read from their own rows rather than trusting a client-supplied list: the
  // whole promise of this feature is that the answer reflects reality.
  const { data: bottles, error: bottlesError } = await admin
    .from('bottles')
    .select('name, ingredient_id')
    .eq('user_id', user.id)
    .eq('status', 'in_stock')
    .not('ingredient_id', 'is', null);

  if (bottlesError) return json({ error: bottlesError.message }, 500);

  const { data: allIngredients, error: ingredientsError } = await admin
    .from('ingredients')
    .select('id, slug, name, kind, parent_id');

  if (ingredientsError) return json({ error: ingredientsError.message }, 500);

  const byId = new Map(allIngredients.map((row) => [row.id, row]));
  const bySlug = new Map(allIngredients.map((row) => [row.slug, row]));

  /** Owning a specific gin also satisfies a recipe asking for gin. */
  function withAncestors(id: string): string[] {
    const chain = [id];
    const seen = new Set([id]);
    let parent = byId.get(id)?.parent_id ?? null;
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      chain.push(parent);
      parent = byId.get(parent)?.parent_id ?? null;
    }
    return chain;
  }

  const ownedLabels = new Map<string, string>();
  const availableIds = new Set<string>();
  for (const bottle of bottles ?? []) {
    if (!bottle.ingredient_id) continue;
    if (!ownedLabels.has(bottle.ingredient_id)) ownedLabels.set(bottle.ingredient_id, bottle.name);
    for (const id of withAncestors(bottle.ingredient_id)) availableIds.add(id);
  }

  if (availableIds.size === 0) {
    return json({
      recipes: [],
      rejected: 0,
      from_library: false,
      message:
        'There is nothing in your bar yet. Scan a few bottles — and tick off your staples — and ask again.',
    });
  }

  const available: AvailableIngredient[] = [...availableIds]
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      kind: row.kind,
      label: ownedLabels.get(row.id) ?? null,
    }));

  const availableSlugs = new Set(available.map((row) => row.slug));

  // ── The configured prompt ──────────────────────────────────────────────────
  // Read after the empty-bar return above, so a drinker with nothing in stock
  // doesn't pay for a query whose answer is thrown away.
  const { data: config, error: configError } = await admin
    .from('ai_prompts')
    .select('system_prompt, model, max_output_tokens, reasoning_effort, version')
    .eq('key', PROMPT_KEY)
    .eq('is_active', true)
    .maybeSingle<PromptConfig>();

  if (configError || !config) {
    console.error(`No active ai_prompts row for "${PROMPT_KEY}"`, configError);
    return json({ error: 'The suggestion service is not configured.' }, 500);
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // ── The house book ─────────────────────────────────────────────────────────
  // Embed the ask once and use it twice: against previous *asks* (answer-first
  // — a near-paraphrase of a past ask whose recipes this bar can make means the
  // model is not needed) and against *recipes* (grounding for the model). Any
  // failure here is logged and leaves the lists empty: the rest of the
  // function then behaves exactly as it did before the library existed.
  let queryEmbedding: number[] | null = null;
  let hits: LibraryRow[] = [];
  let answers: LibraryRow[] = [];
  // Their taste, for the prompt. The ranking side of taste (downvotes
  // excluded, likes nudged up) lives inside the two RPCs themselves.
  let taste: TasteProfile | null = null;
  try {
    [queryEmbedding] = await embedTexts(openai, admin, {
      userId: user.id,
      key: 'embed_query',
      texts: [query],
    });

    const [answered, searched, tasted] = await Promise.all([
      forceAi
        ? Promise.resolve({ data: [], error: null })
        : admin.rpc('library_answer', {
            p_user_id: user.id,
            p_embedding: queryEmbedding,
            p_count: LIBRARY_ANSWER_MAX,
            p_min_similarity: LIBRARY_ANSWER_MIN_ASK_SIMILARITY,
          }),
      admin.rpc('library_search', {
        p_user_id: user.id,
        p_embedding: queryEmbedding,
        p_count: LIBRARY_SEARCH_COUNT,
        p_min_similarity: LIBRARY_RAG_MIN_SIMILARITY,
        p_only_makeable: false,
      }),
      admin.rpc('library_taste_profile', { p_user_id: user.id }),
    ]);
    if (answered.error) throw answered.error;
    if (searched.error) throw searched.error;
    answers = (answered.data ?? []) as LibraryRow[];
    hits = (searched.data ?? []) as LibraryRow[];
    // A failed profile must not take the library lists down with it.
    if (tasted.error) console.warn('Taste profile failed; prompting without it', tasted.error);
    else taste = (tasted.data ?? null) as TasteProfile | null;

    const show = (rows: LibraryRow[]) =>
      rows
        .slice(0, 5)
        .map((h) => `${h.similarity?.toFixed(2)}${h.makeable ? '✓' : '✗'}`)
        .join(' ');
    console.log(
      `suggest-cocktails: library asks=${answers.length} [${show(answers)}] recipes=${hits.length} [${show(hits)}]`,
    );
  } catch (cause) {
    console.warn('Library lookup failed; continuing without it', cause);
    hits = [];
    answers = [];
  }

  // Answer first from the library: enough recipes from close-enough past asks
  // that this person can pour tonight, or one from an ask that was essentially
  // the same words. No tokens, no ask spent.
  const exact = answers.filter((row) => (row.similarity ?? 0) >= LIBRARY_ANSWER_EXACT_ASK_SIMILARITY);
  if (answers.length >= LIBRARY_ANSWER_MIN_HITS || exact.length >= 1) {
    const chosen = answers.length >= LIBRARY_ANSWER_MIN_HITS ? answers : exact;
    console.log(`suggest-cocktails: answered from library (${chosen.length} recipes)`);
    return json({
      recipes: chosen.map((row) => libraryRowToDraft(row, query)),
      rejected: 0,
      from_library: true,
      message: null,
    });
  }

  // ── Is there an ask left this month? ───────────────────────────────────────
  // Checked here, after the empty-bar return, the config read and the library
  // shortcut, so that nothing that never reaches OpenAI is charged to the
  // person's allowance.
  const exhausted = await checkQuota(admin, user.id, PROMPT_KEY);
  if (exhausted) return exhausted;

  // ── Ask OpenAI ─────────────────────────────────────────────────────────────
  const owned = available.filter((row) => row.label);
  const generic = available.filter((row) => !row.label);

  const inventoryBlock = [
    'BOTTLES AND INGREDIENTS THEY HAVE:',
    ...owned.map((row) => `- ${row.slug} — their "${row.label}" (${row.name}, ${row.kind})`),
    '',
    'ALSO AVAILABLE, because the above stand in for them:',
    ...generic.map((row) => `- ${row.slug} (${row.name})`),
  ].join('\n');

  // A hand-edited prompt that lost its placeholder must not silently become a
  // prompt with no inventory — the model would then have nothing to work from
  // and every suggestion would fail the availability check below. Appending is
  // the safe reading of the intent.
  const hasPlaceholder = config.system_prompt.includes('{{INVENTORY}}');
  if (!hasPlaceholder) {
    console.warn(
      `ai_prompts "${PROMPT_KEY}" v${config.version} has no {{INVENTORY}} placeholder; appending the list.`,
    );
  }
  let system = hasPlaceholder
    ? config.system_prompt.replaceAll('{{INVENTORY}}', inventoryBlock)
    : `${config.system_prompt}\n\n${inventoryBlock}`;

  // The library block is optional grounding, not load-bearing: a prompt
  // without the placeholder simply works without the house book.
  const libraryBlock = formatLibraryBlock(
    hits.slice(0, LIBRARY_RAG_TOP_K),
    (id) => byId.get(id)?.slug ?? null,
  );
  if (system.includes('{{LIBRARY}}')) {
    system = system.replaceAll('{{LIBRARY}}', libraryBlock);
  } else {
    console.log(`ai_prompts "${PROMPT_KEY}" v${config.version} has no {{LIBRARY}} placeholder; not grounding.`);
  }

  // Their taste is the same kind of optional grounding as the house book: a
  // prompt without the placeholder simply works without it.
  if (system.includes('{{TASTE}}')) {
    system = system.replaceAll('{{TASTE}}', formatTasteBlock(taste));
  } else {
    console.log(`ai_prompts "${PROMPT_KEY}" v${config.version} has no {{TASTE}} placeholder; not personalising.`);
  }

  let response;
  try {
    response = await openai.responses.create({
      model: config.model,
      max_output_tokens: config.max_output_tokens,
      instructions: system,
      input: query,
      // Reasoning models only; null in the config means omit it, because passing
      // it to a model that has no reasoning is an error rather than a no-op.
      ...(config.reasoning_effort ? { reasoning: { effort: config.reasoning_effort } } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'cocktail_suggestions',
          strict: true,
          schema: SUGGESTION_SCHEMA,
        },
      },
    });
  } catch (cause) {
    console.error('OpenAI request failed', cause);
    return json({ error: 'Could not reach the suggestion service. Try again in a moment.' }, 502);
  }

  const usage = response.usage;
  console.log(
    `suggest-cocktails: in=${usage?.input_tokens} out=${usage?.output_tokens} ` +
      `model=${response.model} prompt=v${config.version}`,
  );

  // Always establish how generation ended before reading content: a decline or a
  // truncation both come back as HTTP 200 with an empty or partial body.
  const refused = response.output.some(
    (item) =>
      item.type === 'message' &&
      item.content.some((part: { type: string }) => part.type === 'refusal'),
  );
  const filtered = response.incomplete_details?.reason === 'content_filter';

  // Whatever happens next, the tokens were spent: record them, and count the
  // call against this month's allowance.
  await recordUsage(admin, {
    userId: user.id,
    key: PROMPT_KEY,
    // The model as configured, not `response.model`: OpenAI may answer with a
    // dated snapshot name, and it is the configured name that ai_models prices.
    model: config.model,
    promptVersion: config.version,
    usage,
    status: refused || filtered ? 'refused' : response.status === 'incomplete' ? 'incomplete' : 'ok',
  });

  if (refused || filtered) {
    return json({
      recipes: [],
      rejected: 0,
      from_library: false,
      message: 'That request was declined. Try describing the drink differently.',
    });
  }

  if (response.status === 'incomplete') {
    // Almost always max_output_tokens. Raising it is a config change, so say
    // which reason it was rather than making someone guess from the symptom.
    console.error(`Response incomplete: ${response.incomplete_details?.reason ?? 'unknown'}`);
    return json({ error: 'The suggestion service returned nothing usable.' }, 502);
  }

  const text = response.output_text;
  if (!text) {
    return json({ error: 'The suggestion service returned nothing usable.' }, 502);
  }

  let parsed: { recipes: SuggestedRecipe[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    // Structured outputs make this near-impossible, but a malformed body should
    // not surface as a crash.
    console.error('Unparseable model output', text.slice(0, 500));
    return json({ error: 'The suggestion service returned an unreadable answer.' }, 502);
  }

  // ── Verify against the shelf ───────────────────────────────────────────────
  // Kept raw here: the drafts are built last, after the house-book write has
  // handed each recipe its library id.
  let accepted: SuggestedRecipe[] = [];
  let rejected = 0;

  for (const recipe of parsed.recipes ?? []) {
    const unavailable = recipe.ingredients.filter(
      (line) => !line.is_garnish && !line.is_optional && !availableSlugs.has(line.ingredient),
    );

    if (unavailable.length > 0) {
      console.warn(
        `Dropped "${recipe.title}": needs ${unavailable.map((l) => l.ingredient).join(', ')}`,
      );
      rejected += 1;
      continue;
    }

    accepted.push(recipe);
  }

  // ── Into the house book ────────────────────────────────────────────────────
  // Keep everything the model wrote whose required lines are real vocabulary —
  // including drinks rejected for *this* bar, which are perfectly good for
  // someone else's. A required line with an unknown slug is a hallucination
  // and that recipe is dropped. Awaited so the rows exist before the next ask,
  // but nothing in here may fail the answer.
  //
  // The upsert also names each recipe: library_upsert returns one row per
  // input in input order, and that id is what a thumb on the ask screen
  // attaches to. If the write fails, the ids stay unset and the client simply
  // shows no thumbs — the answer itself is untouched.
  const libraryIdOf = new Map<SuggestedRecipe, string>();
  try {
    const keepable = (parsed.recipes ?? []).filter((recipe) =>
      requiredSlugs(recipe).every((slug) => bySlug.has(slug)),
    );
    if (keepable.length > 0) {
      const docs = keepable.map((recipe) => embedTextFor(recipe, bySlug));
      let embeddings: (number[] | null)[] = keepable.map(() => null);
      try {
        embeddings = await embedTexts(openai, admin, {
          userId: user.id,
          key: 'embed_recipe',
          texts: docs,
        });
      } catch (cause) {
        console.warn('Recipe embedding failed; storing without vectors', cause);
      }
      const { data: upserted, error: upsertError } = await admin.rpc('library_upsert', {
        p_user_id: user.id,
        p_query: query,
        p_model: config.model,
        p_prompt_version: config.version,
        p_recipes: keepable.map((recipe, i) =>
          toLibraryRow(recipe, bySlug, docs[i], embeddings[i] ?? null, EMBED_MODEL),
        ),
        // The ask's own embedding, so the next similar ask can be answered
        // from these rows without the model.
        p_query_embedding: queryEmbedding,
      });
      if (upsertError) throw upsertError;
      const rows = (upserted ?? []) as { id: string; inserted: boolean }[];
      if (rows.length === keepable.length) {
        keepable.forEach((recipe, i) => libraryIdOf.set(recipe, rows[i].id));
      } else {
        console.warn(
          `library_upsert returned ${rows.length} rows for ${keepable.length} recipes; not attaching ids`,
        );
      }
      const fresh = rows.filter((r) => r.inserted).length;
      console.log(`suggest-cocktails: library +${fresh} new, ${keepable.length - fresh} repeats`);
    }
  } catch (cause) {
    console.warn('Library write failed; answer unaffected', cause);
  }

  // The model can re-invent a drink this person already voted down — the
  // fingerprint dedupe maps it straight back to the voted row. Drop those
  // quietly (they are not "rejected": the bar could pour them; the person said
  // no). A failed read degrades to no filtering, never to no answer.
  try {
    const ids = [...libraryIdOf.values()];
    if (ids.length > 0) {
      const { data: downvotes, error: downvotesError } = await admin
        .from('library_feedback')
        .select('recipe_id')
        .eq('user_id', user.id)
        .eq('vote', -1)
        .in('recipe_id', ids);
      if (downvotesError) throw downvotesError;
      const banned = new Set((downvotes ?? []).map((row) => row.recipe_id));
      if (banned.size > 0) {
        accepted = accepted.filter((recipe) => {
          const id = libraryIdOf.get(recipe);
          if (id && banned.has(id)) {
            console.log(`Dropped "${recipe.title}": this person voted it down before`);
            return false;
          }
          return true;
        });
      }
    }
  } catch (cause) {
    console.warn('Downvote check failed; answer unaffected', cause);
  }

  return json({
    recipes: accepted.map((recipe) =>
      toDraft(recipe, bySlug, query, config.model, libraryIdOf.get(recipe) ?? null),
    ),
    rejected,
    from_library: false,
    message:
      accepted.length === 0
        ? 'Nothing came back that you can make with what’s in stock right now. Try a looser description, or check your staples.'
        : null,
  });
});

/**
 * Converts a validated suggestion into the same draft shape the recipe editor
 * produces, so the client saves an AI recipe and a hand-written one through one
 * code path.
 */
function toDraft(
  recipe: SuggestedRecipe,
  bySlug: Map<string, { id: string; slug: string }>,
  prompt: string,
  model: string,
  libraryRecipeId: string | null,
) {
  return {
    // Null when the house-book write failed; the client then shows no thumbs.
    library_recipe_id: libraryRecipeId,
    title: recipe.title,
    rationale: recipe.rationale,
    source: 'ai' as const,
    glass: recipe.glass || null,
    method: recipe.method,
    ice: recipe.ice,
    garnish: recipe.garnish || null,
    instructions: recipe.instructions,
    notes: null,
    flavor_tags: recipe.flavor_tags,
    base_ingredient_id: bySlug.get(recipe.base_ingredient)?.id ?? null,
    abv_estimate: Number.isFinite(recipe.abv_estimate) ? recipe.abv_estimate : null,
    servings: recipe.servings > 0 ? recipe.servings : 1,
    ai_prompt: prompt,
    ai_model: model,
    ingredients: recipe.ingredients.map((line) => {
      const ingredient = bySlug.get(line.ingredient);
      return {
        ingredient_id: ingredient?.id ?? null,
        // An unrecognised slug can only happen on a garnish or optional line —
        // required lines were checked above — so keeping the text is honest.
        free_text: ingredient ? null : line.ingredient,
        amount_ml: line.amount > 0 ? toMl(line.amount, line.unit) : null,
        amount_display: line.amount > 0 ? line.amount : null,
        unit_display: line.unit,
        is_optional: line.is_optional,
        is_garnish: line.is_garnish,
        note: line.note || null,
      };
    }),
  };
}
