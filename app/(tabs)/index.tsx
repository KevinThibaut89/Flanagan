import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../../src/components/Button';
import { colorForKind } from '../../src/components/CategoryPill';
import { Body, Heading, Label, Loading, Muted, Screen, Title } from '../../src/components/ui';
import { useAvailableIngredientIds, useBottles } from '../../src/data/bottles';
import { useIngredientIndex } from '../../src/data/ingredients';
import { canMake, useRecipes, type RecipeWithIngredients } from '../../src/data/recipes';
import { colors, gradients, radius, shadows, spacing, typography } from '../../src/theme';
import type { Bottle } from '../../src/types/database';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Below this the bottle counts as running low — matches the Bar screen. */
const LOW_FILL_PCT = 25;

const MOODS: Array<{ label: string; icon: IconName; prompt: string }> = [
  { label: 'Bitter & stirred', icon: 'glass-cocktail', prompt: 'Something bitter and stirred' },
  { label: 'Fresh & citrusy', icon: 'fruit-citrus', prompt: 'Something fresh and citrusy' },
  { label: 'Short & strong', icon: 'fire', prompt: 'Something short, strong and spirit-forward' },
  { label: 'Surprise me', icon: 'dice-5-outline', prompt: 'Surprise me with something I would not think of' },
];

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: bottles, isLoading: bottlesLoading } = useBottles();
  const { data: recipes, isLoading: recipesLoading } = useRecipes();
  const available = useAvailableIngredientIds();
  const { index } = useIngredientIndex();

  const inStock = useMemo(
    () => (bottles ?? []).filter((b) => b.status === 'in_stock'),
    [bottles],
  );
  const lowBottles = useMemo(
    () =>
      inStock.filter((b) => b.kind === 'bottle' && b.fill_pct <= LOW_FILL_PCT),
    [inStock],
  );
  const makeable = useMemo(
    () => (recipes ?? []).filter((recipe) => canMake(recipe, available)),
    [recipes, available],
  );
  const favoriteCount = useMemo(
    () => (recipes ?? []).filter((recipe) => recipe.is_favorite).length,
    [recipes],
  );

  // Favourites lead the carousel; the rest keep their newest-first order.
  const picks = useMemo(() => {
    const sorted = [...makeable].sort(
      (a, b) => Number(b.is_favorite) - Number(a.is_favorite),
    );
    return sorted.slice(0, 8);
  }, [makeable]);

  if (bottlesLoading || recipesLoading) return <Loading label="Setting up the bar…" />;

  const hasBottles = (bottles?.length ?? 0) > 0;
  const greeting = greetingForHour(new Date().getHours());

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <View style={styles.greetingBlock}>
            <Title style={styles.greeting}>{greeting}</Title>
            <Muted>
              {hasBottles
                ? `${inStock.length} in stock · ${makeable.length} ${
                    makeable.length === 1 ? 'cocktail' : 'cocktails'
                  } within reach`
                : 'Let’s get your bar set up.'}
            </Muted>
          </View>
          <View style={styles.topActions}>
            <TopIconButton icon="tune-variant" label="Staples" onPress={() => router.push('/staples')} />
            <TopIconButton icon="cog-outline" label="Settings" onPress={() => router.push('/settings')} />
          </View>
        </View>

        <AskHero
          onAsk={() => router.push('/ask')}
          onMood={(prompt) => router.push({ pathname: '/ask', params: { q: prompt } })}
        />

        {hasBottles ? (
          <>
            <View style={styles.statGrid}>
              <StatTile
                icon="bottle-wine-outline"
                value={inStock.length}
                label="In stock"
                href="/bar"
              />
              <StatTile
                icon="check-circle-outline"
                value={makeable.length}
                label="Makeable now"
                tint={colors.success}
                href={{ pathname: '/recipes', params: { filter: 'makeable' } }}
              />
              <StatTile
                icon="trending-down"
                value={lowBottles.length}
                label="Running low"
                tint={lowBottles.length > 0 ? colors.warning : undefined}
                href={{ pathname: '/bar', params: { filter: 'low' } }}
              />
              <StatTile
                icon="star-outline"
                value={favoriteCount}
                label="Favourites"
                href={{ pathname: '/recipes', params: { filter: 'favorites' } }}
              />
            </View>

            <SectionHeader
              title="Tonight’s picks"
              actionLabel="All recipes"
              onAction={() => router.push('/recipes')}
            />
            {picks.length > 0 ? (
              <FlatList
                horizontal
                data={picks}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
                renderItem={({ item }) => (
                  <PickCard
                    recipe={item}
                    baseKindColor={colorForKind(
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
                <MaterialCommunityIcons name="glass-cocktail" size={22} color={colors.textFaint} />
                <Body style={styles.emptyPicksText}>
                  {recipes && recipes.length > 0
                    ? 'Nothing in your notebook is makeable right now — check your staples, or ask for something new.'
                    : 'No recipes yet. Ask Flanagan for a cocktail built from what you have.'}
                </Body>
                <Button label="Ask for a cocktail" size="sm" onPress={() => router.push('/ask')} />
              </View>
            )}

            {lowBottles.length > 0 ? (
              <>
                <SectionHeader
                  title="Running low"
                  actionLabel="Open bar"
                  onAction={() => router.push({ pathname: '/bar', params: { filter: 'low' } })}
                />
                <View style={styles.lowCard}>
                  {lowBottles.slice(0, 3).map((bottle, i) => (
                    <LowRow
                      key={bottle.id}
                      bottle={bottle}
                      isLast={i === Math.min(lowBottles.length, 3) - 1}
                      onPress={() =>
                        router.push({ pathname: '/bottle/[id]', params: { id: bottle.id } })
                      }
                    />
                  ))}
                  {lowBottles.length > 3 ? (
                    <Muted style={styles.lowMore}>
                      and {lowBottles.length - 3} more…
                    </Muted>
                  ) : null}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <WelcomeCard
            onScan={() => router.push('/scan')}
            onStaples={() => router.push('/staples')}
          />
        )}

        <SectionHeader title="Quick actions" />
        <View style={styles.actionGrid}>
          <QuickAction
            icon="barcode-scan"
            title="Scan a bottle"
            subtitle="Point at the barcode"
            onPress={() => router.push('/scan')}
          />
          <QuickAction
            icon="pencil-plus"
            title="Add by hand"
            subtitle="No barcode needed"
            onPress={() => router.push('/bottle/new')}
          />
          <QuickAction
            icon="notebook-plus-outline"
            title="Write a recipe"
            subtitle="Your own spec"
            onPress={() => router.push('/recipe/new')}
          />
          <QuickAction
            icon="basket-outline"
            title="Staples"
            subtitle="Limes, syrup, soda"
            onPress={() => router.push('/staples')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/** The AI entry point — the reason to open the app, so it gets the hero slot. */
function AskHero({
  onAsk,
  onMood,
}: {
  onAsk: () => void;
  onMood: (prompt: string) => void;
}) {
  return (
    <LinearGradient
      colors={gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroLabelRow}>
        <MaterialCommunityIcons name="creation" size={14} color={colors.accentSoft} />
        <Label style={styles.heroLabel}>Ask Flanagan</Label>
      </View>

      <Heading style={styles.heroTitle}>What do you feel like tonight?</Heading>

      <Pressable
        onPress={onAsk}
        accessibilityRole="button"
        accessibilityLabel="Describe a cocktail"
        style={({ pressed }) => [styles.heroInput, pressed && styles.pressed]}
      >
        <Muted style={styles.heroInputText} numberOfLines={1}>
          “A gin-based dry cocktail with floral notes…”
        </Muted>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroInputButton}
        >
          <MaterialCommunityIcons name="arrow-right" size={18} color={colors.bg} />
        </LinearGradient>
      </Pressable>

      <View style={styles.moodRow}>
        {MOODS.map((mood) => (
          <Pressable
            key={mood.label}
            onPress={() => onMood(mood.prompt)}
            style={({ pressed }) => [styles.moodChip, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name={mood.icon} size={14} color={colors.accentSoft} />
            <Body style={styles.moodLabel}>{mood.label}</Body>
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );
}

function TopIconButton({
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
      style={({ pressed }) => [styles.topIconButton, pressed && styles.pressed]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.textMuted} />
    </Pressable>
  );
}

function StatTile({
  icon,
  value,
  label,
  tint = colors.accentSoft,
  href,
}: {
  icon: IconName;
  value: number;
  label: string;
  tint?: string;
  href: Href;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.statTile, pressed && styles.pressed]}
    >
      <View style={styles.statIconWell}>
        <MaterialCommunityIcons name={icon} size={16} color={tint} />
      </View>
      <Body style={styles.statValue}>{value}</Body>
      <Muted style={styles.statLabel}>{label}</Muted>
    </Pressable>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Heading>{title}</Heading>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.sectionAction}>
          <Body style={styles.sectionActionText}>{actionLabel}</Body>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function PickCard({
  recipe,
  baseKindColor,
  ingredientName,
  onPress,
}: {
  recipe: RecipeWithIngredients;
  baseKindColor: string;
  ingredientName: (id: string | null, freeText: string | null) => string | null;
  onPress: () => void;
}) {
  const lineNames = recipe.recipe_ingredients
    .filter((line) => !line.is_garnish)
    .map((line) => ingredientName(line.ingredient_id, line.free_text))
    .filter((name): name is string => Boolean(name));

  const specs = [recipe.method, recipe.glass].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      style={({ pressed }) => [styles.pickCard, pressed && styles.pressed]}
    >
      <View style={styles.pickTopRow}>
        <View style={[styles.pickAccent, { backgroundColor: baseKindColor }]} />
        {recipe.is_favorite ? (
          <MaterialCommunityIcons name="star" size={16} color={colors.warning} />
        ) : null}
      </View>

      <Body style={styles.pickTitle} numberOfLines={2}>
        {recipe.title}
      </Body>
      {lineNames.length > 0 ? (
        <Muted numberOfLines={2} style={styles.pickIngredients}>
          {lineNames.join(' · ')}
        </Muted>
      ) : null}

      <View style={styles.pickFooter}>
        <View style={styles.makeableBadge}>
          <MaterialCommunityIcons name="check" size={12} color={colors.success} />
          <Body style={styles.makeableText}>Makeable</Body>
        </View>
        {specs ? (
          <Muted style={styles.pickSpecs} numberOfLines={1}>
            {specs}
          </Muted>
        ) : null}
      </View>
    </Pressable>
  );
}

function LowRow({
  bottle,
  isLast,
  onPress,
}: {
  bottle: Bottle;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.lowRow,
        !isLast && styles.lowRowBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.lowRowBody}>
        <Body style={styles.lowRowName} numberOfLines={1}>
          {bottle.name}
        </Body>
        <View style={styles.lowTrack}>
          <View style={[styles.lowLevel, { width: `${Math.max(bottle.fill_pct, 2)}%` }]} />
        </View>
      </View>
      <Muted style={styles.lowPct}>{bottle.fill_pct}%</Muted>
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
    >
      <View style={styles.actionIconWell}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.accentSoft} />
      </View>
      <Body style={styles.actionTitle}>{title}</Body>
      <Muted style={styles.actionSubtitle}>{subtitle}</Muted>
    </Pressable>
  );
}

/** First-run state: no bottles yet, so stats and picks would be all zeroes. */
function WelcomeCard({ onScan, onStaples }: { onScan: () => void; onStaples: () => void }) {
  return (
    <View style={styles.welcome}>
      <View style={styles.welcomeIconWell}>
        <MaterialCommunityIcons name="bottle-wine-outline" size={26} color={colors.accentSoft} />
      </View>
      <Heading style={styles.welcomeTitle}>Stock your bar</Heading>
      <Muted style={styles.welcomeText}>
        Scan a bottle’s barcode or add it by hand, then tick off your everyday staples — limes,
        syrup, soda — so Flanagan knows what you can actually pour.
      </Muted>
      <View style={styles.welcomeActions}>
        <Button label="Scan a bottle" onPress={onScan} />
        <Button label="Set staples" variant="secondary" onPress={onStaples} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl * 2,
    gap: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  greetingBlock: {
    flex: 1,
    gap: 2,
  },
  greeting: {
    ...typography.display,
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  topIconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },

  hero: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentDim,
    padding: spacing.xl,
    gap: spacing.lg,
    ...shadows.card,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroLabel: {
    color: colors.accentSoft,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  heroInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(20, 16, 14, 0.65)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    height: 52,
  },
  heroInputText: {
    flex: 1,
    fontSize: 14,
  },
  heroInputButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGlow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentDim,
  },
  moodLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentSoft,
  },

  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statIconWell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },

  carousel: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  pickCard: {
    width: 236,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  pickTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickAccent: {
    width: 28,
    height: 4,
    borderRadius: radius.pill,
  },
  pickTitle: {
    ...typography.subheading,
    fontSize: 17,
  },
  pickIngredients: {
    fontSize: 12,
    lineHeight: 17,
  },
  pickFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  makeableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  makeableText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  pickSpecs: {
    fontSize: 11,
    flexShrink: 1,
  },

  emptyPicks: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
  },
  emptyPicksText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
  },

  lowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.lg,
  },
  lowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  lowRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  lowRowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  lowRowName: {
    fontWeight: '600',
    fontSize: 14,
  },
  lowTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  lowLevel: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.warning,
  },
  lowPct: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  lowMore: {
    fontSize: 12,
    paddingVertical: spacing.md,
  },

  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  action: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: 2,
  },
  actionIconWell: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGlow,
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  actionSubtitle: {
    fontSize: 12,
  },

  welcome: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    ...shadows.card,
  },
  welcomeIconWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentGlow,
    marginBottom: spacing.xs,
  },
  welcomeTitle: {
    textAlign: 'center',
  },
  welcomeText: {
    textAlign: 'center',
    maxWidth: 300,
  },
  welcomeActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
