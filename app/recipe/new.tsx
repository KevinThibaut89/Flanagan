import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { IngredientPicker } from '../../src/components/IngredientPicker';
import {
  RecipeLineEditor,
  lineToRow,
  newLine,
  type RecipeLineDraft,
} from '../../src/components/RecipeLineEditor';
import { TextField } from '../../src/components/TextField';
import { Body, Label, Loading, Muted, Screen } from '../../src/components/ui';
import { useIngredientIndex } from '../../src/data/ingredients';
import { useRecipe, useSaveRecipe, useUpdateRecipe } from '../../src/data/recipes';
import { select } from '../../src/lib/haptics';
import { colors, radius, spacing } from '../../src/theme';
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

/**
 * Writes a recipe into the same tables the AI path writes into — one format,
 * one editor, one save. Doubles as the edit screen via the `editId` param.
 */
export default function RecipeEditorScreen() {
  const router = useRouter();
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
      servings: existing?.servings ?? 1,
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

  if (isEditing && isLoading) return <Loading />;

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: isEditing ? 'Edit recipe' : 'Write a recipe' }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                onChange={(next) =>
                  setLines((current) => current.map((row, j) => (j === i ? next : row)))
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
                <Body style={styles.stepNumber}>{i + 1}</Body>
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
                  <Pressable
                    onPress={() => setSteps((current) => current.filter((_, j) => j !== i))}
                    hitSlop={10}
                    accessibilityLabel={`Remove step ${i + 1}`}
                  >
                    <Icon name="close" size={18} color={colors.textFaint} />
                  </Pressable>
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

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        select();
        onPress();
      }}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Body style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  section: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.fillSubtle,
  },
  chipActive: {
    backgroundColor: colors.accentDim,
  },
  chipLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  chipLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepNumber: {
    width: 16,
    color: colors.accent,
    fontWeight: '700',
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
