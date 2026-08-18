import { useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { ConfirmSheet } from '../../src/components/ConfirmSheet';
import { RecipeCard } from '../../src/components/RecipeCard';
import { RecipeFilterSheet } from '../../src/components/RecipeFilterSheet';
import { SearchField } from '../../src/components/SearchField';
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
import { useIngredientIndex } from '../../src/data/ingredients';
import {
  EMPTY_FACETS,
  activeFacetCount,
  matchesFacets,
  matchesSearch,
  recipeFacets,
  recipeHaystack,
  searchTerms,
  sortRecipes,
  type RecipeFacetSelection,
  type RecipeSort,
} from '../../src/data/recipeSearch';
import {
  canMake,
  missingIngredients,
  recipeNumbers,
  useDeleteRecipe,
  useRecipes,
  type RecipeWithIngredients,
} from '../../src/data/recipes';
import { useTheme } from '../../src/providers/theme';
import { radius, spacing } from '../../src/theme';

type Filter = 'all' | 'makeable' | 'mine' | 'suggested' | 'favorites';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'makeable', label: 'Makeable now' },
  { key: 'favorites', label: 'Favourites' },
  { key: 'mine', label: 'Mine' },
  { key: 'suggested', label: 'Suggested' },
];

/**
 * An ingredient-scoped view Home links into: `uses` = every recipe that calls
 * for the ingredient; `almost` = recipes that need it and nothing else. It
 * shows as a temporary leading chip and clears when any regular chip is tapped.
 */
type Focus = { mode: 'uses' | 'almost'; ingredientId: string };

export default function RecipesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: recipes, isLoading, error, refetch, isRefetching } = useRecipes();
  const available = useAvailableIngredientIds();
  const deleteRecipe = useDeleteRecipe();

  const [filter, setFilter] = useState<Filter>('all');
  const [focus, setFocus] = useState<Focus | null>(null);
  const { index } = useIngredientIndex();

  // Search and the facet sheet narrow whatever the chips have chosen. They
  // compose with (rather than replace) the quick filter and focus.
  const [query, setQuery] = useState('');
  const [facets, setFacets] = useState<RecipeFacetSelection>(EMPTY_FACETS);
  const [sort, setSort] = useState<RecipeSort>('newest');
  const [sheetOpen, setSheetOpen] = useState(false);

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
    deleteRecipe.mutate(pendingDelete, { onSettled: cancelDelete });
  };

  // Home deep-links into a pre-filtered view, e.g. /recipes?filter=makeable
  // or /recipes?mode=almost&ingredient=<id>&t=<stamp>.
  const {
    filter: filterParam,
    mode,
    ingredient,
    t,
  } = useLocalSearchParams<{ filter?: string; mode?: string; ingredient?: string; t?: string }>();
  // Either link should land on exactly the view Home promised, so any search
  // or facet the user left behind is cleared.
  useEffect(() => {
    if (filterParam && FILTERS.some((f) => f.key === filterParam)) {
      setFilter(filterParam as Filter);
      setQuery('');
      setFacets(EMPTY_FACETS);
    }
  }, [filterParam]);
  useEffect(() => {
    if ((mode === 'uses' || mode === 'almost') && typeof ingredient === 'string' && ingredient) {
      setFocus({ mode, ingredientId: ingredient });
      setFilter('all');
      setQuery('');
      setFacets(EMPTY_FACETS);
    }
  }, [mode, ingredient, t]);

  const pickFilter = (next: Filter) => {
    setFocus(null);
    setFilter(next);
  };

  const numbers = useMemo(() => recipeNumbers(recipes ?? []), [recipes]);

  // Searchable text per recipe, built once per library/index change rather
  // than on every keystroke.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const recipe of recipes ?? []) map.set(recipe.id, recipeHaystack(recipe, index));
    return map;
  }, [recipes, index]);
  const terms = useMemo(() => searchTerms(query), [query]);
  const facetOptions = useMemo(() => recipeFacets(recipes ?? [], index), [recipes, index]);
  const facetCount = activeFacetCount(facets);

  const visible = useMemo(() => {
    if (!recipes) return [];
    const scoped = focus
      ? recipes.filter((recipe) => {
          if (focus.mode === 'uses') {
            return recipe.recipe_ingredients.some((line) => line.ingredient_id === focus.ingredientId);
          }
          const missing = missingIngredients(recipe, available);
          return missing.length === 1 && missing[0].ingredient_id === focus.ingredientId;
        })
      : recipes.filter((recipe) => {
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
    const narrowed = scoped.filter(
      (recipe) =>
        matchesFacets(recipe, facets, index) && matchesSearch(haystacks.get(recipe.id) ?? '', terms),
    );
    return sortRecipes(narrowed, sort);
  }, [recipes, filter, focus, available, facets, index, haystacks, terms, sort]);

  const isNarrowed = terms.length > 0 || facetCount > 0 || focus !== null || filter !== 'all';

  const openSheet = () => {
    Keyboard.dismiss();
    setOpenId(null);
    setSheetOpen(true);
  };

  const changeQuery = (next: string) => {
    setOpenId(null);
    setQuery(next);
  };

  const focusLabel = useMemo(() => {
    if (!focus) return null;
    const name = index?.byId.get(focus.ingredientId)?.name ?? 'this ingredient';
    return focus.mode === 'uses' ? `With ${name}` : `One away: ${name}`;
  }, [focus, index]);

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
              {isNarrowed
                ? `${visible.length} of ${recipes?.length ?? 0} recipes`
                : `${recipes?.length ?? 0} saved · ${makeableCount} you can make now`}
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

        <SearchField
          value={query}
          onChangeText={changeQuery}
          placeholder="Search recipes"
          returnKeyType="search"
        />

        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          style={styles.filterBleed}
          contentContainerStyle={styles.filterRow}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.leadingChips}>
              <Chip
                label="Filters"
                icon="filter-outline"
                count={facetCount}
                active={facetCount > 0 || sort !== 'newest'}
                onPress={openSheet}
              />
              {focus && focusLabel ? (
                <Chip label={focusLabel} active onPress={() => setFocus(null)} />
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              active={!focus && filter === item.key}
              onPress={() => pickFilter(item.key)}
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
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={visible.length === 0 ? styles.emptyWrap : styles.listContent}
        ListEmptyComponent={
          recipes && recipes.length === 0 ? (
            <EmptyState
              title="No recipes yet"
              message="Ask for a cocktail and save what you like, or write down one of your own. Both end up in the same format, side by side."
              action={<Button label="Ask for a cocktail" onPress={() => router.push('/ask')} />}
            />
          ) : terms.length > 0 ? (
            <EmptyState
              title={`Nothing matches “${query.trim()}”`}
              message="Try fewer words, or search by an ingredient, glass or flavour."
              action={<Button label="Clear search" variant="secondary" onPress={() => setQuery('')} />}
            />
          ) : facetCount > 0 ? (
            <EmptyState
              title="Nothing matches these filters"
              message="Loosen one of them, or clear the lot and start again."
              action={
                <Button label="Clear filters" variant="secondary" onPress={() => setFacets(EMPTY_FACETS)} />
              }
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

      <RecipeFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        facets={facetOptions}
        selection={facets}
        onChange={setFacets}
        sort={sort}
        onChangeSort={setSort}
        resultCount={visible.length}
        onClearAll={() => {
          setFacets(EMPTY_FACETS);
          setSort('newest');
        }}
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
  leadingChips: {
    flexDirection: 'row',
    gap: spacing.sm,
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
