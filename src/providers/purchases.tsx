import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { NativeModules } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { queryKeys } from '../data/keys';
import { ENTITLEMENT_ID, REVENUECAT_API_KEY } from '../lib/revenuecat';
import { useAuth } from './auth';

/**
 * RevenueCat, wired to the signed-in user.
 *
 * Two facts about the same person live in two places, on purpose:
 *
 * - `isPlus` here comes from RevenueCat's CustomerInfo and updates the instant
 *   a purchase completes. It drives what the UI says.
 * - `profiles.tier` in Postgres is set by RevenueCat's webhook, and is what the
 *   edge functions meter against. It lags the purchase by a few seconds.
 *
 * The app cannot be trusted to declare itself Plus, so the server never asks
 * it; the webhook is the source of truth for money, and this provider is the
 * fast path for the screen. After a purchase, `usePlan()` is refetched on a
 * short backoff so the two agree as soon as the webhook lands.
 *
 * The RevenueCat app user id is the Supabase user id, so the webhook can find
 * the profile without a lookup table.
 */

/**
 * Whether the native RevenueCat modules are in this binary. They are not in
 * Expo Go: the SDK then falls back to a browser-mode shim that needs a DOM,
 * and presenting the paywall throws "document is not available". Nothing to
 * be done about it in JS — purchases want a development build
 * (`npx expo run:ios`) — so the provider says so instead of trying.
 */
const NATIVE_PURCHASES_AVAILABLE = Boolean(NativeModules.RNPurchases);
const NATIVE_PAYWALLS_AVAILABLE = Boolean(NativeModules.RNPaywalls);

interface PurchasesValue {
  /**
   * False when purchases cannot happen in this build: no native module (Expo
   * Go), no API key, or the SDK failed to start. `unavailableReason` says which.
   */
  available: boolean;
  unavailableReason: string | null;
  /** True until the first CustomerInfo has arrived. */
  loading: boolean;
  isPlus: boolean;
  customerInfo: CustomerInfo | null;
  /** RevenueCat's hosted paywall for the current offering. */
  presentPaywall: () => Promise<PaywallOutcome>;
  /** The paywall, only if the person is not already Plus. */
  presentPaywallIfNeeded: () => Promise<PaywallOutcome>;
  /**
   * RevenueCat's Customer Center: manage, cancel, restore, ask for a refund.
   * Presents from the root view controller, so it does nothing when called
   * from a screen that is itself a modal — use the /manage route from those.
   */
  presentCustomerCenter: () => Promise<void>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export type PaywallOutcome = 'purchased' | 'restored' | 'cancelled' | 'not_needed' | 'error';

const PurchasesContext = createContext<PurchasesValue | null>(null);

/** How long to keep asking the server whether the webhook has landed. */
const PLAN_SYNC_DELAYS_MS = [1500, 3000, 6000, 12000];

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const [available, setAvailable] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const configured = useRef(false);

  // ── Configure once, identify on every user change ─────────────────────────
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function setUp() {
      try {
        if (!NATIVE_PURCHASES_AVAILABLE || !NATIVE_PAYWALLS_AVAILABLE) {
          setUnavailableReason(
            'Purchases need the development build — Expo Go cannot show the store.',
          );
          setAvailable(false);
          setLoading(false);
          return;
        }
        if (!REVENUECAT_API_KEY) {
          console.warn('EXPO_PUBLIC_REVENUECAT_API_KEY is not set; purchases are off.');
          setUnavailableReason('Purchases are not configured in this build.');
          setAvailable(false);
          setLoading(false);
          return;
        }

        if (!configured.current) {
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
          Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId! });
          configured.current = true;
        } else {
          // Same SDK, different person: alias the new id rather than reconfigure.
          await Purchases.logIn(userId!);
        }

        const info = await Purchases.getCustomerInfo();
        if (cancelled) return;
        setCustomerInfo(info);
        setAvailable(true);
      } catch (cause) {
        console.warn('RevenueCat could not start', cause);
        if (!cancelled) {
          setAvailable(false);
          setUnavailableReason('The store could not be reached. Try again in a moment.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void setUp();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Sign-out: forget the person so the next sign-in does not inherit them.
  useEffect(() => {
    if (userId || !configured.current) return;
    setCustomerInfo(null);
    Purchases.logOut().catch(() => {
      // Already anonymous, or the SDK is not up: nothing to undo.
    });
  }, [userId]);

  // Purchases, renewals and expirations arrive here whenever the SDK learns
  // of them — including ones made on another device.
  useEffect(() => {
    if (!available) return;
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [available]);

  // ── Keep the server's view in step after a purchase ───────────────────────
  const syncPlan = useCallback(async () => {
    if (!userId) return;
    for (const delay of PLAN_SYNC_DELAYS_MS) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      await queryClient.invalidateQueries({ queryKey: queryKeys.plan(userId) });
      const plan = queryClient.getQueryData<{ tier?: string }>(queryKeys.plan(userId));
      if (plan?.tier === 'plus') return;
    }
  }, [queryClient, userId]);

  const isPlus = Boolean(customerInfo?.entitlements.active[ENTITLEMENT_ID]);

  const value = useMemo<PurchasesValue>(
    () => ({
      available,
      unavailableReason,
      loading,
      isPlus,
      customerInfo,

      async presentPaywall() {
        if (!available) return 'error';
        try {
          const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });
          return afterPaywall(result, syncPlan);
        } catch (cause) {
          console.warn('Paywall failed', cause);
          return 'error';
        }
      },

      async presentPaywallIfNeeded() {
        if (!available) return 'error';
        try {
          const result = await RevenueCatUI.presentPaywallIfNeeded({
            requiredEntitlementIdentifier: ENTITLEMENT_ID,
            displayCloseButton: true,
          });
          return afterPaywall(result, syncPlan);
        } catch (cause) {
          console.warn('Paywall failed', cause);
          return 'error';
        }
      },

      async presentCustomerCenter() {
        if (!available) return;
        try {
          await RevenueCatUI.presentCustomerCenter();
          // Anything the person did in there — a cancellation, a restore — is
          // reflected in CustomerInfo, and eventually in the webhook.
          setCustomerInfo(await Purchases.getCustomerInfo());
          void syncPlan();
        } catch (cause) {
          console.warn('Customer Center failed', cause);
        }
      },

      async restore() {
        if (!available) return false;
        try {
          const info = await Purchases.restorePurchases();
          setCustomerInfo(info);
          const restored = Boolean(info.entitlements.active[ENTITLEMENT_ID]);
          if (restored) void syncPlan();
          return restored;
        } catch (cause) {
          if (!isCancelled(cause)) console.warn('Restore failed', cause);
          return false;
        }
      },

      async refresh() {
        if (!available) return;
        try {
          setCustomerInfo(await Purchases.getCustomerInfo());
        } catch (cause) {
          console.warn('CustomerInfo refresh failed', cause);
        }
      },
    }),
    [available, unavailableReason, loading, isPlus, customerInfo, syncPlan],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

function afterPaywall(result: PAYWALL_RESULT, syncPlan: () => Promise<void>): PaywallOutcome {
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      void syncPlan();
      return 'purchased';
    case PAYWALL_RESULT.RESTORED:
      void syncPlan();
      return 'restored';
    case PAYWALL_RESULT.NOT_PRESENTED:
      return 'not_needed';
    case PAYWALL_RESULT.CANCELLED:
      return 'cancelled';
    default:
      return 'error';
  }
}

function isCancelled(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as Partial<PurchasesError>).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

export function usePurchases(): PurchasesValue {
  const value = useContext(PurchasesContext);
  if (!value) throw new Error('usePurchases must be used inside <PurchasesProvider>');
  return value;
}
