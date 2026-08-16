/**
 * Open Food Facts adapter.
 *
 * OFF is a crowd-sourced grocery database, so its data is uneven: names carry
 * marketing text, sizes are written a dozen ways, and categories are a deep tag
 * hierarchy. Everything here is best-effort — the caller treats the result as a
 * prefill for a form the user confirms, never as the truth.
 */

/** OFF asks every client to identify itself, and rate-limits those that don't. */
const USER_AGENT = 'Flanagan/1.0 (https://github.com/KevinThibaut89/Flanagan)';

const FIELDS = [
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'quantity',
  'product_quantity',
  'image_front_url',
  'image_url',
  'countries',
  'categories_tags',
  'nutriments',
].join(',');

export interface OffProduct {
  name: string;
  brand: string | null;
  abv: number | null;
  volumeMl: number | null;
  country: string | null;
  imageUrl: string | null;
  /** Our canonical ingredient slug, when the OFF categories imply one. */
  ingredientSlug: string | null;
}

/**
 * OFF category tags mapped to our ingredient slugs, most specific first — the
 * first match wins, so `en:single-malt-whisky` beats the `en:whiskies` that
 * always sits alongside it.
 */
const CATEGORY_MAP: Array<[string, string]> = [
  // Gin
  ['en:london-dry-gin', 'london-dry-gin'],
  ['en:sloe-gins', 'sloe-gin'],
  ['en:gins', 'gin'],
  ['en:genevers', 'genever'],

  // Whisky — specific styles before the generic bucket
  ['en:single-malt-whiskies', 'single-malt-scotch'],
  ['en:single-malt-whisky', 'single-malt-scotch'],
  ['en:blended-whiskies', 'blended-scotch'],
  ['en:scotch-whiskies', 'scotch'],
  ['en:scotch-whisky', 'scotch'],
  ['en:bourbon-whiskey', 'bourbon'],
  ['en:bourbons', 'bourbon'],
  ['en:rye-whiskey', 'rye-whiskey'],
  ['en:irish-whiskeys', 'irish-whiskey'],
  ['en:irish-whiskey', 'irish-whiskey'],
  ['en:japanese-whisky', 'japanese-whisky'],
  ['en:whiskies', 'whisky'],
  ['en:whiskys', 'whisky'],
  ['en:whiskeys', 'whisky'],

  // Rum
  ['en:white-rums', 'white-rum'],
  ['en:dark-rums', 'dark-rum'],
  ['en:aged-rums', 'aged-rum'],
  ['en:spiced-rums', 'spiced-rum'],
  ['en:agricultural-rums', 'agricole-rhum'],
  ['en:rums', 'rum'],
  ['en:cachacas', 'cachaca'],

  // Agave
  ['en:mezcals', 'mezcal'],
  ['en:tequilas', 'tequila'],

  // Brandy
  ['en:cognacs', 'cognac'],
  ['en:armagnacs', 'armagnac'],
  ['en:calvados', 'calvados'],
  ['en:pisco', 'pisco'],
  ['en:grappas', 'grappa'],
  ['en:brandies', 'brandy'],

  // Other spirits
  ['en:vodkas', 'vodka'],
  ['en:absinthes', 'absinthe'],
  ['en:pastis', 'pastis'],
  ['en:aquavits', 'aquavit'],

  // Liqueurs & bitters
  ['en:orange-liqueurs', 'orange-liqueur'],
  ['en:coffee-liqueurs', 'coffee-liqueur'],
  ['en:cream-liqueurs', 'irish-cream'],
  ['en:amaretto', 'amaretto'],
  ['en:limoncellos', 'limoncello'],
  ['en:bitters', 'bitters'],
  ['en:liqueurs', 'orange-liqueur'],

  // Fortified & aromatised wine
  ['en:vermouths', 'vermouth'],
  ['en:ports', 'port'],
  ['en:sherries', 'sherry'],
  ['en:madeiras', 'madeira'],

  // Wine & beer
  ['en:champagnes', 'champagne'],
  ['en:proseccos', 'prosecco'],
  ['en:sparkling-wines', 'sparkling-wine'],
  ['en:white-wines', 'white-wine'],
  ['en:red-wines', 'red-wine'],
  ['en:rose-wines', 'rose-wine'],
  ['en:beers', 'lager'],

  // Mixers & non-alcoholic
  ['en:tonic-waters', 'tonic-water'],
  ['en:ginger-beers', 'ginger-beer'],
  ['en:ginger-ales', 'ginger-ale'],
  ['en:colas', 'cola'],
  ['en:sparkling-waters', 'soda-water'],
  ['en:carbonated-waters', 'soda-water'],
  ['en:lemonades', 'lemonade'],
  ['en:orange-juices', 'orange-juice'],
  ['en:lemon-juices', 'lemon-juice'],
  ['en:lime-juices', 'lime-juice'],
  ['en:grapefruit-juices', 'grapefruit-juice'],
  ['en:pineapple-juices', 'pineapple-juice'],
  ['en:cranberry-juices', 'cranberry-juice'],
  ['en:tomato-juices', 'tomato-juice'],
  ['en:fruit-juices', 'orange-juice'],
  ['en:syrups', 'simple-syrup'],
];

/**
 * "70 cl", "700ml", "1 L", "1,5 l", "75cl e" → millilitres.
 * Returns null rather than guessing when the string is not a volume.
 */
export function parseQuantityToMl(quantity: string | undefined | null): number | null {
  if (!quantity) return null;

  const normalised = quantity.toLowerCase().replace(',', '.');
  const match = normalised.match(/(\d+(?:\.\d+)?)\s*(ml|cl|dl|l|litre|liter)\b/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  switch (match[2]) {
    case 'ml':
      return Math.round(amount);
    case 'cl':
      return Math.round(amount * 10);
    case 'dl':
      return Math.round(amount * 100);
    default:
      return Math.round(amount * 1000);
  }
}

/** OFF records alcohol as % by volume in `nutriments.alcohol_100g`. */
function parseAbv(nutriments: Record<string, unknown> | undefined): number | null {
  if (!nutriments) return null;
  const raw = nutriments['alcohol_100g'] ?? nutriments['alcohol_value'] ?? nutriments['alcohol'];
  const value = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 100) return null;
  return Math.round(value * 10) / 10;
}

function matchIngredientSlug(tags: string[] | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  const present = new Set(tags);
  for (const [tag, slug] of CATEGORY_MAP) {
    if (present.has(tag)) return slug;
  }
  return null;
}

/** OFF's `countries` is a comma-separated list; the first entry is enough. */
function firstCountry(countries: string | undefined): string | null {
  if (!countries) return null;
  const first = countries.split(',')[0]?.trim();
  return first || null;
}

export async function fetchFromOpenFoodFacts(barcode: string): Promise<OffProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=${FIELDS}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    // A barcode lookup blocks someone standing at their bar cart; failing fast
    // and letting them type it in beats a long spinner.
    signal: AbortSignal.timeout(6000),
  });

  // 404 is OFF's "unknown barcode", which is a miss rather than an error.
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Open Food Facts returned ${response.status}`);
  }

  const body = await response.json();
  if (body?.status !== 1 || !body?.product) return null;

  const product = body.product as Record<string, any>;

  const name: string =
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    product.generic_name?.trim() ||
    '';
  if (!name) return null;

  // `product_quantity` is OFF's normalised grams/millilitres field; fall back to
  // parsing the human-written `quantity` when it is missing.
  const productQuantity = Number(product.product_quantity);
  const volumeMl =
    Number.isFinite(productQuantity) && productQuantity > 0
      ? Math.round(productQuantity)
      : parseQuantityToMl(product.quantity);

  return {
    name,
    brand: product.brands?.split(',')[0]?.trim() || null,
    abv: parseAbv(product.nutriments),
    volumeMl,
    country: firstCountry(product.countries),
    imageUrl: product.image_front_url || product.image_url || null,
    ingredientSlug: matchIngredientSlug(product.categories_tags),
  };
}
