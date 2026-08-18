import OpenAI from 'npm:openai@^6.9.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { json } from '../_shared/http.ts';
import { checkQuota, recordUsage } from '../_shared/quota.ts';

/**
 * Reads the bottles off a photo of a shelf so they can be added in one go.
 *
 * The barcode scanner handles one bottle at a time and only knows what Open
 * Food Facts knows; a shelf of twenty bottles is a chore that way. Here the
 * model looks at one photo, lists every distinct bottle it can read a label
 * for, and — like classify-bottle — pins each to an ingredient slug from our
 * own vocabulary.
 *
 * Every answer is a prefill for a review list the user ticks through, never
 * the truth: slugs are validated against the vocabulary, anything unreadable
 * comes back with low confidence, and an empty list is a normal outcome.
 */

/** Which `ai_prompts` row configures this function. */
const PROMPT_KEY = 'identify_bottles';

/** Base64 grows ~4/3 over the raw bytes; this allows roughly a 6 MB photo. */
const MAX_IMAGE_CHARS = 8_000_000;
const MAX_BOTTLES = 40;
const MAX_NAME_CHARS = 120;

const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
type MimeType = (typeof MIME_TYPES)[number];

const CONFIDENCES = ['high', 'medium', 'low'] as const;
type Confidence = (typeof CONFIDENCES)[number];

interface PromptConfig {
  system_prompt: string;
  model: string;
  max_output_tokens: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high' | null;
  version: number;
}

interface ModelBottle {
  name: string;
  brand: string | null;
  slug: string | null;
  abv: number | null;
  volume_ml: number | null;
  confidence: Confidence;
}

interface IdentifiedBottle {
  name: string;
  brand: string | null;
  ingredient_id: string | null;
  slug: string | null;
  abv: number | null;
  volume_ml: number | null;
  confidence: Confidence;
}

interface IdentifyResponse {
  bottles: IdentifiedBottle[];
  message: string | null;
}

/**
 * Strict structured-output schema: every key required, no extras, nullable
 * where the label may genuinely not say. `minItems`/`maxItems` are not
 * supported in strict mode, so the row cap is enforced after parsing.
 */
const IDENTIFY_SCHEMA = {
  type: 'object',
  properties: {
    bottles: {
      type: 'array',
      description: 'One entry per distinct bottle whose label can be read, in shelf order.',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'The product name as printed on the label, e.g. "Tanqueray No. Ten" or "Antica Formula".',
          },
          brand: {
            type: ['string', 'null'],
            description: 'The producer or brand when it is distinct from the name and legible; else null.',
          },
          slug: {
            type: ['string', 'null'],
            description:
              'The single best-matching ingredient slug from the provided vocabulary, or null when no entry clearly fits.',
          },
          abv: {
            type: ['number', 'null'],
            description: 'Alcohol by volume as a percentage, only if legible on the label; else null.',
          },
          volume_ml: {
            type: ['number', 'null'],
            description: 'Bottle size in millilitres, only if legible on the label; else null.',
          },
          confidence: {
            type: 'string',
            enum: [...CONFIDENCES],
            description:
              'How sure you are of the name: high when the label is clearly readable, medium when partly inferred, low when guessed from shape or a partial word.',
          },
        },
        required: ['name', 'brand', 'slug', 'abv', 'volume_ml', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['bottles'],
  additionalProperties: false,
} as const;

const NOTHING_FOUND = "Couldn't make out any bottle labels — try closer, or with more light.";

function isMimeType(value: unknown): value is MimeType {
  return typeof value === 'string' && (MIME_TYPES as readonly string[]).includes(value);
}

function isConfidence(value: unknown): value is Confidence {
  return typeof value === 'string' && (CONFIDENCES as readonly string[]).includes(value);
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

function cleanNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header.' }, 401);

  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    return json({ error: 'The recognition service is not configured.' }, 500);
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

  let image: string;
  let mimeType: MimeType;
  try {
    const body = await request.json();
    image = String(body?.image ?? '').trim();
    if (!isMimeType(body?.mimeType)) {
      return json({ error: 'Unsupported image type.' }, 400);
    }
    mimeType = body.mimeType;
  } catch {
    return json({ error: 'Expected a JSON body with an image.' }, 400);
  }

  if (!image) return json({ error: 'A photo is required.' }, 400);
  if (image.length > MAX_IMAGE_CHARS) {
    return json({ error: 'That photo is too large to send. Try a smaller one.' }, 413);
  }
  // A data-URL prefix means the client double-wrapped it; strip rather than fail.
  const comma = image.indexOf(',');
  if (image.startsWith('data:') && comma > 0) image = image.slice(comma + 1);

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
    return json({ error: 'The recognition service is not configured.' }, 500);
  }

  const vocabularyBlock = [
    'INGREDIENT VOCABULARY (slug — name, kind):',
    ...ingredients.map(
      (row) =>
        `- ${row.slug} — ${row.name}, ${row.kind}` +
        (row.aliases.length > 0 ? ` (also called: ${row.aliases.join(', ')})` : ''),
    ),
  ].join('\n');

  // Same convention as the other prompts: a hand-edited prompt that lost its
  // placeholder must not silently become a prompt with no vocabulary.
  const hasPlaceholder = config.system_prompt.includes('{{VOCABULARY}}');
  if (!hasPlaceholder) {
    console.warn(
      `ai_prompts "${PROMPT_KEY}" v${config.version} has no {{VOCABULARY}} placeholder; appending the list.`,
    );
  }
  const system = hasPlaceholder
    ? config.system_prompt.replaceAll('{{VOCABULARY}}', vocabularyBlock)
    : `${config.system_prompt}\n\n${vocabularyBlock}`;

  // The image has been validated and the prompt loaded; this is the last
  // point before money is spent, so it is where the month's allowance is
  // checked.
  const exhausted = await checkQuota(admin, user.id, PROMPT_KEY);
  if (exhausted) return exhausted;

  const openai = new OpenAI({ apiKey: openaiKey });

  let response;
  try {
    response = await openai.responses.create({
      model: config.model,
      max_output_tokens: config.max_output_tokens,
      instructions: system,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:${mimeType};base64,${image}`,
              detail: 'high',
            },
            {
              type: 'input_text',
              text: 'List every distinct alcoholic bottle you can identify in this photo.',
            },
          ],
        },
      ],
      ...(config.reasoning_effort ? { reasoning: { effort: config.reasoning_effort } } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'identified_bottles',
          strict: true,
          schema: IDENTIFY_SCHEMA,
        },
      },
    });
  } catch (cause) {
    console.error('OpenAI request failed', cause);
    return json({ error: 'Could not reach the recognition service.' }, 502);
  }

  const usage = response.usage;
  console.log(
    `identify-bottles: in=${usage?.input_tokens} out=${usage?.output_tokens} ` +
      `model=${response.model} prompt=v${config.version}`,
  );

  // A decline or a filter is "nothing found" from the user's point of view;
  // there is nothing for them to fix except the photo.
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

  if (refused || filtered) {
    return json({ bottles: [], message: NOTHING_FOUND } satisfies IdentifyResponse);
  }

  if (response.status === 'incomplete') {
    console.error(`Response incomplete: ${response.incomplete_details?.reason ?? 'unknown'}`);
    return json({ error: 'The recognition service returned nothing usable.' }, 502);
  }

  const text = response.output_text;
  if (!text) return json({ error: 'The recognition service returned nothing usable.' }, 502);

  let parsed: { bottles: ModelBottle[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('Unparseable model output', text.slice(0, 500));
    return json({ error: 'The recognition service returned an unreadable answer.' }, 502);
  }

  const bottles: IdentifiedBottle[] = [];
  for (const raw of Array.isArray(parsed.bottles) ? parsed.bottles : []) {
    if (bottles.length >= MAX_BOTTLES) break;

    const name = cleanText(raw?.name, MAX_NAME_CHARS);
    if (!name) continue;

    const match = raw?.slug ? bySlug.get(raw.slug) : null;
    if (raw?.slug && !match) {
      console.warn(`Model returned unknown slug "${raw.slug}" for "${name}"`);
    }

    bottles.push({
      name,
      brand: cleanText(raw?.brand, MAX_NAME_CHARS),
      ingredient_id: match?.id ?? null,
      slug: match?.slug ?? null,
      abv: cleanNumber(raw?.abv, 0, 100),
      volume_ml: cleanNumber(raw?.volume_ml, 1, 10_000),
      confidence: isConfidence(raw?.confidence) ? raw.confidence : 'low',
    });
  }

  return json({
    bottles,
    message: bottles.length === 0 ? NOTHING_FOUND : null,
  } satisfies IdentifyResponse);
});
