import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { labelForKind } from '../src/components/CategoryPill';
import { Body, Label, Loading, Muted, Screen, Title } from '../src/components/ui';
import { useBottles, useToggleStaple } from '../src/data/bottles';
import { useStapleIngredients } from '../src/data/ingredients';
import { colors, radius, spacing } from '../src/theme';
import type { Ingredient, IngredientKind } from '../src/types/database';

/**
 * "What can I make right now?" is only useful if the app knows about the things
 * that are not bottles — limes, syrup, soda, eggs. Typing those in one at a time
 * is a chore nobody would do, so they get a single tap each.
 */
export default function StaplesScreen() {
  const router = useRouter();
  const { staples, isLoading } = useStapleIngredients();
  const { data: bottles } = useBottles();
  const toggle = useToggleStaple();

  const inStock = useMemo(() => {
    const set = new Set<string>();
    for (const bottle of bottles ?? []) {
      if (bottle.status === 'in_stock' && bottle.ingredient_id) set.add(bottle.ingredient_id);
    }
    return set;
  }, [bottles]);

  const sections = useMemo(() => {
    const groups = new Map<IngredientKind, Ingredient[]>();
    for (const ingredient of staples) {
      const list = groups.get(ingredient.kind) ?? [];
      list.push(ingredient);
      groups.set(ingredient.kind, list);
    }
    return [...groups.entries()].map(([kind, data]) => ({ title: labelForKind(kind), data }));
  }, [staples]);

  if (isLoading) return <Loading />;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Title>Staples</Title>
          <Muted>The everyday things behind your bar.</Muted>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Close">
          <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Label style={styles.sectionHeader}>{section.title}</Label>
        )}
        renderItem={({ item }) => {
          const have = inStock.has(item.id);
          return (
            <Pressable
              onPress={() =>
                toggle.mutate({ ingredientId: item.id, name: item.name, inStock: !have })
              }
              style={[styles.item, have && styles.itemActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: have }}
            >
              <MaterialCommunityIcons
                name={have ? 'check-circle' : 'circle-outline'}
                size={22}
                color={have ? colors.success : colors.textFaint}
              />
              <Body style={[styles.itemLabel, have && styles.itemLabelActive]}>{item.name}</Body>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerText: {
    gap: 2,
  },
  content: {
    padding: spacing.lg,
    paddingTop: 0,
    gap: spacing.sm,
  },
  sectionHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  itemActive: {
    borderColor: colors.success,
    backgroundColor: colors.surfaceRaised,
  },
  itemLabel: {
    color: colors.textMuted,
  },
  itemLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },
});
