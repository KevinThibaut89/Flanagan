import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Button } from '../../src/components/Button';
import { useColorForKind } from '../../src/components/CategoryPill';
import {
  Display,
  Flourish,
  Heading,
  Loading,
  Monogram,
  Muted,
  PressableScale,
  Reveal,
  Screen,
  SectionHeader,
  Title,
} from '../../src/components/ui';
import { useAvailableIngredientIds, useBottles } from '../../src/data/bottles';
import { useIngredientIndex } from '../../src/data/ingredients';
import {
  canMake,
  missingIngredients,
  recipeNumbers,
  useRecipes,
  type RecipeWithIngredients,
} from '../../src/data/recipes';
import { useTheme, useThemedStyles } from '../../src/providers/theme';
import { spacing, typography, type Theme } from '../../src/theme';

/** How much of the next card peeks in from the right edge. */
const CARD_PEEK = 40;
const CARD_GAP = spacing.md;
/** A bottle counts as "new on the shelf" for this long after it is added. */
const NEW_BOTTLE_DAYS = 7;
const ONE_AWAY_ROWS = 3;

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home is tonight's menu, not a dashboard: a greeting with two live counts,
 * one line to ask the barkeep, the makeable cocktails as a swipeable deck,
 * and a single line for whatever has run out. Everything else lives on the
 * tab it belongs to.
 */
export default function HomeScreen() {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colorForKind = useColorForKind();
  const router = useRouter();
  const { width } = useWindowDimensions();
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

  // Favourites lead the deck; the rest keep their newest-first order.
  const picks = useMemo(
    () =>
      [...makeable]
        .sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
        .slice(0, 8),
    [makeable],
  );

  // "One bottle away": recipes short of exactly one buyable ingredient, grouped
  // by that ingredient and ranked by how many drinks it would unlock.
  const oneAway = useMemo(() => {
    const groups = new Map<string, RecipeWithIngredients[]>();
    for (const recipe of recipes ?? []) {
      const missing = missingIngredients(recipe, available);
      const id = missing.length === 1 ? missing[0].ingredient_id : null;
      if (!id) continue;
      groups.set(id, [...(groups.get(id) ?? []), recipe]);
    }
    return [...groups.entries()]
      .map(([ingredientId, list]) => ({
        ingredientId,
        name: index?.byId.get(ingredientId)?.name ?? null,
        recipes: list,
      }))
      .filter((g): g is typeof g & { name: string } => Boolean(g.name))
      .sort((a, b) => b.recipes.length - a.recipes.length || a.name.localeCompare(b.name))
      .slice(0, ONE_AWAY_ROWS);
  }, [recipes, available, index]);

  // "New on the shelf": bottles added this week, with how much of the notebook
  // they open up. Staples are everyday things, so only real bottles count.
  const newBottles = useMemo(() => {
    const since = Date.now() - NEW_BOTTLE_DAYS * 24 * 60 * 60 * 1000;
    return (bottles ?? [])
      .filter(
        (b) =>
          b.kind === 'bottle' &&
          b.status === 'in_stock' &&
          b.ingredient_id &&
          new Date(b.created_at).getTime() >= since,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 2)
      .map((b) => ({
        bottle: b,
        uses: (recipes ?? []).filter((r) =>
          r.recipe_ingredients.some((line) => line.ingredient_id === b.ingredient_id),
        ).length,
      }));
  }, [bottles, recipes]);

  // Typing here lands on the Barkeep screen with the question already asked.
  // An empty send just opens the screen.
  const [ask, setAsk] = useState('');
  function sendAsk() {
    const q = ask.trim();
    setAsk('');
    if (q) router.push({ pathname: '/ask', params: { q, t: String(Date.now()) } });
    else router.push('/ask');
  }

  if (bottlesLoading || recipesLoading) return <Loading label="Setting up the bar…" />;

  const hasBottles = (bottles?.length ?? 0) > 0;
  const greeting = greetingForHour(new Date().getHours());
  const cardWidth = width - spacing.gutter * 2 - CARD_PEEK;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal>
          <View style={styles.masthead}>
            <View style={styles.mastheadText}>
              <Display>{greeting}</Display>
              {hasBottles ? (
                <View style={styles.counts}>
                  <CountLink
                    label={`${inStock.length} in stock`}
                    onPress={() => router.push('/bar')}
                  />
                  <Text style={styles.countDot}>·</Text>
                  <CountLink
                    label={`${makeable.length} within reach`}
                    onPress={() =>
                      router.push({ pathname: '/recipes', params: { filter: 'makeable' } })
                    }
                  />
                </View>
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

          <View style={styles.askLine}>
            <TextInput
              value={ask}
              onChangeText={setAsk}
              placeholder="What are you in the mood for?"
              placeholderTextColor={colors.cream}
              selectionColor={colors.accent}
              returnKeyType="send"
              enablesReturnKeyAutomatically
              blurOnSubmit
              onSubmitEditing={sendAsk}
              accessibilityLabel="Ask the barkeep for a cocktail"
              style={[styles.askInput, ask ? styles.askInputFilled : null]}
            />
            <PressableScale
              onPress={sendAsk}
              accessibilityRole="button"
              accessibilityLabel={ask.trim() ? 'Send to the barkeep' : 'Open the barkeep'}
              hitSlop={8}
            >
              <LinearGradient
                colors={gradients.brand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.askArrow}
              >
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.bg} />
              </LinearGradient>
            </PressableScale>
          </View>

          {hasBottles ? (
            <>
              <View style={styles.section}>
                <SectionHeader
                  title="Tonight"
                  actionLabel="All recipes"
                  onAction={() => router.push('/recipes')}
                />
                {picks.length > 0 ? (
                  <FlatList
                    horizontal
                    data={picks}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    style={styles.deckBleed}
                    contentContainerStyle={styles.deck}
                    snapToInterval={cardWidth + CARD_GAP}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    disableIntervalMomentum
                    renderItem={({ item }) => (
                      <PickCard
                        recipe={item}
                        number={numbers.get(item.id)}
                        width={cardWidth}
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
                    <Button label="Ask the barkeep" size="sm" onPress={() => router.push('/ask')} />
                  </View>
                )}
              </View>

              {emptyBottles.length > 0 || newBottles.length > 0 ? (
                <View style={styles.notes}>
                  {emptyBottles.length > 0 ? (
                    <NoteLine
                      label="Out"
                      text={emptyBottles.map((b) => b.name).join(', ')}
                      action="Restock"
                      accessibilityLabel={`${emptyBottles.length} out: ${emptyBottles
                        .map((b) => b.name)
                        .join(', ')}. Restock`}
                      onPress={() => router.push({ pathname: '/bar', params: { filter: 'out' } })}
                    />
                  ) : null}
                  {newBottles.map(({ bottle, uses }) => (
                    <NoteLine
                      key={bottle.id}
                      label="New"
                      text={
                        uses > 0
                          ? `${bottle.name} — ${uses} ${uses === 1 ? 'recipe uses' : 'recipes use'} it`
                          : `${bottle.name} — nothing in the notebook uses it yet`
                      }
                      action={uses > 0 ? 'See them' : 'Ask'}
                      accessibilityLabel={
                        uses > 0
                          ? `New: ${bottle.name}. ${uses} recipes use it. See them`
                          : `New: ${bottle.name}. Ask the barkeep for something with it`
                      }
                      onPress={() =>
                        uses > 0
                          ? router.push({
                              pathname: '/recipes',
                              params: {
                                mode: 'uses',
                                ingredient: bottle.ingredient_id as string,
                                t: String(Date.now()),
                              },
                            })
                          : router.push({
                              pathname: '/ask',
                              params: { q: `Something that uses my ${bottle.name}`, t: String(Date.now()) },
                            })
                      }
                    />
                  ))}
                </View>
              ) : null}

              {oneAway.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader title="One bottle away" />
                  <View>
                    {oneAway.map((group, i) => (
                      <OneAwayRow
                        key={group.ingredientId}
                        name={group.name}
                        recipes={group.recipes}
                        first={i === 0}
                        onPress={() =>
                          router.push({
                            pathname: '/recipes',
                            params: {
                              mode: 'almost',
                              ingredient: group.ingredientId,
                              t: String(Date.now()),
                            },
                          })
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
        </Reveal>
      </ScrollView>
    </Screen>
  );
}

/** A one-line shelf note: bold label, muted text, small action on the right. */
function NoteLine({
  label,
  text,
  action,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  text: string;
  action: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.noteLine}
    >
      <Text style={styles.noteText} numberOfLines={1}>
        <Text style={styles.noteLabel}>{label} · </Text>
        {text}
      </Text>
      <Text style={styles.noteAction}>{action}</Text>
      <MaterialCommunityIcons name="chevron-right" size={16} color={colors.text} />
    </PressableScale>
  );
}

function OneAwayRow({
  name,
  recipes,
  first,
  onPress,
}: {
  name: string;
  recipes: RecipeWithIngredients[];
  first: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const titles = recipes.map((r) => r.title);
  const shown = titles.slice(0, 2).join(', ');
  const rest = titles.length - 2;
  const unlocks = rest > 0 ? `${shown} +${rest}` : shown;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} unlocks ${titles.length} ${titles.length === 1 ? 'recipe' : 'recipes'}: ${titles.join(', ')}`}
      style={[styles.oneAwayRow, !first && styles.rowDivider]}
    >
      <Text style={styles.oneAwayName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.oneAwayUnlocks} numberOfLines={1}>
        {unlocks}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textFaint} />
    </PressableScale>
  );
}

function CountLink({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={styles.count}>{label}</Text>
    </Pressable>
  );
}

function PickCard({
  recipe,
  number,
  width,
  baseColor,
  ingredientName,
  onPress,
}: {
  recipe: RecipeWithIngredients;
  number: number | undefined;
  width: number;
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
  const specs = [recipe.method, recipe.glass].filter(Boolean).join(' · ');

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      style={[styles.pickCard, { width }]}
    >
      <View style={styles.pickHeader}>
        {number !== undefined ? <Flourish style={styles.pickNumber}>No. {number}</Flourish> : null}
        {recipe.is_favorite ? (
          <MaterialCommunityIcons name="star" size={14} color={colors.cream} />
        ) : null}
      </View>
      <Title numberOfLines={2} style={styles.pickTitle}>
        {recipe.title}
      </Title>
      {lineNames.length > 0 ? (
        <Muted numberOfLines={2} style={styles.pickIngredients}>
          {lineNames.join(' · ')}
        </Muted>
      ) : null}
      <View style={styles.pickFooter}>
        <View style={[styles.pickDot, { backgroundColor: baseColor }]} />
        <Muted style={styles.pickSpecs} numberOfLines={1}>
          {specs || 'Ready to pour'}
        </Muted>
      </View>
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
  counts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  count: {
    ...typography.body,
    color: colors.textMuted,
  },
  countDot: {
    ...typography.body,
    color: colors.textFaint,
  },
  settings: {
    paddingTop: spacing.sm,
  },

  askLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  // The empty field speaks in the flourish voice; once you type, the text
  // stands upright so it reads as yours rather than the app's.
  askInput: {
    flex: 1,
    ...typography.flourish,
    fontSize: 18,
    lineHeight: 24,
    paddingVertical: 0,
    color: colors.text,
  },
  askInputFilled: {
    fontFamily: 'Fraunces_400Regular',
  },
  askArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {
    marginTop: spacing.section,
    gap: spacing.lg,
  },

  deckBleed: {
    marginHorizontal: -spacing.gutter,
  },
  deck: {
    gap: CARD_GAP,
    paddingHorizontal: spacing.gutter,
  },
  pickCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 172,
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
  pickTitle: {
    marginTop: spacing.xs,
  },
  pickIngredients: {
    fontSize: 13,
    lineHeight: 18,
  },
  pickFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.sm,
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

  notes: {
    marginTop: spacing.section,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  noteLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  noteText: {
    flex: 1,
    ...typography.small,
    color: colors.textMuted,
  },
  noteLabel: {
    fontWeight: '600',
    color: colors.text,
  },
  noteAction: {
    ...typography.small,
    fontWeight: '600',
    color: colors.text,
  },

  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  oneAwayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  oneAwayName: {
    ...typography.small,
    fontWeight: '600',
    color: colors.text,
    flexShrink: 0,
    maxWidth: '45%',
  },
  oneAwayUnlocks: {
    flex: 1,
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'right',
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
