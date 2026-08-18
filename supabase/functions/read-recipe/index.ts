import OpenAI from 'npm:openai@^6.9.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Reads a cocktail recipe off a photograph — a page of a book, a menu, a
 * screenshot — so it can be typed in for you rather than by you.
 *
 * Plain OCR would give back a wall of text that still has to be split into
 * lines, quantities and units by hand. Here the model does the reading *and*
 * the structuring in one pass, constrained to the same shape the recipe editor
 * saves — and, like the other vision call, pins each ingredient line to a slug
 * from our own vocabulary so a scanned "gin" counts as the gin on the shelf.
 *
 * Every answer is a prefill for the editor, never the truth: slugs are checked
 * against the vocabulary, units and enums are validated, unmatched lines come
 * back as free text, and an empty list is a normal outcome. A page may hold
 * more than one recipe, so the response is a list; the app lets the user pick.
 */

/** Which `ai_prompts` row configures this function. */
const PROMPT_KEY = 'read_recipe';

/** Base64 grows ~4/3 over the raw bytes; this allows roughly a 6 MB photo. */
const MAX_IMAGE_CHARS = 8_000_000;
const MAX_RECIPES = 6;
const MAX_LINES = 30;
const MAX_STEPS = 20;
const MAX_TAGS = 8;
const MAX_TITLE_CHARS = 120;
const MAX_SHORT_CHARS = 200;
const MAX_LONG_CHARS = 1_000;

const MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
type MimeType = (typeof MIME_TYPES)[number];

/** Mirrors the Postgres enums; anything else the model says is dropped to null. */
const MEASURE_UNITS = [
  'ml',
  'cl',
  'oz',
  'dash',
  'barspoon',
  'tsp',
  'tbsp',
  'drop',
  'piece',
  'pinch',
  'splash',
  'top',
] as const;
const METHODS = ['shake', 'stir', 'build', 'blend', 'throw', 'swizzle', 'muddle'] as const;
const ICES = ['none', 'cubed', 'crushed', 'large_cube', 'block'] as const;
const CONFIDENCES = ['high', 'medium', 'low'] as const;

type MeasureUnit = (typeof MEASURE_UNITS)[number];
type Method = (typeof METHODS)[number];
type Ice = (typeof ICES)[number];
type Confidence = (typeof CONFIDENCES)[number];

interface PromptConfig {
  system_prompt: string;
  model: string;
  max_output_tokens: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high' | null;
  version: number;
}

interface ModelLine {
  text: string;
  slug: string | null;
  amount: number | null;
  unit: string | null;
  is_optional: boolean;
  is_garnish: boolean;
  note: string | null;
}

interface ModelRecipe {
  title: string;
  glass: string | null;
  method: string | null;
  ice: string | null;
  garnish: string | null;
  instructions: string[];
  notes: string | null;
  flavor_tags: string[];
  servings: number | null;
  ingredients: ModelLine[];
  confidence: Confidence;
}

export interface ReadLine {
  /** The ingredient as printed, e.g. "fresh lemon juice". */
  text: string;
  ingredient_id: string | null;
  slug: string | null;
  amount: number | null;
  unit: MeasureUnit | null;
  is_optional: boolean;
  is_garnish: boolean;
  note: string | null;
}

export interface ReadRecipe {
  title: string;
  glass: string | null;
  method: Method | null;
  ice: Ice | null;
  garnish: string | null;
  instructions: string[];
  notes: string | null;
  flavor_tags: string[];
  servings: number | null;
  ingredients: ReadLine[];
  confidence: Confidence;
}

export interface ReadRecipeResponse {
  recipes: ReadRecipe[];
  message: string | null;
}

/**
 * Strict structured-output schema: every key required, no extras, nullable
 * where the page may genuinely not say. Enum-ish fields (unit, method, ice)
 * are plain nullable strings with the allowed values in the description and
 * are validated after parsing — the same treatment as ingredient slugs — so a
 * page written in "parts" or "a splash" degrades to null rather than to a
 * failed request.
 */
const READ_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      description:
        'One entry per complete cocktail recipe legible in the photo, in reading order. Empty when there is none.',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The drink’s name as printed. If the page gives none, a short descriptive one.',
          },
          glass: {
            type: ['string', 'null'],
            description: 'Glassware as stated, e.g. "coupe", "rocks", "highball"; null when not given.',
          },
          method: {
            type: ['string', 'null'],
            description: `The main technique, one of: ${METHODS.join(', ')}. Infer it from the steps if it is not stated outright; null only when it is genuinely unclear.`,
          },
          ice: {
            type: ['string', 'null'],
            description: `Ice in the serving glass, one of: ${ICES.join(', ')}. Use "none" for a drink served up (strained, no ice); null when not stated or inferable.`,
          },
          garnish: {
            type: ['string', 'null'],
            description: 'The garnish as printed, e.g. "lemon twist"; null when the recipe gives none.',
          },
          instructions: {
            type: 'array',
            description:
              'The method as ordered steps, one action each, in the language of the source. Split a single paragraph into steps; keep the wording close to the original.',
            items: { type: 'string' },
          },
          notes: {
            type: ['string', 'null'],
            description:
              'Attribution and useful context printed with the recipe — book, author, bar, a headnote worth keeping — as one short paragraph; null when there is nothing beyond the recipe itself.',
          },
          flavor_tags: {
            type: 'array',
            description:
              'Two to five short lowercase descriptors of how the drink tastes: dry, floral, bitter, citrus, herbal, spirit-forward, refreshing, sweet, smoky…',
            items: { type: 'string' },
          },
          servings: {
            type: ['integer', 'null'],
            description: 'How many drinks the quantities make, only when the recipe says; null otherwise.',
          },
          ingredients: {
            type: 'array',
            description: 'Every ingredient line, in printed order, including garnishes.',
            items: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description:
                    'The ingredient as printed, without the quantity: "London dry gin", "fresh lemon juice", "simple syrup (1:1)".',
                },
                slug: {
                  type: ['string', 'null'],
                  description:
                    'The single best-matching ingredient slug from the provided vocabulary, or null when no entry clearly fits.',
                },
                amount: {
                  type: ['number', 'null'],
                  description:
                    'The quantity as a decimal number in the given unit: "¾ oz" is 0.75, "2 dashes" is 2, "1½ tsp" is 1.5. Use 0 for "top up with…" lines and null when no quantity is printed.',
                },
                unit: {
                  type: ['string', 'null'],
                  description: `The unit as printed, normalised to one of: ${MEASURE_UNITS.join(', ')}. "bar spoon"/"barspoon" → barspoon; "teaspoon" → tsp; "tablespoon" → tbsp; a whole item (an egg white, a wedge) → piece; "top with"/"fill with" → top. Do not convert between volume units. null when the quantity is in parts or there is no quantity.`,
                },
                is_optional: {
                  type: 'boolean',
                  description: 'True when the recipe marks the line as optional or "to taste".',
                },
                is_garnish: {
                  type: 'boolean',
                  description: 'True for garnish lines and anything only used to decorate the glass.',
                },
                note: {
                  type: ['string', 'null'],
                  description:
                    'A short qualifier printed with the line — "freshly squeezed", "chilled", "2 parts" when the unit had to be null — else null.',
                },
              },
              required: ['text', 'slug', 'amount', 'unit', 'is_optional', 'is_garnish', 'note'],
              additionalProperties: false,
            },
          },
          confidence: {
            type: 'string',
            enum: [...CONFIDENCES],
            description:
              'How faithfully the recipe could be read: high when the text is crisp and complete, medium when parts were partly inferred, low when the page is blurry, cut off, or the quantities are guessed.',
          },
        },
        required: [
          'title',
          'glass',
          'method',
          'ice',
          'garnish',
          'instructions',
          'notes',
          'flavor_tags',
          'servings',
          'ingredients',
          'confidence',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['recipes'],
  additionalProperties: false,
} as const;

const NOTHING_FOUND =
  "Couldn't find a recipe in that photo — try a flatter shot, with the whole recipe in frame.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isMimeType(value: unknown): value is MimeType {
  return typeof value === 'string' && (MIME_TYPES as readonly string[]).includes(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  const normalised = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(normalised) ? (normalised as T) : null;
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, max);
  return trimmed || null;
}

function cleanTexts(value: unknown, max: number, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = cleanText(item, max);
    if (text) out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
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
    return json({ error: 'The recipe reader is not configured.' }, 500);
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
    return json({ error: 'The recipe reader is not configured.' }, 500);
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
              text: 'Read every cocktail recipe on this page into the structure.',
            },
          ],
        },
      ],
      ...(config.reasoning_effort ? { reasoning: { effort: config.reasoning_effort } } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'read_recipes',
          strict: true,
          schema: READ_SCHEMA,
        },
      },
    });
  } catch (cause) {
    console.error('OpenAI request failed', cause);
    return json({ error: 'Could not reach the recipe reader.' }, 502);
  }

  const usage = response.usage;
  console.log(
    `read-recipe: in=${usage?.input_tokens} out=${usage?.output_tokens} ` +
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
  if (refused || filtered) {
    return json({ recipes: [], message: NOTHING_FOUND } satisfies ReadRecipeResponse);
  }

  if (response.status === 'incomplete') {
    console.error(`Response incomplete: ${response.incomplete_details?.reason ?? 'unknown'}`);
    return json({ error: 'The recipe reader returned nothing usable.' }, 502);
  }

  const text = response.output_text;
  if (!text) return json({ error: 'The recipe reader returned nothing usable.' }, 502);

  let parsed: { recipes: ModelRecipe[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('Unparseable model output', text.slice(0, 500));
    return json({ error: 'The recipe reader returned an unreadable answer.' }, 502);
  }

  const recipes: ReadRecipe[] = [];
  for (const raw of Array.isArray(parsed.recipes) ? parsed.recipes : []) {
    if (recipes.length >= MAX_RECIPES) break;

    const title = cleanText(raw?.title, MAX_TITLE_CHARS);
    if (!title) continue;

    const lines: ReadLine[] = [];
    for (const line of Array.isArray(raw?.ingredients) ? raw.ingredients : []) {
      if (lines.length >= MAX_LINES) break;

      const lineText = cleanText(line?.text, MAX_SHORT_CHARS);
      if (!lineText) continue;

      const match = line?.slug ? bySlug.get(line.slug) : null;
      if (line?.slug && !match) {
        console.warn(`Model returned unknown slug "${line.slug}" for "${lineText}"`);
      }

      const unit = oneOf(line?.unit, MEASURE_UNITS);
      const amount = cleanNumber(line?.amount, 0, 10_000);

      lines.push({
        text: lineText,
        ingredient_id: match?.id ?? null,
        slug: match?.slug ?? null,
        // A "top up" line legitimately carries 0; anything else with 0 has no
        // real quantity and reads better blank in the editor.
        amount: amount !== null && (amount > 0 || unit === 'top') ? amount : null,
        unit,
        is_optional: line?.is_optional === true,
        is_garnish: line?.is_garnish === true,
        note: cleanText(line?.note, MAX_SHORT_CHARS),
      });
    }

    // A title with no lines is a heading the model mistook for a recipe.
    if (lines.length === 0) continue;

    const servings = cleanNumber(raw?.servings, 1, 100);

    recipes.push({
      title,
      glass: cleanText(raw?.glass, MAX_SHORT_CHARS),
      method: oneOf(raw?.method, METHODS),
      ice: oneOf(raw?.ice, ICES),
      garnish: cleanText(raw?.garnish, MAX_SHORT_CHARS),
      instructions: cleanTexts(raw?.instructions, MAX_LONG_CHARS, MAX_STEPS),
      notes: cleanText(raw?.notes, MAX_LONG_CHARS),
      flavor_tags: cleanTexts(raw?.flavor_tags, 40, MAX_TAGS).map((tag) => tag.toLowerCase()),
      servings: servings !== null ? Math.round(servings) : null,
      ingredients: lines,
      confidence: oneOf(raw?.confidence, CONFIDENCES) ?? 'low',
    });
  }

  return json({
    recipes,
    message: recipes.length === 0 ? NOTHING_FOUND : null,
  } satisfies ReadRecipeResponse);
});
