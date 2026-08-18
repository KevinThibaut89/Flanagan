import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { labelForKind, useColorForKind } from './CategoryPill';
import { SearchField } from './SearchField';
import { Body, Label, Muted, Screen } from './ui';
import { useBottles } from '../data/bottles';
import { useIngredientIndex, useIngredients } from '../data/ingredients';
import { useTheme, useThemedStyles } from '../providers/theme';
import { radius, spacing, type Theme } from '../theme';
import type { Ingredient } from '../types/database';

/**
 * Picks a canonical ingredient. Setting one is what makes a bottle countable
 * towards a recipe and a recipe line checkable against the bar, so the field is
 * worth a little ceremony — but it stays optional, because an unmatched item is
 * better than a wrong match.
 *
 * Results are ordered: things you already own first, then the rest of the
 * vocabulary. When you are writing down a drink you just made, the bottle is
 * almost always already on your shelf.
 */
export function IngredientPicker({
  value,
  onChange,
  label = 'Type',
  placeholder = 'Choose an ingredient',
  allowClear = true,
  freeText = null,
  onFreeText,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
  /** Current free-text fallback, shown when no canonical ingredient is set. */
  freeText?: string | null;
  /**
   * When provided, the search sheet offers "use what I typed" for terms with no
   * match. Recipes need this escape hatch — a homemade cordial has no entry in
   * the vocabulary — but a bottle does not, so the picker only grows the option
   * where it is wanted.
   */
  onFreeText?: (text: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colorForKind = useColorForKind();
  const [open, setOpen] = useState(false);
  const { index } = useIngredientIndex();

  const selected = value ? index?.byId.get(value) ?? null : null;

  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}

      <Pressable
        onPress={() => setOpen(true)}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel={selected ? `${label}: ${selected.name}` : placeholder}
      >
        {selected ? (
          <View style={styles.selected}>
            <View style={[styles.dot, { backgroundColor: colorForKind(selected.kind) }]} />
            <Body>{selected.name}</Body>
            <Muted>· {labelForKind(selected.kind)}</Muted>
          </View>
        ) : freeText ? (
          <View style={styles.selected}>
            <View style={[styles.dot, { backgroundColor: colors.textFaint }]} />
            <Body>{freeText}</Body>
            <Muted>· as written</Muted>
          </View>
        ) : (
          <Muted>{placeholder}</Muted>
        )}

        <View style={styles.controlActions}>
          {(selected || freeText) && allowClear ? (
            <Pressable
              onPress={() => {
                onChange(null);
                onFreeText?.('');
              }}
              hitSlop={10}
              accessibilityLabel="Clear ingredient"
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textFaint} />
        </View>
      </Pressable>

      <IngredientSearchModal
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={(ingredient) => {
          onChange(ingredient.id);
          onFreeText?.('');
          setOpen(false);
        }}
        onFreeText={
          onFreeText
            ? (text) => {
                onChange(null);
                onFreeText(text);
                setOpen(false);
              }
            : undefined
        }
      />
    </View>
  );
}

/**
 * The search sheet behind the picker, exported on its own for screens that
 * already render the field their own way (the shelf-photo review list) but
 * want the same search, grouping, and "on your shelf" ordering.
 */
export function IngredientSearchModal({
  visible,
  onClose,
  onSelect,
  onFreeText,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (ingredient: Ingredient) => void;
  onFreeText?: (text: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colorForKind = useColorForKind();
  const [term, setTerm] = useState('');
  const { data: all } = useIngredients();
  const { index } = useIngredientIndex();
  const { data: bottles } = useBottles();

  /** Ingredient ids attached to something currently on the shelf. */
  const owned = useMemo(() => {
    const set = new Set<string>();
    for (const bottle of bottles ?? []) {
      if (bottle.status === 'in_stock' && bottle.ingredient_id) set.add(bottle.ingredient_id);
    }
    return set;
  }, [bottles]);

  const results = useMemo(() => {
    const matches = term.trim() ? index?.search(term, 40) ?? [] : all ?? [];
    // Stable partition rather than a sort, so the vocabulary's own ordering
    // survives inside each group.
    const mine = matches.filter((row) => owned.has(row.id));
    const rest = matches.filter((row) => !owned.has(row.id));
    return { mine, rest };
  }, [term, all, index, owned]);

  const sections = useMemo(
    () => [
      ...(results.mine.length > 0
        ? [{ heading: 'On your shelf', rows: results.mine }]
        : []),
      ...(results.rest.length > 0
        ? [{ heading: results.mine.length > 0 ? 'Everything else' : null, rows: results.rest }]
        : []),
    ],
    [results],
  );

  // Flattened so one FlatList can render headings and rows together.
  const items = useMemo(
    () =>
      sections.flatMap((section) => [
        ...(section.heading ? [{ type: 'heading' as const, key: section.heading }] : []),
        ...section.rows.map((row) => ({ type: 'row' as const, key: row.id, row })),
      ]),
    [sections],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {/* Screen gives the sheet its background and, on Android (where the
          modal goes full-screen), keeps the search field off the status bar. */}
      <Screen edges={['top']}>
        <View style={styles.modalHeader}>
          <SearchField
            value={term}
            onChangeText={setTerm}
            placeholder="Search ingredients"
            autoFocus
            autoCapitalize="none"
            containerStyle={styles.search}
          />
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Cancel">
            <Body style={styles.cancel}>Cancel</Body>
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}:${item.key}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalList}
          ListHeaderComponent={
            // Offered above the results, not only when empty: the right answer
            // for "my own grapefruit cordial" is free text even though
            // "grapefruit juice" matches.
            onFreeText && term.trim() ? (
              <Pressable
                onPress={() => onFreeText(term.trim())}
                style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
              >
                <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textFaint} />
                <View style={styles.resultText}>
                  <Body>Use “{term.trim()}” as written</Body>
                  <Muted>Won’t be matched against your bar</Muted>
                </View>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Muted>
                {term.trim()
                  ? `Nothing in the vocabulary matches “${term.trim()}”.`
                  : 'Search for an ingredient.'}
              </Muted>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'heading') {
              return <Label style={styles.groupHeading}>{item.key}</Label>;
            }

            const parent = item.row.parent_id ? index?.byId.get(item.row.parent_id) : null;
            return (
              <Pressable
                onPress={() => onSelect(item.row)}
                style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
              >
                <View style={[styles.dot, { backgroundColor: colorForKind(item.row.kind) }]} />
                <View style={styles.resultText}>
                  <Body>{item.row.name}</Body>
                  <Muted>
                    {labelForKind(item.row.kind)}
                    {parent ? ` · a kind of ${parent.name.toLowerCase()}` : ''}
                  </Muted>
                </View>
                {owned.has(item.row.id) ? (
                  <MaterialCommunityIcons name="check" size={18} color={colors.success} />
                ) : null}
              </Pressable>
            );
          }}
        />
      </Screen>
    </Modal>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  // Mirrors the TextField input so pickers and fields read as one idiom.
  control: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  controlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selected: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.gutter,
    paddingVertical: spacing.lg,
  },
  search: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  cancel: {
    color: colors.cream,
    fontWeight: '600',
  },
  modalList: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  groupHeading: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  resultPressed: {
    opacity: 0.6,
  },
  resultText: {
    flex: 1,
    gap: 1,
  },
  noResults: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  });
