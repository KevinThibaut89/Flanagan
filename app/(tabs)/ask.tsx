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
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { PlusNotice } from '../../src/components/PlusNotice';
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
import { isQuotaExceeded, remainingLabel, usePlan } from '../../src/data/plan';
import { useSaveRecipe } from '../../src/data/recipes';
import {
  draftToPreview,
  useSuggestCocktails,
  type SuggestedRecipe,
} from '../../src/data/suggestions';
import { usePurchases } from '../../src/providers/purchases';
import { useTheme, useThemedStyles } from '../../src/providers/theme';
import { spacing, typography, type Theme } from '../../src/theme';

const EXAMPLES = [
  'Something bitter and stirred',
  'Something fresh and citrusy',
  'Short, strong and spirit-forward',
  'A gin-based dry cocktail with floral notes',
  'Refreshing, long, not too strong',
  'Use up my rum',
  'Surprise me with something I would not think of',
];

export default function AskScreen() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');

  const suggest = useSuggestCocktails();
  const lastPrefill = useRef<string | null>(null);

  // Tapping the Barkeep tab while already on it wipes the slate: the query,
  // the last answer and any error, so the next ask starts clean.
  useEffect(() => {
    return navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      setQuery('');
      suggest.reset();
    });
    // `suggest.reset` is a stable handle from react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  const available = useAvailableIngredientIds();
  const { data: bottles } = useBottles();
  const { data: plan } = usePlan();
  const { presentPaywall } = usePurchases();

  // Free plan only: how many asks the month has left. Plus is capped too, but
  // at a level nobody meets, and a running count there would only nag.
  const asksLeft =
    plan?.tier === 'free' ? remainingLabel(plan.quotas.suggest_cocktails, 'ask') : null;

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

  // The month's asks ran out: offer Plus straight away, once per exhaustion,
  // and if they take it, run the ask they were making.
  const quotaError = isQuotaExceeded(suggest.error) ? suggest.error : null;
  const offeredFor = useRef<unknown>(null);
  useEffect(() => {
    if (!quotaError || offeredFor.current === quotaError) return;
    offeredFor.current = quotaError;
    void presentPaywall().then((outcome) => {
      if (outcome === 'purchased' || outcome === 'restored') ask(query);
    });
    // `ask` and `query` are read at the moment the paywall closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotaError]);

  // Home's ask line lands here as /ask?q=…&t=…; run the prompt straight away.
  // `t` is a send stamp so the same words sent twice still run twice.
  const { q, t } = useLocalSearchParams<{ q?: string; t?: string }>();
  const prefillKey = typeof q === 'string' && q.trim() ? `${t ?? ''}:${q}` : null;
  useEffect(() => {
    if (prefillKey && prefillKey !== lastPrefill.current) {
      lastPrefill.current = prefillKey;
      ask(q as string);
    }
    // `ask` closes over stable mutation/setState handles only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const result = suggest.data;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Label>Barkeep</Label>
            <Title>What are you in the mood for?</Title>
            <Muted>
              Answers come only from the {inStockCount}{' '}
              {inStockCount === 1 ? 'thing' : 'things'} you have in stock.
            </Muted>
            {asksLeft ? <Muted style={styles.asksLeft}>{asksLeft}</Muted> : null}
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

          {quotaError ? (
            <PlusNotice error={quotaError} onUnlocked={() => ask(query)} />
          ) : suggest.error ? (
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
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
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
  asksLeft: {
    color: colors.accent,
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
