import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { labelForKind } from '../src/components/CategoryPill';
import { Icon } from '../src/components/Icon';
import { Body, Label, Loading, Muted, Screen } from '../src/components/ui';
import { useBottles, useToggleStaple } from '../src/data/bottles';
import { useStapleIngredients } from '../src/data/ingredients';
import { select } from '../src/lib/haptics';
import { colors, radius, spacing, typography } from '../src/theme';
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
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Done">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          ),
        }}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <Muted style={styles.intro}>The everyday things behind your bar.</Muted>
        }
        renderSectionHeader={({ section }) => (
          <Label style={styles.sectionHeader}>{section.title}</Label>
        )}
        renderItem={({ item, index, section }) => {
          const have = inStock.has(item.id);
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View>
              {!first ? (
                <View style={styles.separatorWrap}>
                  <View style={styles.separator} />
                </View>
              ) : null}
              <Pressable
                onPress={() => {
                  select();
                  toggle.mutate({ ingredientId: item.id, name: item.name, inStock: !have });
                }}
                style={[styles.item, first && styles.itemFirst, last && styles.itemLast]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: have }}
              >
                <Body style={have ? undefined : styles.itemLabelOff}>{item.name}</Body>
                {have ? <Icon name="check" size={20} color={colors.accent} /> : null}
              </Pressable>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: {
    ...typography.headline,
    color: colors.accent,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  intro: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    marginLeft: spacing.lg,
  },
  // One grouped card per section: the rows share a surface and the card's
  // corners live on the first and last row.
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  itemFirst: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  itemLast: {
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  separatorWrap: {
    backgroundColor: colors.surface,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginLeft: spacing.lg,
  },
  itemLabelOff: {
    color: colors.textMuted,
  },
});
