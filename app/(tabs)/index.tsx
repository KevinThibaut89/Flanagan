import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { Chip } from '../../src/components/Chip';
import { useColorForKind } from '../../src/components/CategoryPill';
import {
  Body,
  Display,
  Flourish,
  Heading,
  Loading,
  Monogram,
  Muted,
  OrnamentRule,
  PressableScale,
  Reveal,
  Screen,
  SectionHeader,
} from '../../src/components/ui';
import { useAvailableIngredientIds, useBottles } from '../../src/data/bottles';
import { useIngredientIndex } from '../../src/data/ingredients';
import {
  canMake,
  recipeNumbers,
  useRecipes,
  type RecipeWithIngredients,
} from '../../src/data/recipes';
import { useTheme, useThemedStyles } from '../../src/providers/theme';
import { spacing, typography, type Theme } from '../../src/theme';
import type { Bottle } from '../../src/types/database';

const MOODS: Array<{ label: string; prompt: string }> = [
  { label: 'Bitter & stirred', prompt: 'Something bitter and stirred' },
  { label: 'Fresh & citrusy', prompt: 'Something fresh and citrusy' },
  { label: 'Short & strong', prompt: 'Something short, strong and spirit-forward' },
  { label: 'Surprise me', prompt: 'Surprise me with something I would not think of' },
];

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colorForKind = useColorForKind();
  const router = useRouter();
  const { data: bottles, isLoading: bottlesLoading } = useBottles();
  const { data: recipes, isLoading: recipesLoading } = useRecipes();
  const available = useAvailableIngredientIds();
  const { index } = useIngredientIndex();

  const inStock = useMemo(
    () => (bottles ?? []).filter((b) => b.status === 'in_stock'),
    [bottles],
  );
  // Finished bottles are kept rather than deleted, so this doubles as the shopping list.
  const emptyBottles = useMemo(
    () => (bottles ?? []).filter((b) => b.status !== 'in_stock'),
    [bottles],
  );
  const makeable = useMemo(
    () => (recipes ?? []).filter((recipe) => canMake(recipe, available)),
    [recipes, available],
  );
  const numbers = useMemo(() => recipeNumbers(recipes ?? []), [recipes]);

  // Favourites lead the shelf; the rest keep their newest-first order.
  const picks = useMemo(
    () =>
      [...makeable]
        .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
        .slice(0, 8),
    [makeable],
  );

  if (bottlesLoading || recipesLoading) return <Loading label="Setting up the bar…" />;

  const hasBottles = (bottles?.length ?? 0) > 0;
  const greeting = greetingForHour(new Date().getHours());

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
          <View style={styles.masthead}>
            <View style={styles.mastheadText}>
              <Display>{greeting}</Display>
              {hasBottles ? (
                <Muted>
                  {inStock.length} in stock · {makeable.length}{' '}
                  {makeable.length === 1 ? 'cocktail' : 'cocktails'} within reach
                </Muted>
              ) : (
                <Muted>Let’s get your bar set up.</Muted>
              )}
            </View>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={styles.settings}
            >
              <MaterialCommunityIcons name="cog-outline" size={21} color={colors.textFaint} />
            </Pressable>
          </View>

          <OrnamentRule style={styles.ornament} />

          <View style={styles.ask}>
            <Flourish style={styles.askInvitation}>What are you in the mood for?</Flourish>
            <Pressable
              onPress={() => router.push('/ask')}
              accessibilityRole="button"
              accessibilityLabel="Describe a cocktail"
              style={styles.askField}
            >
              <Text style={styles.askPlaceholder} numberOfLines={1}>
                Describe a drink — gin, floral, dry…
              </Text>
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.askSubmit}
              >
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.bg} />
              </LinearGradient>
            </Pressable>
            <View style={styles.moodRow}>
              {MOODS.map((mood) => (
                <Chip
                  key={mood.label}
                  label={mood.label}
                  onPress={() => router.push({ pathname: '/ask', params: { q: mood.prompt } })}
                />
              ))}
            </View>
          </View>

          {hasBottles ? (
            <>
              <View style={styles.ledger}>
                <LedgerColumn
                  value={inStock.length}
                  label="In stock"
                  href="/bar"
                />
                <View style={styles.ledgerRule} />
                <LedgerColumn
                  value={makeable.length}
                  label="Makeable"
                  href={{ pathname: '/recipes', params: { filter: 'makeable' } }}
                />
                <View style={styles.ledgerRule} />
                <LedgerColumn
                  value={emptyBottles.length}
                  label="Empty"
                  href={{ pathname: '/bar', params: { filter: 'out' } }}
                />
              </View>

              <View style={styles.section}>
                <SectionHeader
                  title="Makeable tonight"
                  actionLabel="All recipes"
                  onAction={() => router.push('/recipes')}
                />
                {picks.length > 0 ? (
                  <FlatList
                    horizontal
                    data={picks}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    style={styles.carouselBleed}
                    contentContainerStyle={styles.carousel}
                    renderItem={({ item }) => (
                      <PickCard
                        recipe={item}
                        number={numbers.get(item.id)}
                        baseColor={colorForKind(
                          item.base_ingredient_id
                            ? index?.byId.get(item.base_ingredient_id)?.kind
                            : null,
                        )}
                        ingredientName={(id, freeText) =>
                          (id ? index?.byId.get(id)?.name : null) ?? freeText
                        }
                        onPress={() =>
                          router.push({ pathname: '/recipe/[id]', params: { id: item.id } })
                        }
                      />
                    )}
                  />
                ) : (
                  <View style={styles.emptyPicks}>
                    <Flourish style={styles.emptyPicksText}>
                      {recipes && recipes.length > 0
                        ? 'Nothing in the notebook is makeable right now — check your staples, or ask for something new.'
                        : 'The notebook is empty. Ask for a cocktail built from what you have.'}
                    </Flourish>
                    <Button label="Ask for a cocktail" size="sm" onPress={() => router.push('/ask')} />
                  </View>
                )}
              </View>

              {emptyBottles.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Empty"
                    actionLabel="Open bar"
                    onAction={() => router.push({ pathname: '/bar', params: { filter: 'out' } })}
                  />
                  <View>
                    {emptyBottles.slice(0, 3).map((bottle, i) => (
                      <EmptyRow
                        key={bottle.id}
                        bottle={bottle}
                        first={i === 0}
                        onPress={() =>
                          router.push({ pathname: '/bottle/[id]', params: { id: bottle.id } })
                        }
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.welcome}>
              <Monogram size={64} />
              <Heading style={styles.welcomeTitle}>Stock your bar</Heading>
              <Flourish style={styles.welcomeText}>
                Scan a bottle’s barcode or add it by hand, then tick off the everyday staples —
                limes, syrup, soda — so Flanagan knows what you can actually pour.
              </Flourish>
              <View style={styles.welcomeActions}>
                <Button label="Scan a bottle" onPress={() => router.push('/scan')} />
                <Button label="Set staples" variant="ghost" onPress={() => router.push('/staples')} />
              </View>
            </View>
          )}

          <View style={styles.section}>
            <SectionHeader title="Bar keeping" />
            <View>
              <ShortcutRow first label="Scan a bottle" onPress={() => router.push('/scan')} />
              <ShortcutRow label="Add a bottle by hand" onPress={() => router.push('/bottle/new')} />
              <ShortcutRow label="Write a recipe" onPress={() => router.push('/recipe/new')} />
              <ShortcutRow label="Everyday staples" onPress={() => router.push('/staples')} />
            </View>
          </View>
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

function LedgerColumn({ value, label, href }: { value: number; label: string; href: Href }) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  return (
    <PressableScale
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={styles.ledgerColumn}
    >
      <Text style={styles.ledgerValue}>{value}</Text>
      <Text
        style={styles.ledgerLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function PickCard({
  recipe,
  number,
  baseColor,
  ingredientName,
  onPress,
}: {
  recipe: RecipeWithIngredients;
  number: number | undefined;
  baseColor: string;
  ingredientName: (id: string | null, freeText: string | null) => string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const lineNames = recipe.recipe_ingredients
    .filter((line) => !line.is_garnish)
    .map((line) => ingredientName(line.ingredient_id, line.free_text))
    .filter((name): name is string => Boolean(name));

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      style={styles.pickCard}
    >
      <View style={styles.pickHeader}>
        {number !== undefined ? <Flourish style={styles.pickNumber}>No. {number}</Flourish> : null}
        {recipe.is_favorite ? (
          <MaterialCommunityIcons name="star" size={14} color={colors.cream} />
        ) : null}
      </View>
      <Heading numberOfLines={2}>{recipe.title}</Heading>
      {lineNames.length > 0 ? (
        <Muted numberOfLines={2} style={styles.pickIngredients}>
          {lineNames.join(' · ')}
        </Muted>
      ) : null}
      <View style={styles.pickFooter}>
        <View style={[styles.pickDot, { backgroundColor: baseColor }]} />
        <Muted style={styles.pickSpecs} numberOfLines={1}>
          {[recipe.method, recipe.glass].filter(Boolean).join(' · ') || 'Ready to pour'}
        </Muted>
      </View>
    </PressableScale>
  );
}

function EmptyRow({
  bottle,
  first,
  onPress,
}: {
  bottle: Bottle;
  first: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${bottle.name}, empty`}
      style={[styles.emptyRow, !first && styles.rowDivider]}
    >
      <Body style={styles.emptyName} numberOfLines={1}>
        {bottle.name}
      </Body>
      <Text style={styles.emptyLabel}>Out</Text>
    </PressableScale>
  );
}

function ShortcutRow({
  label,
  onPress,
  first = false,
}: {
  label: string;
  onPress: () => void;
  first?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.shortcutRow, !first && styles.rowDivider]}
    >
      <Body style={styles.shortcutLabel}>{label}</Body>
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textFaint} />
    </PressableScale>
  );
}

const makeStyles = ({ colors }: Theme) => StyleSheet.create({
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.section + spacing.xl,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mastheadText: {
    flex: 1,
    gap: spacing.xs,
  },
  settings: {
    paddingTop: spacing.sm,
  },
  ornament: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },

  ask: {
    gap: spacing.md,
  },
  askInvitation: {
    fontSize: 19,
    lineHeight: 26,
  },
  askField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  askPlaceholder: {
    flex: 1,
    ...typography.body,
    color: colors.textFaint,
  },
  askSubmit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  ledger: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.section,
  },
  ledgerColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  ledgerRule: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
    backgroundColor: colors.border,
  },
  ledgerValue: {
    ...typography.statNumeral,
    color: colors.cream,
    fontVariant: ['tabular-nums'],
  },
  ledgerLabel: {
    ...typography.overline,
    fontSize: 10,
    letterSpacing: 1.2,
    textAlign: 'center',
    color: colors.textFaint,
  },

  section: {
    marginTop: spacing.section,
    gap: spacing.lg,
  },

  carouselBleed: {
    marginHorizontal: -spacing.gutter,
  },
  carousel: {
    gap: spacing.md,
    paddingHorizontal: spacing.gutter,
  },
  pickCard: {
    width: 232,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickNumber: {
    fontSize: 16,
    color: colors.cream,
  },
  pickIngredients: {
    fontSize: 12,
    lineHeight: 17,
  },
  pickFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pickDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pickSpecs: {
    flex: 1,
    fontSize: 12,
  },

  emptyPicks: {
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  emptyPicksText: {
    color: colors.textMuted,
  },

  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  emptyName: {
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
  },
  emptyLabel: {
    ...typography.small,
    color: colors.textFaint,
  },

  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg - 2,
  },
  shortcutLabel: {
    fontWeight: '600',
  },

  welcome: {
    alignItems: 'center',
    marginTop: spacing.section,
    gap: spacing.sm,
  },
  welcomeTitle: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  welcomeText: {
    textAlign: 'center',
    color: colors.textMuted,
    maxWidth: 300,
  },
  welcomeActions: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
});
