import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { RecipeIngredientList } from '../../src/components/RecipeIngredientList';
import {
  Body,
  Card,
  Flourish,
  Heading,
  Label,
  Muted,
  Reveal,
  Screen,
  Title,
} from '../../src/components/ui';
import { useAvailableIngredientIds, useBottles } from '../../src/data/bottles';
import { useSaveRecipe } from '../../src/data/recipes';
import {
  draftToPreview,
  useSuggestCocktails,
  type SuggestedRecipe,
} from '../../src/data/suggestions';
import { colors, spacing, typography } from '../../src/theme';

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

  // Home's mood chips land here as /ask?q=…; run the prompt straight away.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const lastPrefill = useRef<string | null>(null);
  useEffect(() => {
    if (typeof q === 'string' && q.trim() && q !== lastPrefill.current) {
      lastPrefill.current = q;
      ask(q);
    }
    // `ask` closes over stable mutation/setState handles only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const result = suggest.data;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Label>Ask Flanagan</Label>
            <Title>What do you feel like?</Title>
            <Muted>
              Answers come only from the {inStockCount}{' '}
              {inStockCount === 1 ? 'thing' : 'things'} you have in stock.
            </Muted>
          </View>

          <View style={styles.inputBlock}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="A gin-based dry cocktail with floral notes…"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accent}
              multiline
              style={styles.input}
              returnKeyType="search"
              onSubmitEditing={() => ask(query)}
            />
            <View style={styles.inputRule} />
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
                  <Chip key={example} label={example} onPress={() => ask(example)} />
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
            <Reveal style={styles.results}>
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
            </Reveal>
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
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Heading>{recipe.title}</Heading>
        {specs.length > 0 ? <Muted>{specs.join(' · ')}</Muted> : null}
      </View>

      <Flourish style={styles.rationale}>{recipe.rationale}</Flourish>

      <RecipeIngredientList lines={preview.recipe_ingredients} available={available} />

      {recipe.instructions.length > 0 ? (
        <View style={styles.steps}>
          {recipe.instructions.map((step, i) => (
            <View key={`${i}-${step.slice(0, 10)}`} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}.</Text>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    gap: spacing.xl,
    paddingBottom: spacing.section + spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  inputBlock: {
    gap: spacing.lg,
  },
  // The prompt is content, so it is set in the serif voice, not a boxed field.
  input: {
    fontFamily: 'Fraunces_400Regular',
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    minHeight: 64,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  inputRule: {
    height: 1,
    backgroundColor: colors.border,
  },
  examples: {
    gap: spacing.md,
  },
  exampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  noticeText: {
    flex: 1,
  },
  results: {
    gap: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  cardHeader: {
    gap: 2,
  },
  rationale: {
    color: colors.textMuted,
  },
  steps: {
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
  footnote: {
    fontSize: 12,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
  },
});
