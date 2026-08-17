import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { colorForKind } from '../../src/components/CategoryPill';
import {
  Body,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  PressableScale,
  Screen,
  Title,
} from '../../src/components/ui';
import { useBottles } from '../../src/data/bottles';
import { useIngredientIndex } from '../../src/data/ingredients';
import { formatBottleSize } from '../../src/lib/units';
import { useUnits } from '../../src/providers/preferences';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Bottle, IngredientKind } from '../../src/types/database';

type Filter = 'all' | 'bottles' | 'staples' | 'low' | 'out';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'bottles', label: 'Bottles' },
  { key: 'staples', label: 'Staples' },
  { key: 'low', label: 'Running low' },
  { key: 'out', label: 'Out' },
];

/** Below this the bottle shows as running low. */
const LOW_FILL_PCT = 25;

export default function BarScreen() {
  const router = useRouter();
  const units = useUnits();
  const { data: bottles, isLoading, error, refetch, isRefetching } = useBottles();
  const { index } = useIngredientIndex();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Home deep-links into a pre-filtered view, e.g. /bar?filter=low.
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  useEffect(() => {
    if (filterParam && FILTERS.some((f) => f.key === filterParam)) {
      setFilter(filterParam as Filter);
    }
  }, [filterParam]);

  const visible = useMemo(() => {
    if (!bottles) return [];
    const needle = search.trim().toLowerCase();

    return bottles.filter((bottle) => {
      if (filter === 'bottles' && bottle.kind !== 'bottle') return false;
      if (filter === 'staples' && bottle.kind !== 'staple') return false;
      if (filter === 'out' && bottle.status === 'in_stock') return false;
      if (filter === 'low') {
        if (bottle.status !== 'in_stock') return false;
        if (bottle.fill_pct > LOW_FILL_PCT) return false;
      }
      if (filter !== 'out' && filter !== 'low' && bottle.status === 'finished') return false;

      if (!needle) return true;
      return (
        bottle.name.toLowerCase().includes(needle) ||
        (bottle.brand?.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [bottles, search, filter]);

  const inStockCount = useMemo(
    () => (bottles ?? []).filter((b) => b.status === 'in_stock').length,
    [bottles],
  );

  if (isLoading) return <Loading label="Reading your shelf…" />;
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
            <Title>The bar</Title>
            <Muted>
              {inStockCount} {inStockCount === 1 ? 'item' : 'items'} in stock
            </Muted>
          </View>
          <View style={styles.headerActions}>
            <HeaderIcon icon="barcode-scan" label="Scan a bottle" onPress={() => router.push('/scan')} />
            <HeaderIcon icon="plus" label="Add a bottle by hand" onPress={() => router.push('/bottle/new')} />
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search your bottles"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.accent}
            autoCorrect={false}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
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
        contentContainerStyle={visible.length === 0 ? styles.emptyWrap : styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          bottles && bottles.length === 0 ? (
            <EmptyState
              title="Nothing on the shelf yet"
              message="Scan a bottle’s barcode to add it, or enter one by hand — and tick off the everyday staples so Flanagan knows what you can actually make."
              action={<Button label="Scan a bottle" onPress={() => router.push('/scan')} />}
            />
          ) : (
            <EmptyState title="Nothing matches" message="Try a different search or filter." />
          )
        }
        renderItem={({ item }) => (
          <BottleRow
            bottle={item}
            kind={item.ingredient_id ? index?.byId.get(item.ingredient_id)?.kind ?? null : null}
            units={units}
            onPress={() => router.push({ pathname: '/bottle/[id]', params: { id: item.id } })}
          />
        )}
      />
    </Screen>
  );
}

function HeaderIcon({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.headerIcon}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.textMuted} />
    </PressableScale>
  );
}

function BottleRow({
  bottle,
  kind,
  units,
  onPress,
}: {
  bottle: Bottle;
  kind: IngredientKind | null;
  units: 'metric' | 'imperial';
  onPress: () => void;
}) {
  const size = formatBottleSize(bottle.volume_ml, units);
  const isOut = bottle.status !== 'in_stock';
  const isLow = !isOut && bottle.fill_pct <= LOW_FILL_PCT;

  const meta = [
    bottle.brand,
    size,
    bottle.abv !== null ? `${bottle.abv}%` : null,
  ].filter(Boolean) as string[];

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={bottle.name}
      style={styles.row}
    >
      <View style={[styles.dot, { backgroundColor: colorForKind(kind) }, isOut && styles.dotOut]} />

      <View style={styles.rowBody}>
        <Body style={[styles.rowTitle, isOut && styles.rowTitleOut]} numberOfLines={1}>
          {bottle.name}
        </Body>
        {meta.length > 0 ? <Muted numberOfLines={1}>{meta.join(' · ')}</Muted> : null}
      </View>

      <View style={styles.rowRight}>
        {isOut ? (
          <Text style={styles.outLabel}>Out</Text>
        ) : bottle.kind === 'staple' ? (
          <MaterialCommunityIcons name="check" size={16} color={colors.textFaint} />
        ) : (
          <>
            <View style={styles.fillTrack}>
              <View
                style={[
                  styles.fillLevel,
                  {
                    width: `${Math.max(bottle.fill_pct, 2)}%`,
                    backgroundColor: isLow ? colors.warning : colors.textFaint,
                  },
                ]}
              />
            </View>
            <Text style={[styles.fillLabel, isLow && styles.fillLabelLow]}>
              {bottle.fill_pct}%
            </Text>
          </>
        )}
      </View>
    </PressableScale>
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
  headerActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerIcon: {
    paddingVertical: spacing.xs,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
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
  },
  emptyWrap: {
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginLeft: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg - 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotOut: {
    opacity: 0.35,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontWeight: '600',
  },
  rowTitleOut: {
    color: colors.textFaint,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  outLabel: {
    ...typography.small,
    color: colors.textFaint,
  },
  fillTrack: {
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fillLevel: {
    height: '100%',
  },
  fillLabel: {
    fontSize: 11,
    color: colors.textFaint,
    fontVariant: ['tabular-nums'],
  },
  fillLabelLow: {
    color: colors.warning,
  },
});
