import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { colorForKind, labelForKind } from './CategoryPill';
import { Body, Label, Muted } from './ui';
import { useBottles } from '../data/bottles';
import { useIngredientIndex, useIngredients } from '../data/ingredients';
import { colors, radius, spacing, typography } from '../theme';
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
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
}) {
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
        ) : (
          <Muted>{placeholder}</Muted>
        )}

        <View style={styles.controlActions}>
          {selected && allowClear ? (
            <Pressable
              onPress={() => onChange(null)}
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
          setOpen(false);
        }}
      />
    </View>
  );
}

function IngredientSearchModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (ingredient: Ingredient) => void;
}) {
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
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.textFaint} />
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder="Search ingredients"
              placeholderTextColor={colors.textFaint}
              selectionColor={colors.accent}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Cancel">
            <Body style={{ color: colors.accent }}>Cancel</Body>
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}:${item.key}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalList}
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Muted>No ingredient matches “{term.trim()}”.</Muted>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  control: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  modalList: {
    paddingHorizontal: spacing.lg,
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
