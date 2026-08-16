import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { RecipeIngredientList } from '../../src/components/RecipeIngredientList';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Body, Divider, ErrorState, Label, Loading, Muted, Screen } from '../../src/components/ui';
import { useAvailableIngredientIds } from '../../src/data/bottles';
import {
  canMake,
  missingIngredients,
  useDeleteRecipe,
  useRecipe,
  useToggleFavorite,
} from '../../src/data/recipes';
import { useIngredientIndex } from '../../src/data/ingredients';
import { colors, radius, spacing } from '../../src/theme';
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

  const { data: recipe, isLoading, error, refetch } = useRecipe(id);
  const available = useAvailableIngredientIds();
  const { index } = useIngredientIndex();
  const toggleFavorite = useToggleFavorite();
  const deleteRecipe = useDeleteRecipe();

  if (isLoading) return <Loading />;
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

  function confirmDelete() {
    Alert.alert('Delete this recipe?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteRecipe.mutate(id, {
            onSuccess: () => {
              if (router.canGoBack()) router.back();
              else router.replace('/recipes');
            },
          }),
      },
    ]);
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={recipe.title}
        subtitle={base ? `${base.name} based` : recipe.source === 'ai' ? 'Suggested' : undefined}
        action={
          <Pressable
            onPress={() => toggleFavorite.mutate({ id, isFavorite: !recipe.is_favorite })}
            hitSlop={10}
            accessibilityLabel={recipe.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            <MaterialCommunityIcons
              name={recipe.is_favorite ? 'star' : 'star-outline'}
              size={22}
              color={recipe.is_favorite ? colors.warning : colors.textMuted}
            />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.verdict,
            { borderColor: makeable ? colors.success : colors.border },
          ]}
        >
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
        </View>

        {specs.length > 0 ? <Muted>{specs.join(' · ')}</Muted> : null}

        <View style={styles.section}>
          <Label>Ingredients</Label>
          <RecipeIngredientList lines={recipe.recipe_ingredients} available={available} />
        </View>

        {recipe.instructions.length > 0 ? (
          <>
            <Divider />
            <View style={styles.section}>
              <Label>Method</Label>
              {recipe.instructions.map((step, i) => (
                <View key={`${i}-${step.slice(0, 12)}`} style={styles.step}>
                  <Body style={styles.stepNumber}>{i + 1}</Body>
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
            <Muted style={styles.quote}>“{recipe.ai_prompt}”</Muted>
          </View>
        ) : null}

        <Divider />

        <Button
          label="Edit"
          variant="secondary"
          onPress={() => router.push({ pathname: '/recipe/new', params: { editId: id } })}
        />
        <Button label="Delete recipe" variant="danger" onPress={confirmDelete} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: colors.surface,
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
    width: 18,
    color: colors.accent,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
  },
  quote: {
    fontStyle: 'italic',
  },
});
