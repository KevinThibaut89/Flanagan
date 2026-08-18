import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Button } from '../../src/components/Button';
import { ConfirmSheet } from '../../src/components/ConfirmSheet';
import { RecipeIngredientList } from '../../src/components/RecipeIngredientList';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import {
  Body,
  Card,
  ErrorState,
  Flourish,
  Label,
  Loading,
  Muted,
  OrnamentRule,
  PressableScale,
  Screen,
} from '../../src/components/ui';
import { useAvailableIngredientIds } from '../../src/data/bottles';
import {
  canMake,
  missingIngredients,
  recipeNumbers,
  useDeleteRecipe,
  useRecipe,
  useRecipes,
  useToggleFavorite,
} from '../../src/data/recipes';
import { useIngredientIndex } from '../../src/data/ingredients';
import { useTheme, useThemedStyles } from '../../src/providers/theme';
import { spacing, typography, type Theme } from '../../src/theme';
import type { RecipeIce, RecipeMethod } from '../../src/types/database';

const METHOD_LABELS: Record<RecipeMethod, string> = {
  shake: 'Shake',
  stir: 'Stir',
  build: 'Build in glass',
  blend: 'Blend',
  throw: 'Throw',
  swizzle: 'Swizzle',
  muddle: 'Muddle',
};

const ICE_LABELS: Record<RecipeIce, string> = {
  none: 'No ice',
  cubed: 'Cubed ice',
  crushed: 'Crushed ice',
  large_cube: 'One large cube',
  block: 'Block ice',
};

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { data: recipe, isLoading, error, refetch } = useRecipe(id);
  const { data: allRecipes } = useRecipes();
  const available = useAvailableIngredientIds();
  const { index } = useIngredientIndex();
  const toggleFavorite = useToggleFavorite();
  const deleteRecipe = useDeleteRecipe();

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const number = useMemo(
    () => recipeNumbers(allRecipes ?? []).get(id),
    [allRecipes, id],
  );

  // The header stays mounted while the body loads, so opening a recipe
  // doesn't jump the whole layout when the fetch lands.
  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Recipe" />
        <Loading />
      </Screen>
    );
  }
  if (error || !recipe) {
    return (
      <Screen>
        <ScreenHeader title="Recipe" />
        <ErrorState
          error={error ?? new Error('That recipe no longer exists.')}
          action={<Button label="Try again" onPress={() => refetch()} />}
        />
      </Screen>
    );
  }

  const makeable = canMake(recipe, available);
  const missing = missingIngredients(recipe, available);
  const base = recipe.base_ingredient_id ? index?.byId.get(recipe.base_ingredient_id) : null;

  const specs = [
    recipe.method ? METHOD_LABELS[recipe.method] : null,
    recipe.glass,
    recipe.ice ? ICE_LABELS[recipe.ice] : null,
    recipe.servings > 1 ? `Serves ${recipe.servings}` : null,
    recipe.abv_estimate !== null ? `~${recipe.abv_estimate}% ABV` : null,
  ].filter(Boolean) as string[];

  const subtitle = [
    number !== undefined ? `No. ${number}` : null,
    base ? `${base.name} based` : recipe.source === 'ai' ? 'Suggested' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={recipe.title}
        subtitle={subtitle || undefined}
        action={
          <PressableScale
            onPress={() => {
              void Haptics.selectionAsync();
              toggleFavorite.mutate({ id, isFavorite: !recipe.is_favorite });
            }}
            hitSlop={8}
            accessibilityLabel={recipe.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <MaterialCommunityIcons
              name={recipe.is_favorite ? 'star' : 'star-outline'}
              size={22}
              color={recipe.is_favorite ? colors.cream : colors.textFaint}
            />
          </PressableScale>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.verdict}>
          <MaterialCommunityIcons
            name={makeable ? 'check-circle-outline' : 'cart-outline'}
            size={20}
            color={makeable ? colors.success : colors.textMuted}
          />
          <Body style={styles.verdictText}>
            {makeable
              ? 'You can make this right now.'
              : missing.length === 1
                ? 'You’re one ingredient short.'
                : `You’re short ${missing.length} ingredients.`}
          </Body>
        </Card>

        {specs.length > 0 ? <Muted>{specs.join(' · ')}</Muted> : null}

        <View style={styles.section}>
          <Label>Ingredients</Label>
          <RecipeIngredientList lines={recipe.recipe_ingredients} available={available} />
        </View>

        {recipe.instructions.length > 0 ? (
          <>
            <OrnamentRule />
            <View style={styles.section}>
              <Label>Method</Label>
              {recipe.instructions.map((step, i) => (
                <View key={`${i}-${step.slice(0, 12)}`} style={styles.step}>
                  <Text style={styles.stepNumber}>{i + 1}.</Text>
                  <Body style={styles.stepText}>{step}</Body>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {recipe.garnish ? (
          <View style={styles.section}>
            <Label>Garnish</Label>
            <Body>{recipe.garnish}</Body>
          </View>
        ) : null}

        {recipe.notes ? (
          <View style={styles.section}>
            <Label>Notes</Label>
            <Body>{recipe.notes}</Body>
          </View>
        ) : null}

        {recipe.flavor_tags.length > 0 ? (
          <View style={styles.section}>
            <Label>Tastes like</Label>
            <Body>{recipe.flavor_tags.join(', ')}</Body>
          </View>
        ) : null}

        {recipe.ai_prompt ? (
          <View style={styles.section}>
            <Label>You asked for</Label>
            <Flourish style={styles.quote}>“{recipe.ai_prompt}”</Flourish>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Edit"
            variant="secondary"
            onPress={() => router.push({ pathname: '/recipe/new', params: { editId: id } })}
          />
          <Button label="Delete recipe" variant="ghost" onPress={() => setConfirmingDelete(true)} />
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirmingDelete}
        title="Delete this recipe?"
        message="It leaves the notebook for good — this cannot be undone."
        confirmLabel="Delete"
        busy={deleteRecipe.isPending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() =>
          deleteRecipe.mutate(id, {
            onSuccess: () => {
              setConfirmingDelete(false);
              if (router.canGoBack()) router.back();
              else router.replace('/recipes');
            },
          })
        }
      />
    </Screen>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  content: {
    padding: spacing.gutter,
    gap: spacing.lg,
    paddingBottom: spacing.section + spacing.xl,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  verdictText: {
    flex: 1,
  },
  section: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    ...typography.serifBody,
    width: 22,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  stepText: {
    flex: 1,
  },
  quote: {
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
