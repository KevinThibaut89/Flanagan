import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { RecipeIngredientList } from '../../src/components/RecipeIngredientList';
import { Body, Label, Muted, Screen, Title } from '../../src/components/ui';
import { useAvailableIngredientIds, useBottles } from '../../src/data/bottles';
import { useSaveRecipe } from '../../src/data/recipes';
import {
  draftToPreview,
  useSuggestCocktails,
  type SuggestedRecipe,
} from '../../src/data/suggestions';
import { colors, radius, spacing, typography } from '../../src/theme';

const EXAMPLES = [
  'A gin-based dry cocktail with floral notes',
  'Something bitter and stirred',
  'Refreshing, long, not too strong',
  'Use up my rum',
];

export default function AskScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const suggest = useSuggestCocktails();
  const available = useAvailableIngredientIds();
  const { data: bottles } = useBottles();

  const inStockCount = useMemo(
    () => (bottles ?? []).filter((bottle) => bottle.status === 'in_stock').length,
    [bottles],
  );

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    suggest.mutate(trimmed);
  }

  const result = suggest.data;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Title>What do you feel like?</Title>
            <Muted>
              Answers come only from the {inStockCount}{' '}
              {inStockCount === 1 ? 'thing' : 'things'} you have in stock.
            </Muted>
          </View>

          <View style={styles.inputWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="A gin-based dry cocktail with floral notes"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accent}
              multiline
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={() => ask(query)}
            />
            <Button
              label={suggest.isPending ? 'Thinking…' : 'Ask'}
              onPress={() => ask(query)}
              loading={suggest.isPending}
              disabled={!query.trim()}
            />
          </View>

          {!result && !suggest.isPending ? (
            <View style={styles.examples}>
              <Label>Try</Label>
              <View style={styles.exampleRow}>
                {EXAMPLES.map((example) => (
                  <Pressable
                    key={example}
                    onPress={() => ask(example)}
                    style={styles.exampleChip}
                  >
                    <Body style={styles.exampleLabel}>{example}</Body>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {suggest.error ? (
            <View style={styles.notice}>
              <MaterialCommunityIcons name="alert-outline" size={18} color={colors.danger} />
              <Body style={styles.noticeText}>
                {suggest.error instanceof Error ? suggest.error.message : 'That did not work.'}
              </Body>
            </View>
          ) : null}

          {result?.message ? (
            <View style={styles.notice}>
              <MaterialCommunityIcons name="information-outline" size={18} color={colors.textMuted} />
              <Body style={styles.noticeText}>{result.message}</Body>
            </View>
          ) : null}

          {result && result.recipes.length > 0 ? (
            <View style={styles.results}>
              {result.recipes.map((recipe, i) => (
                <SuggestionCard key={`${recipe.title}-${i}`} recipe={recipe} index={i} available={available} />
              ))}

              {result.rejected > 0 ? (
                <Muted style={styles.footnote}>
                  {result.rejected}{' '}
                  {result.rejected === 1 ? 'suggestion was' : 'suggestions were'} set aside for
                  needing something you don’t have.
                </Muted>
              ) : null}

              <Button
                label="See my recipes"
                variant="ghost"
                onPress={() => router.push('/recipes')}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function SuggestionCard({
  recipe,
  index,
  available,
}: {
  recipe: SuggestedRecipe;
  index: number;
  available: Set<string>;
}) {
  const router = useRouter();
  const saveRecipe = useSaveRecipe();
  const [savedId, setSavedId] = useState<string | null>(null);

  const preview = useMemo(() => draftToPreview(recipe, index), [recipe, index]);

  const specs = [
    recipe.method,
    recipe.glass,
    recipe.abv_estimate !== null ? `~${Math.round(recipe.abv_estimate)}%` : null,
  ].filter(Boolean) as string[];

  function handleSave() {
    // `rationale` explains the suggestion; it is not part of the stored format.
    const { rationale: _rationale, ...draft } = recipe;
    saveRecipe.mutate(draft, { onSuccess: (saved) => setSavedId(saved.id) });
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Body style={styles.cardTitle}>{recipe.title}</Body>
        {specs.length > 0 ? <Muted>{specs.join(' · ')}</Muted> : null}
      </View>

      <Muted style={styles.rationale}>{recipe.rationale}</Muted>

      <RecipeIngredientList lines={preview.recipe_ingredients} available={available} />

      {recipe.instructions.length > 0 ? (
        <View style={styles.steps}>
          {recipe.instructions.map((step, i) => (
            <View key={`${i}-${step.slice(0, 10)}`} style={styles.step}>
              <Body style={styles.stepNumber}>{i + 1}</Body>
              <Body style={styles.stepText}>{step}</Body>
            </View>
          ))}
        </View>
      ) : null}

      {recipe.garnish ? <Muted>Garnish: {recipe.garnish}</Muted> : null}

      {savedId ? (
        <Button
          label="Saved — open it"
          variant="secondary"
          onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: savedId } })}
        />
      ) : (
        <Button
          label="Save to my recipes"
          onPress={handleSave}
          loading={saveRecipe.isPending}
        />
      )}

      {saveRecipe.error ? (
        <Body style={styles.error}>
          {saveRecipe.error instanceof Error ? saveRecipe.error.message : 'Could not save that.'}
        </Body>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  header: {
    gap: spacing.xs,
  },
  inputWrap: {
    gap: spacing.md,
  },
  input: {
    minHeight: 88,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  examples: {
    gap: spacing.sm,
  },
  exampleRow: {
    gap: spacing.sm,
  },
  exampleChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  exampleLabel: {
    color: colors.textMuted,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  noticeText: {
    flex: 1,
  },
  results: {
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: {
    gap: 2,
  },
  cardTitle: {
    ...typography.heading,
    color: colors.text,
  },
  rationale: {
    fontStyle: 'italic',
  },
  steps: {
    gap: spacing.sm,
  },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepNumber: {
    width: 16,
    color: colors.accent,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
  },
  footnote: {
    fontSize: 12,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
  },
});
