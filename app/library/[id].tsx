import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Button } from '../../src/components/Button';
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
  Screen,
} from '../../src/components/ui';
import { useAvailableIngredientIds } from '../../src/data/bottles';
import { useIngredientIndex } from '../../src/data/ingredients';
import { libraryToDraft, libraryToPreview, useLibraryRecipe } from '../../src/data/library';
import { canMake, missingIngredients, useSaveRecipe } from '../../src/data/recipes';
import { ICE_LABELS, METHOD_LABELS } from '../../src/lib/recipeLabels';
import { useTheme, useThemedStyles } from '../../src/providers/theme';
import { spacing, typography, type Theme } from '../../src/theme';

/**
 * One page of the house book. The same anatomy as a saved recipe's page,
 * minus what only an owner can do (favourite, edit, delete, photo), plus the
 * one thing a reader wants: put it in my notebook.
 */
export default function LibraryRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const { data: row, isLoading, error, refetch } = useLibraryRecipe(id);
  const available = useAvailableIngredientIds();
  const { index } = useIngredientIndex();
  const saveRecipe = useSaveRecipe();
  const [savedId, setSavedId] = useState<string | null>(null);

  const preview = useMemo(() => (row ? libraryToPreview(row) : null), [row]);

  if (isLoading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="House book" />
        <Loading />
      </Screen>
    );
  }
  if (error || !row || !preview) {
    return (
      <Screen>
        <ScreenHeader title="House book" />
        <ErrorState
          error={error ?? new Error('That page is missing from the book.')}
          action={<Button label="Try again" onPress={() => refetch()} />}
        />
      </Screen>
    );
  }

  const makeable = canMake(preview, available);
  const missing = missingIngredients(preview, available);
  const base = row.base_ingredient_id ? index?.byId.get(row.base_ingredient_id) : null;

  const specs = [
    row.method ? METHOD_LABELS[row.method] : null,
    row.glass,
    row.ice ? ICE_LABELS[row.ice] : null,
    row.servings > 1 ? `Serves ${row.servings}` : null,
    row.abv_estimate !== null ? `~${row.abv_estimate}% ABV` : null,
  ].filter(Boolean) as string[];

  const subtitle = [
    base ? `${base.name} based` : null,
    row.times_suggested > 1 ? `asked ${row.times_suggested} times` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={row.title} subtitle={subtitle || undefined} />

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

        {row.rationale ? (
          <View style={styles.section}>
            <Label>Barkeep’s note</Label>
            <Flourish style={styles.quote}>{row.rationale}</Flourish>
          </View>
        ) : null}

        <View style={styles.section}>
          <Label>Ingredients</Label>
          <RecipeIngredientList lines={preview.recipe_ingredients} available={available} />
        </View>

        {row.instructions.length > 0 ? (
          <>
            <OrnamentRule />
            <View style={styles.section}>
              <Label>Method</Label>
              {row.instructions.map((step, i) => (
                <View key={`${i}-${step.slice(0, 12)}`} style={styles.step}>
                  <Text style={styles.stepNumber}>{i + 1}.</Text>
                  <Body style={styles.stepText}>{step}</Body>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {row.garnish ? (
          <View style={styles.section}>
            <Label>Garnish</Label>
            <Body>{row.garnish}</Body>
          </View>
        ) : null}

        {row.flavor_tags.length > 0 ? (
          <View style={styles.section}>
            <Label>Tastes like</Label>
            <Body>{row.flavor_tags.join(', ')}</Body>
          </View>
        ) : null}

        <View style={styles.actions}>
          {savedId ? (
            <Button
              label="Saved — open it"
              variant="secondary"
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: savedId } })}
            />
          ) : (
            <Button
              label="Save to my recipes"
              onPress={() =>
                saveRecipe.mutate(libraryToDraft(row), { onSuccess: (saved) => setSavedId(saved.id) })
              }
              loading={saveRecipe.isPending}
            />
          )}
          {saveRecipe.error ? (
            <Body style={styles.error}>
              {saveRecipe.error instanceof Error ? saveRecipe.error.message : 'Could not save that.'}
            </Body>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
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
    error: {
      color: colors.danger,
    },
  });
