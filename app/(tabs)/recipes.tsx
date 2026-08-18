import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { ConfirmSheet } from '../../src/components/ConfirmSheet';
import { RecipeCard } from '../../src/components/RecipeCard';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import {
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  PressableScale,
  Screen,
  Title,
} from '../../src/components/ui';
import { useAvailableIngredientIds } from '../../src/data/bottles';
import {
  canMake,
  recipeNumbers,
  useDeleteRecipe,
  useRecipes,
  type RecipeWithIngredients,
} from '../../src/data/recipes';
import { colors, radius, spacing } from '../../src/theme';

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
  const { data: recipes, isLoading, error, refetch, isRefetching } = useRecipes();
  const available = useAvailableIngredientIds();
  const deleteRecipe = useDeleteRecipe();

  const [filter, setFilter] = useState<Filter>('all');

  // Swipe-to-delete: one card peeked open at a time, scrolling paused mid-drag,
  // and the same confirmation sheet as the recipe screen before anything goes.
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RecipeWithIngredients | null>(null);

  const cancelDelete = () => {
    setPendingDelete(null);
    setOpenId(null);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteRecipe.mutate(pendingDelete.id, { onSettled: cancelDelete });
  };

  // Home deep-links into a pre-filtered view, e.g. /recipes?filter=makeable.
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  useEffect(() => {
    if (filterParam && FILTERS.some((f) => f.key === filterParam)) {
      setFilter(filterParam as Filter);
    }
  }, [filterParam]);

  const numbers = useMemo(() => recipeNumbers(recipes ?? []), [recipes]);

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

  if (isLoading) return <Loading label="Opening your notebook…" />;
  if (error) {
    return (
      <Screen>
        <ErrorState error={error} action={<Button label="Try again" onPress={() => refetch()} />} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Title>Recipes</Title>
            <Muted>
              {recipes?.length ?? 0} saved · {makeableCount} you can make now
            </Muted>
          </View>
          <PressableScale
            onPress={() => router.push('/recipe/new')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Write a recipe"
            style={styles.headerIcon}
          >
            <MaterialCommunityIcons name="plus" size={22} color={colors.textMuted} />
          </PressableScale>
        </View>

        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          style={styles.filterBleed}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              active={filter === item.key}
              onPress={() => setFilter(item.key)}
            />
          )}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={refetch}
        scrollEnabled={!dragging}
        onScrollBeginDrag={() => setOpenId(null)}
        contentContainerStyle={visible.length === 0 ? styles.emptyWrap : styles.listContent}
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
          <SwipeableRow
            borderRadius={radius.lg}
            open={openId === item.id ? 'right' : null}
            onOpen={() => setOpenId(item.id)}
            onClose={() => setOpenId((cur) => (cur === item.id ? null : cur))}
            onDragStateChange={setDragging}
            right={{
              label: 'Delete',
              icon: 'trash-can-outline',
              color: colors.danger,
              onPress: () => setPendingDelete(item),
            }}
          >
            <PressableScale
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
              accessibilityRole="button"
              accessibilityLabel={item.title}
            >
              <RecipeCard recipe={item} available={available} number={numbers.get(item.id)} />
            </PressableScale>
          </SwipeableRow>
        )}
      />

      <ConfirmSheet
        visible={pendingDelete !== null}
        title="Delete this recipe?"
        message="It leaves the notebook for good — this cannot be undone."
        confirmLabel="Delete"
        busy={deleteRecipe.isPending}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    gap: spacing.xs,
  },
  headerIcon: {
    paddingTop: spacing.sm,
  },
  filterBleed: {
    marginHorizontal: -spacing.gutter,
    flexGrow: 0,
  },
  filterRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  emptyWrap: {
    flexGrow: 1,
  },
});
