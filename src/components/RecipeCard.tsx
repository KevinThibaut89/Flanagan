import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colorForKind } from './CategoryPill';
import { Body, Heading, Muted } from './ui';
import { useIngredientIndex } from '../data/ingredients';
import { canMake, missingIngredients, type RecipeWithIngredients } from '../data/recipes';
import { colors, radius, spacing, typography } from '../theme';

/**
 * The summary of a recipe used in the library list and in AI results. It leads
 * with whether you can make it right now, because that is the question being
 * asked most of the time.
 */
export function RecipeCard({
  recipe,
  available,
}: {
  recipe: RecipeWithIngredients;
  available: Set<string>;
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
        <View style={styles.titleBlock}>
          <Heading numberOfLines={2}>{recipe.title}</Heading>
          {lineNames.length > 0 ? (
            <Muted numberOfLines={2}>{lineNames.join(' · ')}</Muted>
          ) : null}
        </View>

        {recipe.is_favorite ? (
          <MaterialCommunityIcons name="star" size={18} color={colors.warning} />
        ) : null}
      </View>

      <View style={styles.tagRow}>
        {makeable ? (
          <Tag label="Makeable now" color={colors.success} icon="check-circle-outline" />
        ) : (
          <Tag
            label={
              missing.length === 1 ? 'Missing 1 thing' : `Missing ${missing.length} things`
            }
            color={colors.textFaint}
            icon="cart-outline"
          />
        )}

        {base ? <Tag label={base.name} color={colorForKind(base.kind)} /> : null}

        {recipe.source === 'ai' ? <Tag label="Suggested" color={colors.accent} /> : null}

        {recipe.flavor_tags.slice(0, 2).map((tag) => (
          <Tag key={tag} label={tag} color={colors.textMuted} />
        ))}
      </View>
    </View>
  );
}

function Tag({
  label,
  color,
  icon,
}: {
  label: string;
  color: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) {
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={12} color={color} /> : null}
      <Body style={[styles.tagLabel, { color }]}>{label}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tagLabel: {
    ...typography.small,
    fontSize: 12,
    fontWeight: '600',
  },
});
