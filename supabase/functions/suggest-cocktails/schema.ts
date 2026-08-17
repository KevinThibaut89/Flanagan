/**
 * The JSON Schema the model is constrained to. It mirrors the `recipes` and
 * `recipe_ingredients` tables closely enough that a validated response can be
 * mapped to rows without interpretation — which is the whole point: an AI
 * suggestion you save and a recipe you type by hand end up identical.
 *
 * Ingredients are referenced by **slug**, not id. The model cannot know a UUID,
 * but slugs are stable, human-readable, and exactly what the availability list
 * is expressed in — so validation is a set membership test and mapping is a
 * dictionary lookup.
 *
 * Every field is required and non-nullable, and every object sets
 * `additionalProperties: false`. That is what OpenAI's strict structured outputs
 * demand, and it costs nothing here: "" / [] / 0 are unambiguous enough for the
 * few fields that can be genuinely absent. Note the absence of `minItems` /
 * `maxItems` — strict mode does not support them, so the one-to-three bound on
 * `recipes` lives in its description and is not enforced by the schema.
 */

export const MEASURE_UNITS = [
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

export const METHODS = ['shake', 'stir', 'build', 'blend', 'throw', 'swizzle', 'muddle'] as const;

export const ICES = ['none', 'cubed', 'crushed', 'large_cube', 'block'] as const;

export const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      description: 'Between one and three cocktails answering the request.',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'The drink’s name. Use the established name when this is a classic or a recognised riff.',
          },
          rationale: {
            type: 'string',
            description:
              'One sentence on why this answers the request, naming the specific bottles it leans on.',
          },
          base_ingredient: {
            type: 'string',
            description: 'Slug of the dominant spirit, from the available list.',
          },
          glass: { type: 'string', description: 'e.g. coupe, rocks, highball, Nick & Nora.' },
          method: { type: 'string', enum: METHODS },
          ice: { type: 'string', enum: ICES },
          garnish: {
            type: 'string',
            description: 'Free text, or an empty string when the drink takes none.',
          },
          instructions: {
            type: 'array',
            description: 'Ordered steps. Terse and practical, one action each.',
            items: { type: 'string' },
          },
          flavor_tags: {
            type: 'array',
            description:
              'Short lowercase descriptors: dry, floral, bitter, citrus, herbal, spirit-forward, refreshing.',
            items: { type: 'string' },
          },
          abv_estimate: {
            type: 'number',
            description: 'Approximate ABV of the finished drink, as a percentage.',
          },
          servings: { type: 'integer' },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ingredient: {
                  type: 'string',
                  description:
                    'A slug from the available list. Required, non-garnish lines must use a slug the drinker actually has.',
                },
                amount: {
                  type: 'number',
                  description: 'Quantity in the given unit. Use 0 for "top up" lines.',
                },
                unit: { type: 'string', enum: MEASURE_UNITS },
                is_optional: { type: 'boolean' },
                is_garnish: { type: 'boolean' },
                note: {
                  type: 'string',
                  description: 'Optional qualifier such as "freshly squeezed", or an empty string.',
                },
              },
              required: ['ingredient', 'amount', 'unit', 'is_optional', 'is_garnish', 'note'],
              additionalProperties: false,
            },
          },
        },
        required: [
          'title',
          'rationale',
          'base_ingredient',
          'glass',
          'method',
          'ice',
          'garnish',
          'instructions',
          'flavor_tags',
          'abv_estimate',
          'servings',
          'ingredients',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['recipes'],
  additionalProperties: false,
} as const;

export interface SuggestedIngredient {
  ingredient: string;
  amount: number;
  unit: (typeof MEASURE_UNITS)[number];
  is_optional: boolean;
  is_garnish: boolean;
  note: string;
}

export interface SuggestedRecipe {
  title: string;
  rationale: string;
  base_ingredient: string;
  glass: string;
  method: (typeof METHODS)[number];
  ice: (typeof ICES)[number];
  garnish: string;
  instructions: string[];
  flavor_tags: string[];
  abv_estimate: number;
  servings: number;
  ingredients: SuggestedIngredient[];
}
