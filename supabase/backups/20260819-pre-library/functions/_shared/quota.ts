import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { json } from './http.ts';

/**
 * The two calls every AI function makes around its OpenAI request: one before,
 * to ask whether this person may spend another call this month, and one
 * after, to write down what it cost.
 *
 * Both are thin wrappers over SQL — `check_ai_quota` and the `ai_usage` table —
 * because the allowances live in `plan_limits` and the prices in `ai_models`,
 * both of which are tuned with an UPDATE. What has to be code is here: the
 * shape of the 402 the app looks for, and the token counts pulled off the
 * response.
 */

/** The `ai_prompts` / `plan_limits` key of the call site. */
export type QuotaKey = 'suggest_cocktails' | 'identify_bottles' | 'read_recipe' | 'classify_bottle';

export interface QuotaState {
  allowed: boolean;
  tier: 'free' | 'plus';
  used: number;
  /** Null when this call site is unlimited on this tier. */
  limit: number | null;
  remaining: number | null;
  /** ISO timestamp of the start of next month, UTC. */
  resets_at: string;
}

/**
 * The body of the 402 an exhausted allowance produces. The app switches on
 * `code`, so it must never change; the message is a fallback for a client
 * that does not know the code.
 */
export interface QuotaExceededBody {
  error: string;
  code: 'quota_exceeded';
  key: QuotaKey;
  quota: QuotaState;
}

/**
 * Returns null when the call may go ahead, or the 402 to send back when it may
 * not. A failed check (network, missing function) is logged and treated as
 * allowed: a metering hiccup should never make the app look broken.
 */
export async function checkQuota(
  admin: SupabaseClient,
  userId: string,
  key: QuotaKey,
): Promise<Response | null> {
  const { data, error } = await admin.rpc('check_ai_quota', { p_user_id: userId, p_key: key });
  if (error || !data) {
    console.error(`check_ai_quota failed for ${key}; allowing the call`, error);
    return null;
  }

  const quota = data as QuotaState;
  if (quota.allowed) return null;

  const body: QuotaExceededBody = {
    error: LIMIT_MESSAGES[key](quota),
    code: 'quota_exceeded',
    key,
    quota,
  };
  return json(body, 402);
}

/** The subset of an OpenAI Responses API `usage` object that is priced. */
export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { cached_tokens?: number };
}

/**
 * Writes one `ai_usage` row. Cost is filled in by the table's trigger from
 * `ai_models`, so it does not need to be known here. Fire-and-forget: a
 * failed write is logged, never surfaced — the answer has already cost what
 * it cost, and the person should still get it.
 */
export async function recordUsage(
  admin: SupabaseClient,
  row: {
    userId: string;
    key: QuotaKey;
    model: string;
    promptVersion: number;
    usage: TokenUsage | null | undefined;
    status: 'ok' | 'refused' | 'incomplete';
  },
): Promise<void> {
  const { error } = await admin.from('ai_usage').insert({
    user_id: row.userId,
    key: row.key,
    model: row.model,
    prompt_version: row.promptVersion,
    input_tokens: row.usage?.input_tokens ?? 0,
    cached_input_tokens: row.usage?.input_tokens_details?.cached_tokens ?? 0,
    output_tokens: row.usage?.output_tokens ?? 0,
    status: row.status,
  });
  if (error) console.error(`ai_usage insert failed for ${row.key}`, error);
}

const LIMIT_MESSAGES: Record<QuotaKey, (q: QuotaState) => string> = {
  suggest_cocktails: (q) =>
    q.tier === 'free'
      ? `That’s your ${q.limit} asks for this month. Flanagan Plus has plenty more.`
      : `You’ve reached this month’s ${q.limit} asks. They come back on the 1st.`,
  identify_bottles: (q) =>
    q.tier === 'free'
      ? `Shelf photos are ${q.limit === 1 ? 'one' : q.limit} a month on the free plan.`
      : `You’ve used this month’s ${q.limit} shelf photos.`,
  read_recipe: (q) =>
    q.tier === 'free'
      ? `Recipe photos are ${q.limit} a month on the free plan.`
      : `You’ve used this month’s ${q.limit} recipe photos.`,
  classify_bottle: () => 'That’s enough guessing for this month.',
};
