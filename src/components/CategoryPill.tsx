import { StyleSheet, Text, View } from 'react-native';

import { categoryColors, radius, spacing, tintOf } from '../theme';
import type { IngredientKind } from '../types/database';

const KIND_LABELS: Record<IngredientKind, string> = {
  spirit: 'Spirit',
  liqueur: 'Liqueur',
  vermouth: 'Vermouth',
  amaro: 'Amaro',
  bitters: 'Bitters',
  fortified: 'Fortified',
  wine: 'Wine',
  beer: 'Beer',
  juice: 'Juice',
  syrup: 'Syrup',
  mixer: 'Mixer',
  garnish: 'Garnish',
  other: 'Other',
};

/** Maps an ingredient kind to its accent colour, falling back to a neutral. */
export function colorForKind(kind: IngredientKind | null | undefined): string {
  if (!kind) return categoryColors.other;
  return categoryColors[kind] ?? categoryColors.other;
}

export function labelForKind(kind: IngredientKind | null | undefined): string {
  return kind ? KIND_LABELS[kind] : 'Unsorted';
}

export function CategoryPill({ kind }: { kind: IngredientKind | null | undefined }) {
  const color = colorForKind(kind);
  return (
    <View style={[styles.pill, { backgroundColor: tintOf(color) }]}>
      <Text style={[styles.text, { color }]}>{labelForKind(kind)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
