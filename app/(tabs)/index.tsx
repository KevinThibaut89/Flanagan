import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { CategoryPill, colorForKind } from '../../src/components/CategoryPill';
import { Body, EmptyState, ErrorState, Loading, Muted, Screen, Title } from '../../src/components/ui';
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
          <View>
            <Title>Your bar</Title>
            <Muted>
              {inStockCount} {inStockCount === 1 ? 'item' : 'items'} in stock
            </Muted>
          </View>
          <View style={styles.headerActions}>
            <IconButton icon="tune-variant" label="Staples" onPress={() => router.push('/staples')} />
            <IconButton icon="cog-outline" label="Settings" onPress={() => router.push('/settings')} />
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
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setFilter(item.key)}
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

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/bottle/new')}
        accessibilityRole="button"
        accessibilityLabel="Add a bottle by hand"
      >
        <MaterialCommunityIcons name="plus" size={26} color={colors.bg} />
      </Pressable>
    </Screen>
  );
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.textMuted} />
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
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 96,
  },
  emptyWrap: {
    flexGrow: 1,
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
