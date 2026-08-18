import { useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { labelForKind } from '../src/components/CategoryPill';
import { Body, Label, Loading, Muted, PressableScale, Screen, Title } from '../src/components/ui';
import { useBottles, useToggleStaple } from '../src/data/bottles';
import { useStapleIngredients } from '../src/data/ingredients';
import { useTheme, useThemedStyles } from '../src/providers/theme';
import { spacing, type Theme } from '../src/theme';
import type { Ingredient, IngredientKind } from '../src/types/database';

/**
 * "What can I make right now?" is only useful if the app knows about the things
 * that are not bottles — limes, syrup, soda, eggs. Typing those in one at a time
 * is a chore nobody would do, so they get a single tap each.
 */
export default function StaplesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
        <PressableScale onPress={() => router.back()} hitSlop={8} accessibilityLabel="Close">
          <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
        </PressableScale>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderSectionHeader={({ section }) => (
          <Label style={styles.sectionHeader}>{section.title}</Label>
        )}
        renderItem={({ item }) => {
          const have = inStock.has(item.id);
          return (
            <PressableScale
              onPress={() => {
                void Haptics.selectionAsync();
                toggle.mutate({ ingredientId: item.id, name: item.name, inStock: !have });
              }}
              style={styles.item}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: have }}
            >
              <MaterialCommunityIcons
                name={have ? 'check-circle' : 'circle-outline'}
                size={22}
                color={have ? colors.success : colors.textFaint}
              />
              <Body style={[styles.itemLabel, have && styles.itemLabelActive]}>{item.name}</Body>
            </PressableScale>
          );
        }}
      />
    </Screen>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    gap: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginLeft: 22 + spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemLabel: {
    color: colors.textMuted,
  },
  itemLabelActive: {
    color: colors.text,
    fontWeight: '600',
  },
});
