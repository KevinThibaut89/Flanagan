import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Body, Muted } from './ui';
import { useIngredientIndex } from '../data/ingredients';
import { formatAmount, isTopUp } from '../lib/units';
import { useUnits } from '../providers/preferences';
import { colors, spacing } from '../theme';
import type { RecipeIngredient } from '../types/database';

/**
 * The ingredient lines of a recipe, each marked with whether you have it.
 *
 * The have/missing marks are the point of the screen: they turn a recipe from
 * something to read into something to act on. Garnishes and optional lines are
 * shown but never marked missing — no one is short of a drink because they have
 * no orange peel.
 */
export function RecipeIngredientList({
  lines,
  available,
}: {
  lines: RecipeIngredient[];
  available: Set<string>;
}) {
  const { index } = useIngredientIndex();
  const units = useUnits();

  return (
    <View style={styles.list}>
      {lines.map((line) => {
        const ingredient = line.ingredient_id ? index?.byId.get(line.ingredient_id) : null;
        const name = ingredient?.name ?? line.free_text ?? 'Something';
        const amount = formatAmount(line, units);

        const required = !line.is_optional && !line.is_garnish;
        const have = line.ingredient_id !== null && available.has(line.ingredient_id);
        const short = required && !have;

        return (
          <View key={line.id} style={styles.row}>
            <View style={styles.mark}>
              {required ? (
                <Icon
                  name={have ? 'check' : 'close'}
                  size={16}
                  color={have ? colors.success : colors.danger}
                />
              ) : (
                <Icon name="bullet" size={6} color={colors.textFaint} />
              )}
            </View>

            <Body style={styles.amount}>{amount ?? (isTopUp(line) ? 'Top' : '')}</Body>

            <View style={styles.nameBlock}>
              <Body style={short ? styles.nameShort : undefined}>{name}</Body>
              {line.note ? <Muted>{line.note}</Muted> : null}
            </View>

            {line.is_optional ? <Muted style={styles.qualifier}>optional</Muted> : null}
            {line.is_garnish ? <Muted style={styles.qualifier}>garnish</Muted> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  mark: {
    width: 18,
    paddingTop: 2,
    alignItems: 'center',
  },
  amount: {
    width: 72,
    color: colors.accentSoft,
    fontVariant: ['tabular-nums'],
  },
  nameBlock: {
    flex: 1,
    gap: 1,
  },
  nameShort: {
    color: colors.textMuted,
  },
  qualifier: {
    fontSize: 11,
    color: colors.textFaint,
  },
});
