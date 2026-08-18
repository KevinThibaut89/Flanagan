import { createClient } from 'npm:@supabase/supabase-js@2';

import { json } from '../_shared/http.ts';

/**
 * Turns a RevenueCat event into `profiles.tier`.
 *
 * This is the only writer of the tier columns. The app never declares itself
 * Plus — it cannot be trusted to — and the edge functions meter against what
 * is in the profile, so a purchase counts for nothing until this has run.
 * RevenueCat delivers within seconds and retries on anything but a 2xx.
 *
 * Auth is a shared secret in the Authorization header, set on the webhook in
 * the RevenueCat dashboard and as REVENUECAT_WEBHOOK_SECRET on this function.
 * The function is deployed with JWT verification off, because RevenueCat has
 * no Supabase JWT to send.
 *
 * The RevenueCat app user id is the Supabase user id (the app configures the
 * SDK that way), so `app_user_id` is the profile key. Anonymous ids
 * ($RCAnonymousID:…) can appear in `aliases` after a restore; the first
 * uuid-shaped id wins.
 *
 * Event reference: https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
 */

/** The one entitlement that means Plus. Must match the RevenueCat dashboard. */
const ENTITLEMENT_ID = 'Flanagan Plus';

/** Events after which the person holds the entitlement. */
const GRANTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE', // the lifetime product
  'TRANSFER', // to this user, from another
]);

/** Events that only move the expiry; access continues to the period end. */
const KEEPS = new Set(['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_EXTENDED']);

/** Events after which the person no longer holds it. */
const REVOKES = new Set(['EXPIRATION']);

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  transferred_to?: string[];
  transferred_from?: string[];
  environment?: string;
  id?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstUserId(candidates: Array<string | undefined>): string | null {
  for (const id of candidates) if (id && UUID.test(id)) return id;
  return null;
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) {
    console.error('REVENUECAT_WEBHOOK_SECRET is not set');
    return json({ error: 'Webhook is not configured.' }, 500);
  }
  const auth = request.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${secret}` && auth !== secret) {
    return json({ error: 'Unauthorized.' }, 401);
  }

  let event: RevenueCatEvent;
  try {
    const body = await request.json();
    event = (body?.event ?? {}) as RevenueCatEvent;
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const type = event.type ?? '';
  const entitlements = event.entitlement_ids ?? [];
  const affectsPlus = entitlements.includes(ENTITLEMENT_ID);

  // A TRANSFER names both sides and carries no entitlement list; anything else
  // that does not mention our entitlement is a test ping or another product.
  if (type !== 'TRANSFER' && !affectsPlus) {
    console.log(`revenuecat-webhook: ${type} ignored (entitlements: ${entitlements.join(',') || 'none'})`);
    return json({ handled: false, reason: 'not our entitlement' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const now = new Date().toISOString();
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

  async function setTier(userId: string, tier: 'free' | 'plus', expiry: string | null) {
    const { error } = await admin
      .from('profiles')
      .update({
        tier,
        plus_expires_at: expiry,
        entitlement_source: 'revenuecat',
        entitlement_updated_at: now,
      })
      .eq('id', userId);
    if (error) throw error;
  }

  try {
    if (type === 'TRANSFER') {
      // Entitlement moved between accounts (a restore on a new login).
      const from = firstUserId(event.transferred_from ?? []);
      const to = firstUserId(event.transferred_to ?? []);
      if (from) await setTier(from, 'free', null);
      if (to) await setTier(to, 'plus', expiresAt);
      console.log(`revenuecat-webhook: TRANSFER ${from ?? '?'} → ${to ?? '?'}`);
      return json({ handled: true, from, to });
    }

    const userId = firstUserId([event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])]);
    if (!userId) {
      console.warn(`revenuecat-webhook: ${type} for non-uuid user ${event.app_user_id}`);
      return json({ handled: false, reason: 'no supabase user id' });
    }

    if (GRANTS.has(type)) {
      await setTier(userId, 'plus', expiresAt);
    } else if (REVOKES.has(type)) {
      await setTier(userId, 'free', null);
    } else if (KEEPS.has(type)) {
      // Keep whatever tier they hold; only the expiry is news. effective_tier()
      // flips them to free by itself once that date passes.
      const { error } = await admin
        .from('profiles')
        .update({ plus_expires_at: expiresAt, entitlement_updated_at: now })
        .eq('id', userId);
      if (error) throw error;
    } else {
      console.log(`revenuecat-webhook: ${type} noted, no change`);
      return json({ handled: false, reason: 'no-op event' });
    }

    console.log(`revenuecat-webhook: ${type} → ${userId} (${event.environment ?? '?'}) expires ${expiresAt ?? 'never'}`);
    return json({ handled: true, type, user_id: userId });
  } catch (cause) {
    // A 5xx makes RevenueCat retry, which is what a transient DB error wants.
    console.error('revenuecat-webhook: update failed', cause);
    return json({ error: 'Could not update the profile.' }, 500);
  }
});
