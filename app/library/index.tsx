import { useMemo, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { RecipeCard } from '../../src/components/RecipeCard';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SearchField } from '../../src/components/SearchField';
import {
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  PressableScale,
  Screen,
} from '../../src/components/ui';
import { useAvailableIngredientIds } from '../../src/data/bottles';
import {
  libraryToPreview,
  useLibraryBrowse,
  useLibrarySearch,
  type LibraryRecipeRow,
  type LibrarySort,
} from '../../src/data/library';
import { useThemedStyles } from '../../src/providers/theme';
import { spacing, type Theme } from '../../src/theme';

/**
 * The house book: every drink the Barkeep has ever made for anyone, shared
 * and anonymous. Browse it newest-first or by how often it has been asked
 * for, narrow it to what your own shelf can pour, or describe a mood and let
 * the search rank the book by meaning rather than by matching words.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const styles = useThemedStyles(makeStyles);
  const available = useAvailableIngredientIds();

  // `/library?q=…` opens the book already searching — the Ask tab hands its
  // words over this way.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof q === 'string' ? q : '');
  const [makeable, setMakeable] = useState(false);
  const [sort, setSort] = useState<LibrarySort>('newest');

  const browse = useLibraryBrowse({ makeable, sort });
  const search = useLibrarySearch(query, { makeable });

  // While a search is active the list is the search; otherwise the browse.
  const searching = search.active;
  const rows: LibraryRecipeRow[] = (searching ? search.data : browse.data) ?? [];
  const isLoading = searching ? search.isLoading : browse.isLoading;
  const error = searching ? search.error : browse.error;
  const refetch = searching ? search.refetch : browse.refetch;

  const previews = useMemo(
    () => new Map(rows.map((row) => [row.id, libraryToPreview(row)])),
    [rows],
  );

  const subtitle = searching
    ? search.isFetching
      ? 'Searching…'
      : `${rows.length} ${rows.length === 1 ? 'match' : 'matches'}`
    : browse.data
      ? `${browse.data.length} ${browse.data.length === 1 ? 'drink' : 'drinks'}${makeable ? ' you can make now' : ''}`
      : null;

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="House book" subtitle={subtitle} />

      <View style={styles.controls}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Describe a mood, a spirit, a drink…"
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        <View style={styles.chipRow}>
          <Chip label="Makeable now" active={makeable} onPress={() => setMakeable((v) => !v)} />
          {!searching ? (
            <>
              <Chip label="Newest" active={sort === 'newest'} onPress={() => setSort('newest')} />
              <Chip label="Most asked" active={sort === 'popular'} onPress={() => setSort('popular')} />
            </>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <Loading label={searching ? 'Reading the book…' : 'Opening the house book…'} />
      ) : error ? (
        <ErrorState error={error} action={<Button label="Try again" onPress={() => refetch()} />} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          refreshing={browse.isRefetching && !searching}
          onRefresh={searching ? undefined : () => browse.refetch()}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.listContent}
          ListEmptyComponent={
            searching ? (
              <EmptyState
                title={`Nothing close to “${search.debounced}”`}
                message={
                  makeable
                    ? 'Nothing in the book that you can make now reads like that. Try without the makeable filter, or ask the Barkeep.'
                    : 'The book is young. Ask the Barkeep — whatever it makes goes in here for everyone.'
                }
                action={
                  <Button
                    label="Ask the Barkeep"
                    onPress={() => router.push({ pathname: '/ask', params: { q: query, t: String(Date.now()) } })}
                  />
                }
              />
            ) : makeable ? (
              <EmptyState
                title="Nothing you can make yet"
                message="None of the drinks in the book match what’s on your shelf right now. Check your staples, or browse everything."
                action={<Button label="Show everything" variant="secondary" onPress={() => setMakeable(false)} />}
              />
            ) : (
              <EmptyState
                title="The book is empty"
                message="Every drink the Barkeep makes for anyone is written in here. Ask for one and it becomes the first page."
                action={<Button label="Ask the Barkeep" onPress={() => router.push('/ask')} />}
              />
            )
          }
          renderItem={({ item }) => {
            const preview = previews.get(item.id);
            if (!preview) return null;
            return (
              <PressableScale
                onPress={() => router.push({ pathname: '/library/[id]', params: { id: item.id } })}
                accessibilityRole="button"
                accessibilityLabel={item.title}
              >
                <RecipeCard recipe={preview} available={available} />
                {item.times_suggested > 1 ? (
                  <Muted style={styles.asked}>
                    Asked {item.times_suggested} times
                  </Muted>
                ) : null}
              </PressableScale>
            );
          }}
        />
      )}
    </Screen>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    controls: {
      paddingHorizontal: spacing.gutter,
      gap: spacing.md,
      paddingBottom: spacing.md,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    listContent: {
      paddingHorizontal: spacing.gutter,
      paddingBottom: spacing.section,
      gap: spacing.md,
    },
    emptyWrap: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.gutter,
    },
    asked: {
      color: colors.textFaint,
      marginTop: -spacing.xs,
      marginLeft: spacing.sm,
    },
  });
