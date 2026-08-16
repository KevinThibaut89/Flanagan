import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { RecipeCard } from '../../src/components/RecipeCard';
import { Body, EmptyState, ErrorState, Loading, Muted, Screen, Title } from '../../src/components/ui';
import { useAvailableIngredientIds } from '../../src/data/bottles';
import { canMake, useRecipes } from '../../src/data/recipes';
import { colors, radius, spacing, typography } from '../../src/theme';

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
          <View>
            <Title>Recipes</Title>
            <Muted>
              {recipes?.length ?? 0} saved · {makeableCount} you can make now
            </Muted>
          </View>
        </View>

        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item.key)}
              style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
            >
              <Body style={[styles.filterLabel, filter === item.key && styles.filterLabelActive]}>
                {item.label}
              </Body>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshing={isRefetching}
        onRefresh={refetch}
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
          <Link href={{ pathname: '/recipe/[id]', params: { id: item.id } }} asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <RecipeCard recipe={item} available={available} />
            </Pressable>
          </Link>
        )}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/recipe/new')}
        accessibilityRole="button"
        accessibilityLabel="Write a recipe"
      >
        <MaterialCommunityIcons name="plus" size={26} color={colors.bg} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  filterRow: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  filterLabel: {
    ...typography.small,
    color: colors.textMuted,
  },
  filterLabelActive: {
    color: colors.accentSoft,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 96,
    gap: spacing.md,
  },
  emptyWrap: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
