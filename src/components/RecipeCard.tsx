import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { useColorForKind } from './CategoryPill';
import { Flourish, Heading, Muted } from './ui';
import { useIngredientIndex } from '../data/ingredients';
import { canMake, missingIngredients, type RecipeWithIngredients } from '../data/recipes';
import { useTheme, useThemedStyles } from '../providers/theme';
import { radius, spacing, typography, type Theme } from '../theme';

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colorForKind = useColorForKind();
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

      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Heading numberOfLines={2}>{recipe.title}</Heading>
          {lineNames.length > 0 ? <Muted numberOfLines={2}>{lineNames.join(' · ')}</Muted> : null}
        </View>
        {recipe.image_url ? (
          <Image
            source={{ uri: recipe.image_url }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>

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

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
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
