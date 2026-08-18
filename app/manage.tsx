import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import RevenueCatUI from 'react-native-purchases-ui';

import { usePurchases } from '../src/providers/purchases';
import { useTheme } from '../src/providers/theme';

/**
 * RevenueCat's Customer Center — manage, change plan, restore, ask for a
 * refund — as a screen of our own.
 *
 * The SDK's `presentCustomerCenter()` presents from the app's *root* view
 * controller, and Settings is itself a modal, so UIKit refuses the second
 * presentation and nothing appears. The paywall presenter walks up to the top
 * of the presented stack; the customer center one does not. Embedding the view
 * in a route sidesteps that: expo-router does the presenting.
 */
export default function ManageSubscriptionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { refresh } = usePurchases();

  function close() {
    // Anything done in there (a cancellation, a restore) is in CustomerInfo now.
    void refresh();
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <RevenueCatUI.CustomerCenterView style={styles.screen} onDismiss={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
