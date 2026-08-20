/**
 * The recipe library, as the edge functions see it.
 *
 * The tables and the three RPCs are in 20260819120000_recipe_library.sql; this
 * module is the code around them that both `suggest-cocktails` (answer-first,
 * grounding, persisting) and `search-library` (Discover) share: the row shape
 * the RPCs return, the mapping from a row to the draft the app expects, the
 * text block handed to the model, and the tunables.
 *
 * Nothing here is allowed to fail an answer. The library is a shortcut and a
 * memory; the Barkeep worked without it and must keep working if it is down.
 */

// ── Tunables ────────────────────────────────────────────────────────────────
//
// Two different similarities are in play, and they live on different scales.
//
// Ask-to-ask (library_answer): the new ask against previous asks. Measured on
// 2026-08-19: "something bitter and stirred" vs "a bitter stirred drink
// please" 0.76 (same wish); vs "bitter aperitivo" 0.57 and "a bitter stirred
// drink please" vs "bitter aperitivo" 0.61 (related, not the same); vs
// "refreshing long gin drink" 0.37; vs "surprise me…" 0.24; the French
// "un cocktail amer et remué" 0.43 (cross-language lands low — a French ask
// goes to the model, which answers in French). This is the signal
// answer-first trusts: 0.72 sits between the same wish and its neighbours.
//
// Ask-to-recipe (library_search): the new ask against recipe documents. Much
// lower and noisier — the original ask scored 0.45 against its own Negroni
// while a long-gin-drink ask scored 0.52 against it, because the spirit word
// dominates. Good for a *ranked list* (grounding, Discover), not for a yes/no.
//
// Starting values; suggest-cocktails logs both on every ask so they can be
// tuned against real traffic. If they move more than once, promote them to a
// settings row.

/** Answer from the library without the model when this many makeable recipes… */
export const LIBRARY_ANSWER_MIN_HITS = 2;
/** …were produced by past asks at least this close to the new one. */
export const LIBRARY_ANSWER_MIN_ASK_SIMILARITY = 0.72;
/** A single recipe is enough when the past ask was essentially the same wish ("negroni" vs "a classic negroni" = 0.82). */
export const LIBRARY_ANSWER_EXACT_ASK_SIMILARITY = 0.8;
/** Return at most this many. */
export const LIBRARY_ANSWER_MAX = 3;

/** Hand the model up to this many of the closest recipes as reference… */
export const LIBRARY_RAG_TOP_K = 5;
/** …if they score at least this against the ask. */
export const LIBRARY_RAG_MIN_SIMILARITY = 0.3;

/** How many recipes the grounding search pulls. */
export const LIBRARY_SEARCH_COUNT = 10;

/** Discover search: looser, it is a ranked list with the person choosing. */
export const LIBRARY_DISCOVER_MIN_SIMILARITY = 0.25;
export const LIBRARY_DISCOVER_MAX = 30;

// ── Shapes ──────────────────────────────────────────────────────────────────

/** One line of `library_recipe_ingredients`, as `to_jsonb()` renders it. */
export interface LibraryLine {
  id: string;
  recipe_id: string;
  ingredient_id: string | null;
  free_text: string | null;
  amount_ml: number | null;
  amount_display: number | null;
  unit_display: string | null;
  is_optional: boolean;
  is_garnish: boolean;
  position: number;
  note: string | null;
}

/** A row from `library_search` / `library_answer` (similarity set) or `library_browse` (not). */
export interface LibraryRow {
  id: string;
  title: string;
  rationale: string | null;
  glass: string | null;
  method: string | null;
  ice: string | null;
  garnish: string | null;
  instructions: string[];
  flavor_tags: string[];
  base_ingredient_id: string | null;
  abv_estimate: number | null;
  servings: number;
  required_ingredient_ids: string[];
  ai_model: string;
  times_suggested: number;
  created_at: string;
  ingredients: LibraryLine[];
  similarity?: number;
  makeable: boolean;
}

// ── Text ────────────────────────────────────────────────────────────────────

/**
 * Mirrors `normalize()` in `src/lib/text.ts` (NFD, marks stripped, lowercase,
 * trimmed), plus collapsed whitespace. Duplicated because Deno cannot import
 * from the app tree; the two should change together.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The dedupe key: folded title plus the sorted required ingredient slugs.
 * Amounts are left out on purpose — the model's 45 ml today is its 50 ml
 * tomorrow, and that is the same drink.
 */
export function fingerprint(title: string, requiredSlugs: string[]): string {
  const slugs = [...new Set(requiredSlugs)].sort();
  return `${foldText(title)}|${slugs.join(',')}`;
}

/**
 * The document that gets embedded. Written to sit close to the short mood
 * queries people type: tags first (that is what asks are made of), then the
 * build, then ingredients by *name* (asks say "gin", not "london-dry-gin"),
 * then the rationale, which often restates the ask in the model's own words.
 */
export function buildEmbedText(recipe: {
  title: string;
  flavor_tags: string[];
  method: string | null;
  glass: string | null;
  ice: string | null;
  baseName: string | null;
  lines: {
    name: string;
    amount: number | null;
    unit: string | null;
    is_garnish: boolean;
    is_optional: boolean;
  }[];
  rationale: string | null;
}): string {
  const build = [
    recipe.method,
    recipe.glass,
    recipe.ice ? `${recipe.ice.replace('_', ' ')} ice` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const ingredients = recipe.lines
    .filter((line) => !line.is_garnish)
    .map((line) => {
      const qty =
        line.amount && line.amount > 0 ? ` ${line.amount} ${line.unit ?? ''}`.trimEnd() : '';
      return `${line.name}${qty}${line.is_optional ? ' (optional)' : ''}`;
    })
    .join(', ');

  return [
    `${recipe.title}.`,
    recipe.flavor_tags.length ? `${recipe.flavor_tags.join(', ')}.` : null,
    build ? `${build}.` : null,
    recipe.baseName ? `Base: ${recipe.baseName}.` : null,
    ingredients ? `Ingredients: ${ingredients}.` : null,
    recipe.rationale,
  ]
    .filter(Boolean)
    .join(' ');
}

// ── For the model ───────────────────────────────────────────────────────────

/** One line of prompt, with anything that could break the line or the framing removed. */
function oneLine(text: string, max: number): string {
  const flat = text.replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * The `{{LIBRARY}}` block: one sanitised line per recipe, ingredient slugs
 * (the model must answer in slugs), bracketed so the prompt can say where the
 * data starts and stops. `slugOf` resolves an ingredient id to its slug; lines
 * with no slug are rendered from their free text.
 */
export function formatLibraryBlock(
  hits: LibraryRow[],
  slugOf: (ingredientId: string) => string | null,
): string {
  if (hits.length === 0) return 'LIBRARY:\n(nothing similar on file yet)\nEND LIBRARY';

  const lines = hits.map((hit) => {
    const spec = hit.ingredients
      .filter((line) => !line.is_garnish)
      .map((line) => {
        const name = (line.ingredient_id && slugOf(line.ingredient_id)) || line.free_text || '?';
        const qty =
          line.amount_display && line.amount_display > 0
            ? ` ${line.amount_display} ${line.unit_display ?? ''}`.trimEnd()
            : '';
        return `${oneLine(name, 40)}${qty}${line.is_optional ? ' (optional)' : ''}`;
      })
      .join(', ');
    const build = [hit.method, hit.glass, hit.ice]
      .filter(Boolean)
      .map((part) => oneLine(String(part), 24))
      .join(', ');
    const tags = hit.flavor_tags
      .slice(0, 6)
      .map((tag) => oneLine(tag, 20))
      .join(', ');
    const garnish = hit.garnish ? `; garnish: ${oneLine(hit.garnish, 60)}` : '';
    const asked = `asked ${hit.times_suggested}×`;
    const head = [build, asked].filter(Boolean).join('; ');
    return `- ${oneLine(hit.title, 60)} (${head}${tags ? `; ${tags}` : ''}): ${spec}${garnish}`;
  });

  return ['LIBRARY (reference only):', ...lines, 'END LIBRARY'].join('\n');
}

// ── For the app ─────────────────────────────────────────────────────────────

/**
 * A library row as the exact draft `suggest-cocktails` returns for a fresh
 * model answer (see `toDraft` there), so the Ask screen renders and saves a
 * library answer through the same path. `ai_prompt` is *this* person's ask.
 */
export function libraryRowToDraft(row: LibraryRow, query: string) {
  return {
    title: row.title,
    rationale: row.rationale ?? '',
    source: 'ai' as const,
    glass: row.glass,
    method: row.method,
    ice: row.ice,
    garnish: row.garnish,
    instructions: row.instructions ?? [],
    notes: null,
    flavor_tags: row.flavor_tags ?? [],
    base_ingredient_id: row.base_ingredient_id,
    abv_estimate: row.abv_estimate,
    servings: row.servings > 0 ? row.servings : 1,
    ai_prompt: query,
    ai_model: row.ai_model,
    ingredients: [...(row.ingredients ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((line) => ({
        ingredient_id: line.ingredient_id,
        free_text: line.free_text,
        amount_ml: line.amount_ml,
        amount_display: line.amount_display,
        unit_display: line.unit_display,
        is_optional: line.is_optional,
        is_garnish: line.is_garnish,
        note: line.note,
      })),
  };
}
