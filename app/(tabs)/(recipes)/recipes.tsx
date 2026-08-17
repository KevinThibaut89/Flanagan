import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Link, Stack, useRouter } from 'expo-router';

import { Button } from '../../../src/components/Button';
import { Icon } from '../../../src/components/Icon';
import { RecipeCard } from '../../../src/components/RecipeCard';
import { Body, EmptyState, ErrorState, Loading, Muted, Screen } from '../../../src/components/ui';
import { useAvailableIngredientIds } from '../../../src/data/bottles';
import { canMake, useRecipes } from '../../../src/data/recipes';
import { select } from '../../../src/lib/haptics';
import { colors, radius, spacing, typography } from '../../../src/theme';

type Filter = 'all' | 'makeable' | 'mine' | 'suggested' | 'favorites';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'makeable', label: 'Makeable now' },
  { key: 'favorites', label: 'Favourites' },
  { key: 'mine', label: 'Mine' },
  { key: 'suggested', label: 'Suggested' },
];

export default function RecipesScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { data: recipes, isLoading, error, refetch, isRefetching } = useRecipes();
  const available = useAvailableIngredientIds();

  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    if (!recipes) return [];
    return recipes.filter((recipe) => {
      switch (filter) {
        case 'makeable':
          return canMake(recipe, available);
        case 'favorites':
          return recipe.is_favorite;
        case 'mine':
          return recipe.source !== 'ai';
        case 'suggested':
          return recipe.source === 'ai';
        default:
          return true;
      }
    });
  }, [recipes, filter, available]);

  const makeableCount = useMemo(
    () => (recipes ?? []).filter((recipe) => canMake(recipe, available)).length,
    [recipes, available],
  );

  const screenOptions = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/recipe/new')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Write a recipe"
            style={({ pressed }) => pressed && styles.headerButtonPressed}
          >
            <Icon name="add" size={22} color={colors.accent} />
          </Pressable>
        ),
      }}
    />
  );

  if (isLoading) {
    return (
      <Screen edges={[]}>
        {screenOptions}
        <Loading label="Opening your notebook…" />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen edges={[]}>
        {screenOptions}
        <ErrorState error={error} action={<Button label="Try again" onPress={() => refetch()} />} />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      {screenOptions}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          visible.length === 0 ? styles.emptyWrap : styles.listContent,
          { paddingBottom: (Platform.OS === 'ios' ? tabBarHeight : 0) + spacing.xl },
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Muted>
              {recipes?.length ?? 0} saved · {makeableCount} you can make now
            </Muted>
            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    select();
                    setFilter(item.key);
                  }}
                  style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
                >
                  <Body style={[styles.filterLabel, filter === item.key && styles.filterLabelActive]}>
                    {item.label}
                  </Body>
                </Pressable>
              )}
            />
          </View>
        }
        ListEmptyComponent={
          recipes && recipes.length === 0 ? (
            <EmptyState
              title="No recipes yet"
              message="Ask for a cocktail and save what you like, or write down one of your own. Both end up in the same format, side by side."
              action={<Button label="Ask for a cocktail" onPress={() => router.push('/ask')} />}
            />
          ) : (
            <EmptyState
              title="Nothing here"
              message={
                filter === 'makeable'
                  ? 'None of your saved recipes match what’s on the shelf right now. Check your staples — limes and syrup are usually what’s missing.'
                  : 'Try a different filter.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/recipe/[id]', params: { id: item.id } }} asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <RecipeCard recipe={item} available={available} />
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerButtonPressed: {
    opacity: 0.6,
  },
  listHeader: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  filterRow: {
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.fillSubtle,
  },
  filterChipActive: {
    backgroundColor: colors.accentDim,
  },
  filterLabel: {
    ...typography.subheadline,
    color: colors.textMuted,
  },
  filterLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyWrap: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
});
