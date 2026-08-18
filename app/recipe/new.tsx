import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { IngredientPicker } from '../../src/components/IngredientPicker';
import {
  RecipeLineEditor,
  lineToRow,
  newLine,
  type RecipeLineDraft,
} from '../../src/components/RecipeLineEditor';
import { ScanRecipe } from '../../src/components/ScanRecipe';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { TextField } from '../../src/components/TextField';
import { Body, Label, Loading, Muted, PressableScale, Screen } from '../../src/components/ui';
import { useIngredientIndex } from '../../src/data/ingredients';
import type { ReadRecipe } from '../../src/data/readRecipe';
import { useRecipe, useSaveRecipe, useUpdateRecipe } from '../../src/data/recipes';
import { useTheme, useThemedStyles } from '../../src/providers/theme';
import { spacing, typography, type Theme } from '../../src/theme';
import type { RecipeIce, RecipeMethod } from '../../src/types/database';

const METHODS: Array<{ value: RecipeMethod; label: string }> = [
  { value: 'shake', label: 'Shake' },
  { value: 'stir', label: 'Stir' },
  { value: 'build', label: 'Build' },
  { value: 'muddle', label: 'Muddle' },
  { value: 'blend', label: 'Blend' },
  { value: 'swizzle', label: 'Swizzle' },
  { value: 'throw', label: 'Throw' },
];

const ICES: Array<{ value: RecipeIce; label: string }> = [
  { value: 'none', label: 'No ice' },
  { value: 'cubed', label: 'Cubed' },
  { value: 'large_cube', label: 'Large cube' },
  { value: 'crushed', label: 'Crushed' },
  { value: 'block', label: 'Block' },
];

/** "0.75" rather than "0.75000000001"; the amount field only takes digits and a dot. */
function formatAmount(amount: number): string {
  return String(Number(amount.toFixed(2)));
}

/**
 * Writes a recipe into the same tables the AI path writes into — one format,
 * one editor, one save. Doubles as the edit screen via the `editId` param, and
 * as the review step for a scanned recipe: a photo of a page fills the same
 * fields in, and saving is the same save.
 */
export default function RecipeEditorScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = Boolean(editId);

  const { data: existing, isLoading } = useRecipe(editId ?? '');
  const { index } = useIngredientIndex();
  const saveRecipe = useSaveRecipe();
  const updateRecipe = useUpdateRecipe();

  const [title, setTitle] = useState('');
  const [lines, setLines] = useState<RecipeLineDraft[]>(() => [newLine(), newLine()]);
  const [method, setMethod] = useState<RecipeMethod | null>(null);
  const [ice, setIce] = useState<RecipeIce | null>(null);
  const [glass, setGlass] = useState('');
  const [garnish, setGarnish] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [baseIngredientId, setBaseIngredientId] = useState<string | null>(null);
  // Not editable here — the form has no field for it — but a scanned batch
  // recipe ("serves 6") should not quietly become a single serving.
  const [servings, setServings] = useState(1);
  const [seeded, setSeeded] = useState(false);
  const [touched, setTouched] = useState(false);

  // Seed once when editing, for the same reason the bottle form does: a
  // background refetch must not overwrite what is being typed.
  useEffect(() => {
    if (!isEditing || !existing || seeded) return;

    setTitle(existing.title);
    setMethod(existing.method);
    setIce(existing.ice);
    setGlass(existing.glass ?? '');
    setGarnish(existing.garnish ?? '');
    setSteps(existing.instructions.length > 0 ? existing.instructions : ['']);
    setNotes(existing.notes ?? '');
    setTags(existing.flavor_tags.join(', '));
    setBaseIngredientId(existing.base_ingredient_id);
    setServings(existing.servings);
    setLines(
      existing.recipe_ingredients.map((row) =>
        newLine({
          ingredientId: row.ingredient_id,
          freeText: row.free_text ?? '',
          amount: row.amount_display !== null ? String(row.amount_display) : '',
          unit: row.unit_display,
          isOptional: row.is_optional,
          isGarnish: row.is_garnish,
          note: row.note ?? '',
        }),
      ),
    );
    setSeeded(true);
  }, [isEditing, existing, seeded]);

  const rows = useMemo(
    () => lines.map(lineToRow).filter((row): row is NonNullable<typeof row> => row !== null),
    [lines],
  );

  /**
   * The base spirit is what the library groups and filters by. Guessing it from
   * the largest spirit pour is right nearly every time, and it stays editable
   * for the times it isn't.
   */
  const suggestedBase = useMemo(() => {
    if (!index) return null;
    const spiritLines = rows
      .filter((row) => {
        if (!row.ingredient_id) return false;
        const kind = index.byId.get(row.ingredient_id)?.kind;
        return kind === 'spirit' || kind === 'liqueur' || kind === 'amaro';
      })
      .sort((a, b) => (b.amount_ml ?? 0) - (a.amount_ml ?? 0));
    return spiritLines[0]?.ingredient_id ?? null;
  }, [rows, index]);

  const effectiveBase = baseIngredientId ?? suggestedBase;

  /** Whether a scan would overwrite anything the user has typed. */
  const hasContent =
    Boolean(title.trim()) ||
    rows.length > 0 ||
    steps.some((step) => step.trim()) ||
    Boolean(glass.trim() || garnish.trim() || notes.trim() || tags.trim());

  /**
   * Pours a scanned recipe into the form. Everything lands in the same fields
   * the user would have typed into, so the review is just reading the form;
   * the base spirit is left to be guessed from the lines like any other draft.
   */
  function applyRead(recipe: ReadRecipe) {
    setTitle(recipe.title);
    setLines(
      recipe.ingredients.length > 0
        ? recipe.ingredients.map((line) =>
            newLine({
              ingredientId: line.ingredient_id,
              // Unmatched lines keep the printed wording as free text, so the
              // user sees exactly what the page said and can pick a match.
              freeText: line.ingredient_id ? '' : line.text,
              amount: line.amount !== null ? formatAmount(line.amount) : '',
              unit: line.unit,
              isOptional: line.is_optional,
              isGarnish: line.is_garnish,
              note: line.note ?? '',
            }),
          )
        : [newLine()],
    );
    setMethod(recipe.method);
    setIce(recipe.ice);
    setGlass(recipe.glass ?? '');
    setGarnish(recipe.garnish ?? '');
    setSteps(recipe.instructions.length > 0 ? recipe.instructions : ['']);
    setNotes(recipe.notes ?? '');
    setTags(recipe.flavor_tags.join(', '));
    setServings(recipe.servings ?? 1);
    setBaseIngredientId(null);
    setTouched(false);
  }

  const titleError = touched && !title.trim() ? 'Give it a name.' : null;
  const linesError = touched && rows.length === 0 ? 'Add at least one ingredient.' : null;

  const busy = saveRecipe.isPending || updateRecipe.isPending;
  const saveError = (saveRecipe.error ?? updateRecipe.error) as Error | null;

  function handleSave() {
    setTouched(true);
    if (!title.trim() || rows.length === 0) return;

    const draft = {
      title: title.trim(),
      source: (existing?.source ?? 'user') as 'user' | 'ai' | 'classic',
      glass: glass.trim() || null,
      method,
      ice,
      garnish: garnish.trim() || null,
      instructions: steps.map((step) => step.trim()).filter(Boolean),
      notes: notes.trim() || null,
      flavor_tags: tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      base_ingredient_id: effectiveBase,
      abv_estimate: existing?.abv_estimate ?? null,
      servings,
      ai_prompt: existing?.ai_prompt ?? null,
      ai_model: existing?.ai_model ?? null,
      ingredients: rows.map((row) => ({
        ingredient_id: row.ingredient_id ?? null,
        free_text: row.free_text ?? null,
        amount_ml: row.amount_ml ?? null,
        amount_display: row.amount_display ?? null,
        unit_display: row.unit_display ?? null,
        is_optional: row.is_optional ?? false,
        is_garnish: row.is_garnish ?? false,
        note: row.note ?? null,
      })),
    };

    const done = () => {
      if (router.canGoBack()) router.back();
      else router.replace('/recipes');
    };

    if (isEditing && editId) {
      updateRecipe.mutate({ id: editId, draft }, { onSuccess: done });
    } else {
      saveRecipe.mutate(draft, { onSuccess: done });
    }
  }

  if (isEditing && isLoading) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Edit recipe" />
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title={isEditing ? 'Edit recipe' : 'Write a recipe'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!isEditing ? <ScanRecipe onRead={applyRead} hasContent={hasContent} /> : null}

          <TextField
            label="Name"
            value={title}
            onChangeText={setTitle}
            placeholder="Corpse Reviver No. 2"
            autoCapitalize="words"
            error={titleError}
          />

          <View style={styles.section}>
            <Label>Ingredients</Label>
            {lines.map((line, i) => (
              <RecipeLineEditor
                key={line.key}
                line={line}
                onChange={(update) =>
                  setLines((current) => current.map((row, j) => (j === i ? update(row) : row)))
                }
                onRemove={() => setLines((current) => current.filter((_, j) => j !== i))}
              />
            ))}
            {linesError ? <Body style={styles.error}>{linesError}</Body> : null}
            <Button
              label="Add ingredient"
              variant="secondary"
              size="sm"
              onPress={() => setLines((current) => [...current, newLine()])}
            />
          </View>

          <View style={styles.section}>
            <Label>Method</Label>
            <View style={styles.chipRow}>
              {METHODS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={method === option.value}
                  onPress={() => setMethod(method === option.value ? null : option.value)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Label>Ice</Label>
            <View style={styles.chipRow}>
              {ICES.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={ice === option.value}
                  onPress={() => setIce(ice === option.value ? null : option.value)}
                />
              ))}
            </View>
          </View>

          <TextField
            label="Glass"
            value={glass}
            onChangeText={setGlass}
            placeholder="Coupe"
            autoCapitalize="words"
          />

          <TextField
            label="Garnish"
            value={garnish}
            onChangeText={setGarnish}
            placeholder="Grapefruit twist"
          />

          <View style={styles.section}>
            <Label>Steps</Label>
            {steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{i + 1}.</Text>
                <View style={styles.flex}>
                  <TextField
                    value={step}
                    onChangeText={(text) =>
                      setSteps((current) => current.map((s, j) => (j === i ? text : s)))
                    }
                    placeholder="Shake hard with ice, double strain"
                    multiline
                    style={styles.stepInput}
                  />
                </View>
                {steps.length > 1 ? (
                  <PressableScale
                    onPress={() => setSteps((current) => current.filter((_, j) => j !== i))}
                    hitSlop={8}
                    accessibilityLabel={`Remove step ${i + 1}`}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.textFaint} />
                  </PressableScale>
                ) : null}
              </View>
            ))}
            <Button
              label="Add step"
              variant="secondary"
              size="sm"
              onPress={() => setSteps((current) => [...current, ''])}
            />
          </View>

          <View style={styles.section}>
            <IngredientPicker
              label="Base spirit"
              value={effectiveBase}
              onChange={setBaseIngredientId}
              placeholder="Worked out from the ingredients"
            />
            {!baseIngredientId && suggestedBase ? (
              <Muted style={styles.hint}>
                Guessed from the largest pour. Tap to change it.
              </Muted>
            ) : null}
          </View>

          <TextField
            label="Tastes like"
            value={tags}
            onChangeText={setTags}
            placeholder="dry, floral, citrus"
            autoCapitalize="none"
            hint="Comma separated. These are what natural-language requests match against."
          />

          <TextField
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Where it came from, what to tweak next time…"
            multiline
            style={styles.notes}
          />

          {saveError ? <Body style={styles.error}>{saveError.message}</Body> : null}

          <Button
            label={isEditing ? 'Save changes' : 'Save recipe'}
            onPress={handleSave}
            loading={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.gutter,
    gap: spacing.lg,
    paddingBottom: spacing.section + spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNumber: {
    ...typography.serifBody,
    width: 22,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  stepInput: {
    minHeight: 48,
  },
  notes: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
  },
  error: {
    color: colors.danger,
  },
});
