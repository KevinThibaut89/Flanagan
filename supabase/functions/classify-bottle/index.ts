import OpenAI from 'npm:openai@^6.9.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { json } from '../_shared/http.ts';
import { checkQuota, recordUsage } from '../_shared/quota.ts';

/**
 * Guesses which canonical ingredient a hand-typed bottle counts as.
 *
 * The barcode path gets this for free from Open Food Facts category tags, but a
 * bottle typed into the form has only a name and maybe a brand — "Tanqueray
 * No. Ten" says gin to a person and nothing to a string match against the
 * vocabulary. There is no public API that maps arbitrary label text to a spirit
 * category, so the model does it, constrained to our own ingredient slugs.
 *
 * The answer is a prefill for a form the user confirms, never the truth: the
 * model may only pick a slug from the vocabulary it is shown, an unrecognised
 * or absent pick comes back as null, and null is a perfectly good response —
 * a wrong match is worse than no match.
 */

/** Which `ai_prompts` row configures this function. */
const PROMPT_KEY = 'classify_bottle';

interface PromptConfig {
  system_prompt: string;
  model: string;
  max_output_tokens: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high' | null;
  version: number;
}

interface ClassifyResponse {
  ingredient_id: string | null;
  slug: string | null;
}

/** The model must answer with a slug from the list, or null when unsure. */
const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    slug: {
      type: ['string', 'null'],
      description:
        'The single best-matching ingredient slug from the provided vocabulary, or null when no entry clearly fits.',
    },
  },
  required: ['slug'],
  additionalProperties: false,
} as const;

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return json({ error: 'The classification service is not configured.' }, 500);
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

  let name: string;
  let brand: string;
  try {
    const body = await request.json();
    name = String(body?.name ?? '').trim();
    brand = String(body?.brand ?? '').trim();
  } catch {
    return json({ error: 'Expected a JSON body with a name.' }, 400);
  }

  if (!name) return json({ error: 'A bottle name is required.' }, 400);
  if (name.length > 200 || brand.length > 200) {
    return json({ error: 'That does not look like a bottle label.' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: ingredients, error: ingredientsError } = await admin
    .from('ingredients')
    .select('id, slug, name, kind, aliases')
    .order('sort_order');

  if (ingredientsError) return json({ error: ingredientsError.message }, 500);

  const bySlug = new Map(ingredients.map((row) => [row.slug, row]));

  const { data: config, error: configError } = await admin
    .from('ai_prompts')
    .select('system_prompt, model, max_output_tokens, reasoning_effort, version')
    .eq('key', PROMPT_KEY)
    .eq('is_active', true)
    .maybeSingle<PromptConfig>();

  if (configError || !config) {
    console.error(`No active ai_prompts row for "${PROMPT_KEY}"`, configError);
    return json({ error: 'The classification service is not configured.' }, 500);
  }

  const vocabularyBlock = [
    'INGREDIENT VOCABULARY (slug — name, kind):',
    ...ingredients.map(
      (row) =>
        `- ${row.slug} — ${row.name}, ${row.kind}` +
        (row.aliases.length > 0 ? ` (also called: ${row.aliases.join(', ')})` : ''),
    ),
  ].join('\n');

  // Same convention as suggest-cocktails: a hand-edited prompt that lost its
  // placeholder must not silently become a prompt with no vocabulary, because
  // the model would then guess slugs that fail validation below every time.
  const hasPlaceholder = config.system_prompt.includes('{{VOCABULARY}}');
  if (!hasPlaceholder) {
    console.warn(
      `ai_prompts "${PROMPT_KEY}" v${config.version} has no {{VOCABULARY}} placeholder; appending the list.`,
    );
  }
  const system = hasPlaceholder
    ? config.system_prompt.replaceAll('{{VOCABULARY}}', vocabularyBlock)
    : `${config.system_prompt}\n\n${vocabularyBlock}`;

  const input = brand ? `Bottle: ${name}\nBrand: ${brand}` : `Bottle: ${name}`;

  // Unlimited on every plan today (see plan_limits), but checked all the same
  // so the limit is a row change if that ever needs to differ.
  const exhausted = await checkQuota(admin, user.id, PROMPT_KEY);
  if (exhausted) return exhausted;

  const openai = new OpenAI({ apiKey: openaiKey });

  let response;
  try {
    response = await openai.responses.create({
      model: config.model,
      max_output_tokens: config.max_output_tokens,
      instructions: system,
      input,
      ...(config.reasoning_effort ? { reasoning: { effort: config.reasoning_effort } } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'bottle_classification',
          strict: true,
          schema: CLASSIFY_SCHEMA,
        },
      },
    });
  } catch (cause) {
    console.error('OpenAI request failed', cause);
    return json({ error: 'Could not reach the classification service.' }, 502);
  }

  const usage = response.usage;
  console.log(
    `classify-bottle: in=${usage?.input_tokens} out=${usage?.output_tokens} ` +
      `model=${response.model} prompt=v${config.version}`,
  );

  // A decline, a filter, or a truncation all mean "no guess" here — the caller
  // treats null as a normal outcome, so there is nothing to escalate.
  const refused = response.output.some(
    (item) =>
      item.type === 'message' &&
      item.content.some((part: { type: string }) => part.type === 'refusal'),
  );
  const filtered = response.incomplete_details?.reason === 'content_filter';

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

  if (refused || filtered || response.status === 'incomplete' || !response.output_text) {
    return json({ ingredient_id: null, slug: null } satisfies ClassifyResponse);
  }

  let parsed: { slug: string | null };
  try {
    parsed = JSON.parse(response.output_text);
  } catch {
    console.error('Unparseable model output', response.output_text.slice(0, 200));
    return json({ ingredient_id: null, slug: null } satisfies ClassifyResponse);
  }

  const match = parsed.slug ? bySlug.get(parsed.slug) : null;
  if (parsed.slug && !match) {
    console.warn(`Model returned unknown slug "${parsed.slug}" for "${name}"`);
  }

  return json({
    ingredient_id: match?.id ?? null,
    slug: match?.slug ?? null,
  } satisfies ClassifyResponse);
});
