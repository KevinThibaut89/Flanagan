import { forwardRef, useImperativeHandle, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Chip } from './Chip';
import { IngredientPicker } from './IngredientPicker';
import { TextField } from './TextField';
import { Body, Label, Muted } from './ui';
import { ML_PER_OZ } from '../lib/units';
import { useUnits } from '../providers/preferences';
import { useThemedStyles } from '../providers/theme';
import { radius, spacing, type Theme } from '../theme';
import type { BottleKind, BottleStatus } from '../types/database';

export interface BottleFormValues {
  name: string;
  brand: string;
  ingredientId: string | null;
  abv: string;
  volumeMl: string;
  fillPct: number;
  status: BottleStatus;
  notes: string;
  kind: BottleKind;
  productId: string | null;
  imageUrl: string | null;
}

export function emptyBottleForm(): BottleFormValues {
  return {
    name: '',
    brand: '',
    ingredientId: null,
    abv: '',
    volumeMl: '',
    fillPct: 100,
    status: 'in_stock',
    notes: '',
    kind: 'bottle',
    productId: null,
    imageUrl: null,
  };
}

const FILL_LEVELS = [
  { value: 100, label: 'Full' },
  { value: 75, label: '¾' },
  { value: 50, label: 'Half' },
  { value: 25, label: '¼' },
  { value: 5, label: 'Dregs' },
];

const STATUSES: Array<{ value: BottleStatus; label: string }> = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'finished', label: 'Finished' },
  { value: 'wishlist', label: 'Wishlist' },
];

const METRIC_SIZES = [200, 350, 500, 700, 750, 1000];
/** Fifth, quart, pint, half-pint, litre — the sizes an imperial shelf actually has. */
const IMPERIAL_SIZES = [200, 375, 500, 750, 1000, 1750];

/** Lets a button living outside the form (e.g. in the screen header) submit it. */
export interface BottleFormHandle {
  submit: () => void;
}

export const BottleForm = forwardRef<
  BottleFormHandle,
  {
    values: BottleFormValues;
    onChange: (values: BottleFormValues) => void;
    onSubmit: () => void;
    /** Omit to render no inline submit button — the screen provides one instead. */
    submitLabel?: string;
    busy?: boolean;
    error?: string | null;
    footer?: React.ReactNode;
    /** The current ingredient was guessed from the name, not chosen by the user. */
    ingredientGuessed?: boolean;
  }
>(function BottleForm(
  { values, onChange, onSubmit, submitLabel, busy = false, error, footer, ingredientGuessed = false },
  ref,
) {
  const styles = useThemedStyles(makeStyles);
  const units = useUnits();
  const [touched, setTouched] = useState(false);

  const nameError = touched && !values.name.trim() ? 'A name is required.' : null;

  function set<K extends keyof BottleFormValues>(key: K, value: BottleFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function handleSubmit() {
    setTouched(true);
    if (!values.name.trim()) return;
    onSubmit();
  }

  useImperativeHandle(ref, () => ({ submit: handleSubmit }));

  const sizes = units === 'imperial' ? IMPERIAL_SIZES : METRIC_SIZES;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      {/* Pinned above the scroll so a failed save is visible from anywhere in the form. */}
      {error ? (
        <View style={styles.errorBanner}>
          <Body style={styles.errorText}>{error}</Body>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField
          label="Name"
          value={values.name}
          onChangeText={(text) => set('name', text)}
          placeholder="Tanqueray No. Ten"
          autoCapitalize="words"
          error={nameError}
        />

        <TextField
          label="Brand or producer"
          value={values.brand}
          onChangeText={(text) => set('brand', text)}
          placeholder="Tanqueray"
          autoCapitalize="words"
        />

        <View style={styles.pickerBlock}>
          <IngredientPicker
            value={values.ingredientId}
            onChange={(id) => set('ingredientId', id)}
            label="Counts as"
            placeholder="Not set — won’t match recipes"
          />
          <Muted style={styles.hint}>
            {ingredientGuessed
              ? 'Guessed from the name — check it, and tap to change it if it’s wrong.'
              : 'This is how Flanagan knows a recipe calling for gin can use this bottle. Leave it unset and the bottle still lives in your bar, it just won’t count towards anything.'}
          </Muted>
        </View>

        <View style={styles.pair}>
          <TextField
            label="ABV %"
            value={values.abv}
            onChangeText={(text) => set('abv', text.replace(',', '.'))}
            placeholder="47.3"
            keyboardType="decimal-pad"
            inputMode="decimal"
            style={styles.flex}
          />
          <TextField
            label="Bottle size (ml)"
            value={values.volumeMl}
            onChangeText={(text) => set('volumeMl', text.replace(/[^0-9]/g, ''))}
            placeholder="700"
            keyboardType="number-pad"
            inputMode="numeric"
            style={styles.flex}
            hint={
              units === 'imperial' && values.volumeMl
                ? `${Math.round((Number(values.volumeMl) / ML_PER_OZ) * 10) / 10} oz`
                : undefined
            }
          />
        </View>

        <View style={styles.chipsBlock}>
          <Label>Sizes</Label>
          <View style={styles.chipRow}>
            {sizes.map((size) => (
              <Chip
                key={size}
                label={`${size} ml`}
                active={values.volumeMl === String(size)}
                onPress={() => set('volumeMl', String(size))}
              />
            ))}
          </View>
        </View>

        {values.kind === 'bottle' ? (
          <View style={styles.chipsBlock}>
            <Label>How much is left</Label>
            <View style={styles.chipRow}>
              {FILL_LEVELS.map((level) => (
                <Chip
                  key={level.value}
                  label={level.label}
                  active={values.fillPct === level.value}
                  onPress={() => set('fillPct', level.value)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.chipsBlock}>
          <Label>Status</Label>
          <View style={styles.chipRow}>
            {STATUSES.map((status) => (
              <Chip
                key={status.value}
                label={status.label}
                active={values.status === status.value}
                onPress={() => set('status', status.value)}
              />
            ))}
          </View>
        </View>

        <TextField
          label="Notes"
          value={values.notes}
          onChangeText={(text) => set('notes', text)}
          placeholder="Where you bought it, what it tastes like, what it goes in…"
          multiline
          numberOfLines={3}
          style={styles.notes}
        />

        {submitLabel ? <Button label={submitLabel} onPress={handleSubmit} loading={busy} /> : null}
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

/** Turns form strings into the nullable numbers the database expects. */
export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.gutter,
    gap: spacing.lg,
    paddingBottom: spacing.section + spacing.xl,
  },
  pickerBlock: {
    gap: spacing.xs,
  },
  hint: {
    fontSize: 12,
  },
  pair: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  chipsBlock: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  notes: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  errorBanner: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: `${colors.danger}1A`,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  });
