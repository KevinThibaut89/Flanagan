import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from './Icon';
import { IngredientPicker } from './IngredientPicker';
import { Body, Muted } from './ui';
import { toMl } from '../lib/units';
import { colors, radius, spacing } from '../theme';
import type { MeasureUnit, RecipeIngredientInsert } from '../types/database';

/** One editable ingredient line. `key` is local only — React needs a stable id
 * before the row has ever been saved. */
export interface RecipeLineDraft {
  key: string;
  ingredientId: string | null;
  freeText: string;
  amount: string;
  unit: MeasureUnit | null;
  isOptional: boolean;
  isGarnish: boolean;
  note: string;
}

let lineCounter = 0;

export function newLine(overrides: Partial<RecipeLineDraft> = {}): RecipeLineDraft {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    ingredientId: null,
    freeText: '',
    amount: '',
    unit: null,
    isOptional: false,
    isGarnish: false,
    note: '',
    ...overrides,
  };
}

/** The units worth one tap. The full enum is wider, but this is what a home bar
 * measures in. */
const QUICK_UNITS: MeasureUnit[] = ['ml', 'cl', 'oz', 'dash', 'barspoon', 'tsp', 'piece', 'top'];

const UNIT_LABELS: Partial<Record<MeasureUnit, string>> = {
  barspoon: 'bar spoon',
  piece: 'whole',
  top: 'top up',
};

export function RecipeLineEditor({
  line,
  onChange,
  onRemove,
}: {
  line: RecipeLineDraft;
  onChange: (line: RecipeLineDraft) => void;
  onRemove: () => void;
}) {
  function set<K extends keyof RecipeLineDraft>(key: K, value: RecipeLineDraft[K]) {
    onChange({ ...line, [key]: value });
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <TextInput
          value={line.amount}
          onChangeText={(text) => set('amount', text.replace(',', '.').replace(/[^0-9.]/g, ''))}
          placeholder="45"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={styles.amountInput}
          accessibilityLabel="Amount"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.unitRow}
          keyboardShouldPersistTaps="handled"
        >
          {QUICK_UNITS.map((unit) => (
            <Pressable
              key={unit}
              onPress={() => set('unit', line.unit === unit ? null : unit)}
              style={[styles.unitChip, line.unit === unit && styles.unitChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: line.unit === unit }}
            >
              <Body style={[styles.unitLabel, line.unit === unit && styles.unitLabelActive]}>
                {UNIT_LABELS[unit] ?? unit}
              </Body>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel="Remove this ingredient">
          <Icon name="close" size={20} color={colors.textFaint} />
        </Pressable>
      </View>

      <IngredientPicker
        label=""
        value={line.ingredientId}
        onChange={(id) => set('ingredientId', id)}
        freeText={line.freeText || null}
        onFreeText={(text) => set('freeText', text)}
        placeholder="What goes in"
      />

      <View style={styles.toggleRow}>
        <Toggle
          label="Optional"
          active={line.isOptional}
          onPress={() => set('isOptional', !line.isOptional)}
        />
        <Toggle
          label="Garnish"
          active={line.isGarnish}
          onPress={() => set('isGarnish', !line.isGarnish)}
        />
        {!line.ingredientId && line.freeText ? (
          <Muted style={styles.warning}>won’t match your bar</Muted>
        ) : null}
      </View>
    </View>
  );
}

function Toggle({
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
      onPress={onPress}
      style={[styles.toggle, active && styles.toggleActive]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
    >
      <Icon
        name={active ? 'checkboxOn' : 'checkboxOff'}
        size={15}
        color={active ? colors.accent : colors.textFaint}
      />
      <Body style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Body>
    </Pressable>
  );
}

/**
 * Converts an edited line into the row the database stores.
 *
 * `amount_ml` is the normalised value used for display conversion and nothing
 * else; `amount_display` + `unit_display` preserve exactly what was typed, so a
 * dash is still a dash when the recipe is read back.
 *
 * Returns null for a line with nothing in it, so trailing blank rows left in the
 * editor never reach the database.
 */
export function lineToRow(line: RecipeLineDraft): Omit<RecipeIngredientInsert, 'recipe_id'> | null {
  const freeText = line.freeText.trim();
  if (!line.ingredientId && !freeText) return null;

  const amount = line.amount.trim() ? Number(line.amount) : null;
  const validAmount = amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null;

  return {
    ingredient_id: line.ingredientId,
    free_text: line.ingredientId ? null : freeText || null,
    amount_ml: validAmount !== null && line.unit ? toMl(validAmount, line.unit) : null,
    amount_display: validAmount,
    unit_display: line.unit,
    is_optional: line.isOptional,
    is_garnish: line.isGarnish,
    note: line.note.trim() || null,
  };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountInput: {
    width: 60,
    height: 40,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    color: colors.text,
    fontSize: 16,
    textAlign: 'center',
  },
  unitRow: {
    gap: spacing.xs,
    alignItems: 'center',
    paddingRight: spacing.sm,
  },
  unitChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.fillSubtle,
  },
  unitChipActive: {
    backgroundColor: colors.accentDim,
  },
  unitLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  unitLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleActive: {},
  toggleLabel: {
    fontSize: 13,
    color: colors.textFaint,
  },
  toggleLabelActive: {
    color: colors.text,
  },
  warning: {
    fontSize: 11,
    color: colors.warning,
  },
});
