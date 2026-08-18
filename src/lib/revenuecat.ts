/**
 * The names RevenueCat knows Flanagan by. These must match the dashboard
 * exactly — an entitlement identifier is a string compared byte for byte, and
 * a typo here would silently mean nobody is ever Plus.
 *
 * The API key is public by design (it identifies the app, not a person). A
 * Test Store key (`test_…`) drives RevenueCat's simulated store, which is what
 * runs in Expo Go and dev builds; the App Store and Play keys replace it in
 * the store build profiles.
 */

/** The single entitlement that unlocks the paid allowances. */
export const ENTITLEMENT_ID = 'Flanagan Plus';

/** Product identifiers, as configured in the store(s) and RevenueCat. */
export const PRODUCT_IDS = {
  lifetime: 'lifetime',
  yearly: 'yearly',
  monthly: 'monthly',
} as const;

/** The offering whose paywall the app presents. */
export const OFFERING_ID = 'default';

export const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
