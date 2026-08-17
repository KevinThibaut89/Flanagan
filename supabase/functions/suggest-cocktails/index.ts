import OpenAI from 'npm:openai@^6.9.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
  try {
    const body = await request.json();
    query = String(body?.query ?? '').trim();
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

  // ── Ask OpenAI ─────────────────────────────────────────────────────────────
  const openai = new OpenAI({ apiKey: openaiKey });

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
  const system = hasPlaceholder
    ? config.system_prompt.replaceAll('{{INVENTORY}}', inventoryBlock)
    : `${config.system_prompt}\n\n${inventoryBlock}`;

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

  if (refused || filtered) {
    return json({
      recipes: [],
      rejected: 0,
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
  const accepted: unknown[] = [];
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

    accepted.push(toDraft(recipe, bySlug, query, config.model));
  }

  return json({
    recipes: accepted,
    rejected,
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
) {
  return {
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
