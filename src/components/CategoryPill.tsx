import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../providers/theme';
import { radius, spacing } from '../theme';
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
export function colorForKind(
  kind: IngredientKind | null | undefined,
  categoryColors: Record<string, string>,
): string {
  if (!kind) return categoryColors.other;
  return categoryColors[kind] ?? categoryColors.other;
}

/** `colorForKind` bound to the current theme's category palette. */
export function useColorForKind(): (kind: IngredientKind | null | undefined) => string {
  const { categoryColors } = useTheme();
  return useCallback((kind) => colorForKind(kind, categoryColors), [categoryColors]);
}

export function labelForKind(kind: IngredientKind | null | undefined): string {
  return kind ? KIND_LABELS[kind] : 'Unsorted';
}

export function CategoryPill({ kind }: { kind: IngredientKind | null | undefined }) {
  const color = useColorForKind()(kind);
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{labelForKind(kind)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
