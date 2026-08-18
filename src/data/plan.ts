import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth';
import type { PlanTier } from '../types/database';
import { queryKeys } from './keys';

/**
 * What plan the signed-in person is on and how much of this month's
 * allowances they have used — one round trip, from the `my_plan()` function.
 *
 * The allowances themselves live in `plan_limits` and are enforced inside the
 * edge functions, so nothing here decides whether a call is allowed; this is
 * for showing "4 asks left" and for the settings screen. The server always
 * has the last word.
 */

export type { PlanTier };

/** The `ai_prompts` keys that are metered. */
export type QuotaKey = 'suggest_cocktails' | 'identify_bottles' | 'read_recipe' | 'classify_bottle';

export interface Quota {
  used: number;
  /** Null means unlimited on this tier. */
  limit: number | null;
  remaining: number | null;
}

export interface Plan {
  tier: PlanTier;
  plus_expires_at: string | null;
  entitlement_source: 'revenuecat' | 'manual' | null;
  /** When this month's counters start again (ISO, UTC). */
  resets_at: string;
  quotas: Partial<Record<QuotaKey, Quota>>;
  /** Every tier's allowance, keyed `tier:key`, so the paywall can compare. */
  limits: Record<string, number | null>;
}

export function usePlan() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.plan(userId),
    enabled: Boolean(userId),
    queryFn: async (): Promise<Plan> => {
      const { data, error } = await supabase.rpc('my_plan');
      if (error) throw error;
      return data as unknown as Plan;
    },
  });
}

/** Invalidates the plan after any AI call, so the counters on screen move. */
export function useInvalidatePlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.plan(user?.id) });
}

// ── The 402 ─────────────────────────────────────────────────────────────────

/** What an edge function sends back when this month's allowance is used up. */
export interface QuotaExceededBody {
  error: string;
  code: 'quota_exceeded';
  key: QuotaKey;
  quota: Quota & { tier: PlanTier; resets_at: string };
}

/**
 * Thrown by the AI hooks in place of the generic FunctionsHttpError when the
 * server answered 402, so screens can offer the paywall instead of an error.
 */
export class QuotaExceededError extends Error {
  readonly key: QuotaKey;
  readonly quota: QuotaExceededBody['quota'];

  constructor(body: QuotaExceededBody) {
    super(body.error);
    this.name = 'QuotaExceededError';
    this.key = body.key;
    this.quota = body.quota;
  }
}

/**
 * Turns a `functions.invoke` error into a QuotaExceededError when that is what
 * it was, and returns the original otherwise. `context` is the raw Response,
 * whose body has not yet been read.
 */
export async function asQuotaError(error: unknown): Promise<unknown> {
  if (!(error instanceof FunctionsHttpError)) return error;
  const response = error.context as Response | undefined;
  if (!response || response.status !== 402) return error;
  try {
    const body = (await response.json()) as Partial<QuotaExceededBody>;
    if (body.code === 'quota_exceeded' && body.key && body.quota && body.error) {
      return new QuotaExceededError(body as QuotaExceededBody);
    }
  } catch {
    // Not our shape; fall through to the original error.
  }
  return error;
}

export function isQuotaExceeded(error: unknown): error is QuotaExceededError {
  return error instanceof QuotaExceededError;
}

/** "4 asks left this month" — null when the key is unlimited on this tier. */
export function remainingLabel(quota: Quota | undefined, noun: string): string | null {
  if (!quota || quota.limit === null || quota.remaining === null) return null;
  const n = quota.remaining;
  if (n === 0) return `No ${noun}s left this month`;
  return `${n} ${n === 1 ? noun : `${noun}s`} left this month`;
}
