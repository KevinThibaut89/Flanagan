import type OpenAI from 'npm:openai@^6.9.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { recordUsage, type UsageKey } from './quota.ts';

/**
 * The one embedding model the recipe library uses.
 *
 * Unlike a prompt, this is code and not configuration: the width of the vector
 * is baked into `library_recipes.embedding` and into every stored row, so a
 * change is a migration and a re-embed, not an UPDATE. The model still has an
 * `ai_models` row so every call is priced, like everything else — with
 * is_allowed = false, so that no prompt can ever be pointed at it.
 */
export const EMBED_MODEL = 'text-embedding-3-small';
export const EMBED_DIMS = 1536;

/** Longer than any recipe document or ask; protects the token bill from junk. */
const MAX_INPUT_CHARS = 2000;

/**
 * Embeds a batch of texts in one call and records the spend as one `ai_usage`
 * row under `key`. Throws on failure: the callers decide what that means, and
 * for the library it never means failing the person's answer.
 */
export async function embedTexts(
  openai: OpenAI,
  admin: SupabaseClient,
  args: { userId: string; key: Extract<UsageKey, 'embed_query' | 'embed_recipe'>; texts: string[] },
): Promise<number[][]> {
  const input = args.texts.map(cleanForEmbedding);
  if (input.length === 0) return [];

  const response = await openai.embeddings.create({
    model: EMBED_MODEL,
    input,
    dimensions: EMBED_DIMS,
  });

  await recordUsage(admin, {
    userId: args.userId,
    key: args.key,
    model: EMBED_MODEL,
    promptVersion: null,
    usage: { input_tokens: response.usage?.prompt_tokens ?? 0, output_tokens: 0 },
    status: 'ok',
  });

  // The API returns embeddings in input order, but says so via `index`; sort
  // rather than trust.
  return response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

/** Whitespace folded, length capped. The embedding is of the words, not the layout. */
function cleanForEmbedding(text: string): string {
  const folded = text.replace(/\s+/g, ' ').trim();
  return folded.length > MAX_INPUT_CHARS ? folded.slice(0, MAX_INPUT_CHARS) : folded || ' ';
}
