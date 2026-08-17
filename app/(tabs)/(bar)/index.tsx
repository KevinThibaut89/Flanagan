import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Link, Stack, useRouter } from 'expo-router';

import { Button } from '../../../src/components/Button';
import { CategoryPill, colorForKind } from '../../../src/components/CategoryPill';
import { Icon, type IconName } from '../../../src/components/Icon';
import { Body, EmptyState, ErrorState, Loading, Muted, Screen } from '../../../src/components/ui';
import { useBottles } from '../../../src/data/bottles';
import { useIngredientIndex } from '../../../src/data/ingredients';
import { select } from '../../../src/lib/haptics';
import { formatBottleSize } from '../../../src/lib/units';
import { useUnits } from '../../../src/providers/preferences';
import { colors, radius, spacing, typography } from '../../../src/theme';
import type { Bottle, IngredientKind } from '../../../src/types/database';

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
  const tabBarHeight = useBottomTabBarHeight();
  const { data: bottles, isLoading, error, refetch, isRefetching } = useBottles();
  const { index } = useIngredientIndex();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

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

  const screenOptions = (
    <Stack.Screen
      options={{
        headerLeft: () => (
          <HeaderButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        ),
        headerRight: () => (
          <View style={styles.headerActions}>
            <HeaderButton
              icon="staples"
              label="Staples"
              onPress={() => router.push('/staples')}
            />
            <HeaderButton
              icon="add"
              label="Add a bottle by hand"
              onPress={() => router.push('/bottle/new')}
            />
          </View>
        ),
        headerSearchBarOptions: {
          placeholder: 'Search your bottles',
          hideWhenScrolling: false,
          onChangeText: (event) => setSearch(event.nativeEvent.text),
          tintColor: colors.accent,
          textColor: colors.text,
        },
      }}
    />
  );

  if (isLoading) {
    return (
      <Screen edges={[]}>
        {screenOptions}
        <Loading label="Reading your shelf…" />
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Muted>
              {inStockCount} {inStockCount === 1 ? 'item' : 'items'} in stock
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
                  <Body
                    style={[styles.filterLabel, filter === item.key && styles.filterLabelActive]}
                  >
                    {item.label}
                  </Body>
                </Pressable>
              )}
            />
          </View>
        }
        ListEmptyComponent={
          bottles && bottles.length === 0 ? (
            <EmptyState
              title="Nothing on the shelf yet"
              message="Scan a bottle’s barcode to add it, or enter one by hand. Add your everyday staples too — limes, syrup, soda — so Flanagan knows what you can actually make."
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
          />
        )}
      />
    </Screen>
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && styles.headerButtonPressed}
    >
      <Icon name={icon} size={22} color={colors.accent} />
    </Pressable>
  );
}

function BottleRow({
  bottle,
  kind,
  units,
}: {
  bottle: Bottle;
  kind: IngredientKind | null;
  units: 'metric' | 'imperial';
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
    <Link href={{ pathname: '/bottle/[id]', params: { id: bottle.id } }} asChild>
      <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
        <View style={[styles.swatch, { backgroundColor: colorForKind(kind) }]} />

        <View style={styles.rowBody}>
          <Body style={[styles.rowTitle, isOut && styles.rowTitleOut]} numberOfLines={1}>
            {bottle.name}
          </Body>
          {meta.length > 0 ? (
            <Muted numberOfLines={1}>{meta.join(' · ')}</Muted>
          ) : null}
        </View>

        <View style={styles.rowRight}>
          {isOut ? (
            <Muted style={{ color: colors.textFaint }}>Out</Muted>
          ) : (
            <>
              <FillBar pct={bottle.fill_pct} low={isLow} />
              {bottle.kind === 'staple' ? null : (
                <Muted style={styles.fillLabel}>{bottle.fill_pct}%</Muted>
              )}
            </>
          )}
          <CategoryPill kind={kind} />
        </View>
      </Pressable>
    </Link>
  );
}

function FillBar({ pct, low }: { pct: number; low: boolean }) {
  return (
    <View style={styles.fillTrack}>
      <View
        style={[
          styles.fillLevel,
          { width: `${Math.max(pct, 2)}%`, backgroundColor: low ? colors.warning : colors.success },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  headerButtonPressed: {
    opacity: 0.6,
  },
  listHeader: {
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
  },
  emptyWrap: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    opacity: 0.6,
  },
  swatch: {
    width: 4,
    height: 36,
    borderRadius: radius.sm,
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
    textDecorationLine: 'line-through',
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  fillTrack: {
    width: 52,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fillLevel: {
    height: '100%',
    borderRadius: radius.pill,
  },
  fillLabel: {
    fontSize: 11,
  },
});
