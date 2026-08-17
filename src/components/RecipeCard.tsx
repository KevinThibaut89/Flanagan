import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colorForKind } from './CategoryPill';
import { Flourish, Heading, Muted } from './ui';
import { useIngredientIndex } from '../data/ingredients';
import { canMake, missingIngredients, type RecipeWithIngredients } from '../data/recipes';
import { colors, radius, spacing, typography } from '../theme';

/**
 * The summary of a recipe used in the library list. It reads like a menu
 * entry — number, name, what goes in it — and leads with whether you can make
 * it right now, because that is the question being asked most of the time.
 */
export function RecipeCard({
  recipe,
  available,
  number,
}: {
  recipe: RecipeWithIngredients;
  available: Set<string>;
  number?: number;
}) {
  const { index } = useIngredientIndex();

  const makeable = canMake(recipe, available);
  const missing = missingIngredients(recipe, available);

  const base = recipe.base_ingredient_id ? index?.byId.get(recipe.base_ingredient_id) : null;

  const lineNames = recipe.recipe_ingredients
    .filter((line) => !line.is_garnish)
    .map((line) => (line.ingredient_id ? index?.byId.get(line.ingredient_id)?.name : null) ?? line.free_text)
    .filter((name): name is string => Boolean(name));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        {number !== undefined ? (
          <Flourish style={styles.number}>No. {number}</Flourish>
        ) : (
          <View />
        )}
        {recipe.is_favorite ? (
          <MaterialCommunityIcons name="star" size={14} color={colors.cream} />
        ) : null}
      </View>

      <Heading numberOfLines={2}>{recipe.title}</Heading>
      {lineNames.length > 0 ? <Muted numberOfLines={2}>{lineNames.join(' · ')}</Muted> : null}

      <View style={styles.footer}>
        {makeable ? (
          <Text style={styles.makeable}>Makeable now</Text>
        ) : (
          <Text style={styles.missing}>
            Missing {missing.length} {missing.length === 1 ? 'thing' : 'things'}
          </Text>
        )}

        {base ? (
          <View style={styles.baseTag}>
            <View style={[styles.baseDot, { backgroundColor: colorForKind(base.kind) }]} />
            <Text style={styles.footerMeta}>{base.name}</Text>
          </View>
        ) : null}

        {recipe.source === 'ai' ? <Text style={styles.footerMeta}>Suggested</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  number: {
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  makeable: {
    ...typography.small,
    fontWeight: '600',
    color: colors.success,
  },
  missing: {
    ...typography.small,
    color: colors.textFaint,
  },
  baseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  baseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  footerMeta: {
    ...typography.small,
    color: colors.textMuted,
  },
});
