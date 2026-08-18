import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { labelForKind, useColorForKind } from '../../src/components/CategoryPill';
import { IngredientSearchModal } from '../../src/components/IngredientPicker';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import {
  Body,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  PressableScale,
  Screen,
} from '../../src/components/ui';
import { useAddBottles, useBottles } from '../../src/data/bottles';
import { useIdentifyBottles, type IdentifiedBottle } from '../../src/data/identify';
import { useIngredientIndex } from '../../src/data/ingredients';
import { takePendingCapture, type ShelfCapture } from '../../src/data/shelfCapture';
import { formatBottleSize } from '../../src/lib/units';
import { useUnits } from '../../src/providers/preferences';
import { useTheme, useThemedStyles } from '../../src/providers/theme';
import { radius, spacing, type Theme } from '../../src/theme';

/**
 * The review step between a shelf photo and the bar.
 *
 * The model's reading is a prefill, never the truth — same rule as the
 * single-bottle classifier. So every recognised bottle lands here as a ticked
 * (or, when it looks doubtful, unticked) row the user can check, re-categorise,
 * or leave out, and nothing touches the database until they say so.
 */

interface ReviewRow {
  key: string;
  name: string;
  brand: string | null;
  ingredientId: string | null;
  abv: number | null;
  volumeMl: number | null;
  confidence: IdentifiedBottle['confidence'];
  /** Something with the same name is already on the shelf. */
  existing: boolean;
  selected: boolean;
}

/** Case- and whitespace-insensitive identity for "is this already in my bar?" */
function bottleKey(name: string, brand: string | null): string {
  return `${name.trim().toLowerCase()}|${(brand ?? '').trim().toLowerCase()}`;
}

export default function ReviewBottlesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colorForKind = useColorForKind();
  const units = useUnits();
  const { data: bottles } = useBottles();
  const { index } = useIngredientIndex();
  const identify = useIdentifyBottles();
  const addBottles = useAddBottles();

  // Taken once, on first render: the slot is cleared as soon as it is read, so
  // a re-render (or a second visit) cannot resubmit a stale photo.
  const captureRef = useRef<ShelfCapture | null | undefined>(undefined);
  if (captureRef.current === undefined) captureRef.current = takePendingCapture();
  const capture = captureRef.current;

  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const ownedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const bottle of bottles ?? []) {
      if (bottle.status !== 'finished') set.add(bottleKey(bottle.name, bottle.brand));
    }
    return set;
  }, [bottles]);

  // Keep the latest ownership set reachable from the one-shot mutation
  // callback without re-arming the effect that fires it.
  const ownedRef = useRef(ownedKeys);
  ownedRef.current = ownedKeys;

  const runIdentify = useCallback(() => {
    if (!capture) return;
    setRows(null);
    identify.mutate(
      { base64: capture.base64, mimeType: capture.mimeType },
      {
        onSuccess: (result) => {
          setRows(
            result.bottles.map((bottle, i) => {
              const existing = ownedRef.current.has(bottleKey(bottle.name, bottle.brand));
              return {
                key: `${i}-${bottle.name}`,
                name: bottle.name,
                brand: bottle.brand,
                ingredientId: bottle.ingredient_id,
                abv: bottle.abv,
                volumeMl: bottle.volume_ml,
                confidence: bottle.confidence,
                existing,
                // Doubtful readings and duplicates start unticked: an unwanted
                // bottle is easier to spot as an unchecked row than to hunt
                // down in the bar afterwards.
                selected: bottle.confidence !== 'low' && !existing,
              };
            }),
          );
        },
      },
    );
    // `identify` is a fresh object every render; keying on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);

  // One request per photo, however many times the effect is invoked.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!capture) {
      // Nothing to review — landed here without a photo (deep link, reload).
      if (router.canGoBack()) router.back();
      else router.replace('/scan');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    runIdentify();
  }, [capture, runIdentify, router]);

  const selectedRows = useMemo(() => rows?.filter((row) => row.selected) ?? [], [rows]);
  const editingRow = rows?.find((row) => row.key === editingKey) ?? null;

  function updateRow(key: string, patch: Partial<ReviewRow>) {
    setRows((current) =>
      current ? current.map((row) => (row.key === key ? { ...row, ...patch } : row)) : current,
    );
  }

  function retake() {
    if (router.canGoBack()) router.back();
    else router.replace('/scan');
  }

  function handleAdd() {
    if (selectedRows.length === 0) return;
    addBottles.mutate(
      selectedRows.map((row) => ({
        name: row.name,
        brand: row.brand,
        ingredient_id: row.ingredientId,
        kind: 'bottle' as const,
        abv: row.abv,
        volume_ml: row.volumeMl,
        fill_pct: 100,
        status: 'in_stock' as const,
        product_id: null,
        image_url: null,
        notes: null,
      })),
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Review sits on top of the scanner modal; drop both and land on the bar.
          router.dismissAll();
          router.navigate('/bar');
        },
      },
    );
  }

  if (!capture) return null;

  const count = selectedRows.length;
  const subtitle = rows
    ? `${rows.length} found · ${count} to add`
    : identify.isPending
      ? 'Reading the labels…'
      : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Bottles in your photo" subtitle={subtitle} onBack={retake} />

      {identify.isPending || (!rows && !identify.isError) ? (
        <View style={styles.stateWrap}>
          <Image source={{ uri: capture.uri }} style={styles.heroThumb} contentFit="cover" />
          <Loading label="Reading the labels…" />
        </View>
      ) : identify.isError ? (
        <ErrorState
          error={identify.error}
          action={
            <View style={styles.stateActions}>
              <Button label="Try again" onPress={runIdentify} />
              <Button label="Retake photo" variant="ghost" onPress={retake} />
            </View>
          }
        />
      ) : rows && rows.length === 0 ? (
        <EmptyState
          title="No bottles found"
          message={identify.data?.message ?? 'Try closer, or with more light.'}
          action={<Button label="Retake photo" variant="secondary" onPress={retake} />}
        />
      ) : (
        <>
          <FlatList
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Image source={{ uri: capture.uri }} style={styles.thumb} contentFit="cover" />
                <Muted style={styles.hint}>
                  Tick what to add and check what each bottle counts as — a wrong match changes
                  what you can make.
                </Muted>
              </View>
            }
            renderItem={({ item }) => {
              const ingredient = item.ingredientId
                ? index?.byId.get(item.ingredientId) ?? null
                : null;
              const size = formatBottleSize(item.volumeMl, units);
              const meta = [item.brand, item.abv !== null ? `${item.abv}%` : null, size]
                .filter(Boolean)
                .join(' · ');

              return (
                <View style={styles.row}>
                  <PressableScale
                    onPress={() => {
                      void Haptics.selectionAsync();
                      updateRow(item.key, { selected: !item.selected });
                    }}
                    style={styles.rowMain}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.selected }}
                    accessibilityLabel={item.name}
                  >
                    <MaterialCommunityIcons
                      name={item.selected ? 'check-circle' : 'circle-outline'}
                      size={22}
                      color={item.selected ? colors.success : colors.textFaint}
                    />
                    <View style={styles.rowText}>
                      <Body style={[styles.name, !item.selected && styles.nameMuted]}>
                        {item.name}
                      </Body>
                      {meta ? <Muted numberOfLines={1}>{meta}</Muted> : null}
                      {item.existing ? (
                        <Muted style={styles.flag}>Already in your bar</Muted>
                      ) : item.confidence === 'low' ? (
                        <Muted style={styles.flag}>Hard to read — check the name</Muted>
                      ) : null}
                    </View>
                  </PressableScale>

                  <Pressable
                    onPress={() => setEditingKey(item.key)}
                    style={styles.countsAs}
                    accessibilityRole="button"
                    accessibilityLabel={
                      ingredient ? `Counts as ${ingredient.name}, change` : 'Set what this counts as'
                    }
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: ingredient ? colorForKind(ingredient.kind) : colors.textFaint },
                      ]}
                    />
                    <View style={styles.countsAsText}>
                      {ingredient ? (
                        <>
                          <Body numberOfLines={1}>{ingredient.name}</Body>
                          <Muted numberOfLines={1}>{labelForKind(ingredient.kind)}</Muted>
                        </>
                      ) : (
                        <>
                          <Body style={styles.unset} numberOfLines={1}>
                            Not sure
                          </Body>
                          <Muted numberOfLines={1}>Tap to set</Muted>
                        </>
                      )}
                    </View>
                    <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textFaint} />
                  </Pressable>
                </View>
              );
            }}
          />

          <View style={styles.footer}>
            <Button
              label={count === 1 ? 'Add 1 bottle' : `Add ${count} bottles`}
              onPress={handleAdd}
              disabled={count === 0}
              loading={addBottles.isPending}
            />
            {addBottles.error ? (
              <Body style={styles.error}>
                {addBottles.error instanceof Error
                  ? addBottles.error.message
                  : 'Could not add those bottles.'}
              </Body>
            ) : null}
            <Button label="Retake photo" variant="ghost" onPress={retake} />
          </View>
        </>
      )}

      <IngredientSearchModal
        visible={editingRow !== null}
        onClose={() => setEditingKey(null)}
        onSelect={(ingredient) => {
          if (editingRow) updateRow(editingRow.key, { ingredientId: ingredient.id });
          setEditingKey(null);
        }}
      />
    </Screen>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    stateWrap: {
      flex: 1,
    },
    heroThumb: {
      marginHorizontal: spacing.gutter,
      marginTop: spacing.lg,
      height: 160,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    stateActions: {
      gap: spacing.sm,
      alignSelf: 'stretch',
    },
    list: {
      paddingHorizontal: spacing.gutter,
      paddingBottom: spacing.xl,
    },
    listHeader: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    thumb: {
      height: 120,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    hint: {
      lineHeight: 18,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSubtle,
    },
    row: {
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontWeight: '600',
    },
    nameMuted: {
      color: colors.textMuted,
    },
    flag: {
      color: colors.warning,
      fontSize: 12,
    },
    countsAs: {
      marginLeft: 22 + spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    countsAsText: {
      flex: 1,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    unset: {
      color: colors.textMuted,
    },
    footer: {
      paddingHorizontal: spacing.gutter,
      paddingTop: spacing.md,
      gap: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
    error: {
      color: colors.danger,
      textAlign: 'center',
    },
  });
