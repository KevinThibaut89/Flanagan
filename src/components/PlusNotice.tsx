import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Button } from './Button';
import { Body, Flourish, Muted } from './ui';
import { usePlan, type QuotaExceededError } from '../data/plan';
import { usePurchases } from '../providers/purchases';
import { useTheme, useThemedStyles } from '../providers/theme';
import { spacing, type Theme } from '../theme';

/**
 * What a screen shows in place of an error when the month's allowance is used
 * up: the server's line about it, and the way to Plus. On Plus already (the
 * cap is a fair-use ceiling nobody real meets) it just says when things reset.
 *
 * `onUnlocked` runs after a purchase or restore, so the screen can retry what
 * the person was doing rather than make them tap again.
 */
export function PlusNotice({
  error,
  onUnlocked,
}: {
  error: QuotaExceededError;
  onUnlocked?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { available, unavailableReason, isPlus, presentPaywall } = usePurchases();
  const { data: plan } = usePlan();

  const resets = new Date(error.quota.resets_at);
  const resetLine = `Back on ${resets.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`;
  const alreadyPlus = isPlus || error.quota.tier === 'plus';

  async function upgrade() {
    const outcome = await presentPaywall();
    if (outcome === 'purchased' || outcome === 'restored') onUnlocked?.();
  }

  return (
    <View style={styles.notice}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="glass-cocktail" size={18} color={colors.accent} />
        <Body style={styles.text}>{error.message}</Body>
      </View>
      {alreadyPlus ? (
        <Muted>{resetLine}</Muted>
      ) : (
        <>
          <Flourish style={styles.pitch}>{plusPitch(plan?.limits)}</Flourish>
          {available ? (
            <Button label="Get Flanagan Plus" onPress={() => void upgrade()} />
          ) : (
            <Muted>
              {unavailableReason ?? 'Plus is not available in this build.'} {resetLine}
            </Muted>
          )}
        </>
      )}
    </View>
  );
}

/**
 * "Plus has 150 asks a month, 20 shelf photos and 25 recipe pages." — read
 * from plan_limits, so the line moves when the numbers do.
 */
function plusPitch(limits: Record<string, number | null> | undefined): string {
  const asks = limits?.['plus:suggest_cocktails'];
  const shelves = limits?.['plus:identify_bottles'];
  const pages = limits?.['plus:read_recipe'];
  if (asks == null && shelves == null && pages == null) {
    return 'Plus has room for every night of the month.';
  }
  const parts = [
    asks == null ? 'unlimited asks' : `${asks} asks a month`,
    shelves == null ? 'unlimited shelf photos' : `${shelves} shelf photos`,
    pages == null ? 'unlimited recipe pages' : `${pages} recipe pages`,
  ];
  return `Plus has ${parts[0]}, ${parts[1]} and ${parts[2]}.`;
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    notice: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: 12,
      backgroundColor: colors.surface,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    text: {
      flex: 1,
    },
    pitch: {
      color: colors.textMuted,
    },
  });
