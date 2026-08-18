import { StyleSheet, View } from 'react-native';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Chip } from './Chip';
import { Label } from './ui';
import {
  SORT_OPTIONS,
  activeFacetCount,
  toggleKey,
  type FacetOption,
  type RecipeFacetSelection,
  type RecipeFacets,
  type RecipeSort,
} from '../data/recipeSearch';
import { spacing } from '../theme';
import type { RecipeMethod } from '../types/database';

/**
 * The "narrow it down" sheet for the recipe library: base spirit, method and
 * flavour as multi-select chip grids, plus a sort. Choices apply to the list
 * behind the scrim as they are made, so the footer just reports and closes.
 */
export function RecipeFilterSheet({
  visible,
  onClose,
  facets,
  selection,
  onChange,
  sort,
  onChangeSort,
  resultCount,
  onClearAll,
}: {
  visible: boolean;
  onClose: () => void;
  facets: RecipeFacets;
  selection: RecipeFacetSelection;
  onChange: (next: RecipeFacetSelection) => void;
  sort: RecipeSort;
  onChangeSort: (next: RecipeSort) => void;
  resultCount: number;
  onClearAll: () => void;
}) {
  const somethingSet = activeFacetCount(selection) > 0 || sort !== 'newest';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Narrow it down"
      headerAction={somethingSet ? { label: 'Clear all', onPress: onClearAll } : null}
      footer={
        <Button
          label={`Show ${resultCount} ${resultCount === 1 ? 'recipe' : 'recipes'}`}
          onPress={onClose}
        />
      }
    >
      <FacetGroup
        title="Base spirit"
        options={facets.bases}
        selected={selection.bases}
        onToggle={(key) => onChange({ ...selection, bases: toggleKey(selection.bases, key) })}
      />
      <FacetGroup<RecipeMethod>
        title="Method"
        options={facets.methods}
        selected={selection.methods}
        onToggle={(key) => onChange({ ...selection, methods: toggleKey(selection.methods, key) })}
      />
      <FacetGroup
        title="Flavour"
        options={facets.tags}
        selected={selection.tags}
        onToggle={(key) => onChange({ ...selection, tags: toggleKey(selection.tags, key) })}
      />

      <View style={styles.group}>
        <Label>Sort by</Label>
        <View style={styles.grid}>
          {SORT_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              active={sort === option.key}
              onPress={() => onChangeSort(option.key)}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

/**
 * One multi-select group. Hidden when the library offers nothing for it. A
 * key that is selected but no longer occurs (its last recipe was deleted) is
 * still shown, at zero, so it can be unticked.
 */
function FacetGroup<K extends string>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: FacetOption<K>[];
  selected: K[];
  onToggle: (key: K) => void;
}) {
  const orphaned = selected
    .filter((key) => !options.some((option) => option.key === key))
    .map((key): FacetOption<K> => ({ key, label: key, count: 0 }));
  const all = [...options, ...orphaned];
  if (all.length === 0) return null;

  return (
    <View style={styles.group}>
      <Label>{title}</Label>
      <View style={styles.grid}>
        {all.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            count={option.count}
            active={selected.includes(option.key)}
            onPress={() => onToggle(option.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
