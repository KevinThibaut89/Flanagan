import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

import { useTheme, useThemedStyles } from '../providers/theme';
import { spacing, type Theme } from '../theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Five slots, one centre. The four tab routes render as quiet ink-on-parchment
 * items; the Barkeep route sits in the middle as a raised copper disc; and a
 * fifth, synthetic Scan slot pushes the full-screen scanner without ever
 * becoming the selected tab. Copper is reserved for the centre — the active
 * tab shows in ink, so the bar carries exactly one accent.
 */
const TAB_META: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home-variant-outline' },
  bar: { label: 'Bar', icon: 'bottle-wine-outline' },
  ask: { label: 'Barkeep', icon: 'glass-cocktail' },
  recipes: { label: 'Recipes', icon: 'notebook-outline' },
};

const CENTRE_ROUTE = 'ask';
const ICON_SIZE = 25;
const CENTRE_SIZE = 54;
/** How far the disc's ring rises above the bar's top edge. */
const CENTRE_RAISE = 18;
const RING = 4;
/** Icons of the four flat tabs are pushed down so every label sits on one line. */
const FLAT_ICON_TOP = 10;

export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors, gradients } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {/* The bar's layout box includes the disc's overhang, so scenes end above
          the disc and nothing can hide under it. The hairline is drawn where
          the visual bar starts, not at the box's top. */}
      <View pointerEvents="none" style={styles.hairline} />
      {state.routes.map((route, i) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === i;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        if (route.name === CENTRE_ROUTE) {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={meta.label}
              accessibilityState={{ selected: focused }}
              style={styles.item}
              hitSlop={4}
            >
              <View style={styles.centreRing}>
                <LinearGradient
                  colors={gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.centreDisc}
                >
                  <MaterialCommunityIcons
                    name={meta.icon}
                    size={ICON_SIZE + 1}
                    color={colors.bg}
                  />
                </LinearGradient>
              </View>
              <Text style={[styles.label, styles.centreLabel]}>{meta.label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={meta.label}
            accessibilityState={{ selected: focused }}
            style={styles.item}
            hitSlop={4}
          >
            <MaterialCommunityIcons
              name={meta.icon}
              size={ICON_SIZE}
              color={focused ? colors.text : colors.textFaint}
              style={styles.flatIcon}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{meta.label}</Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          router.push('/scan');
        }}
        accessibilityRole="button"
        accessibilityLabel="Scan a bottle"
        style={styles.item}
        hitSlop={4}
      >
        <MaterialCommunityIcons
          name="barcode-scan"
          size={ICON_SIZE}
          color={colors.textFaint}
          style={styles.flatIcon}
        />
        <Text style={styles.label}>Scan</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.bg,
      paddingTop: CENTRE_RAISE + spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    hairline: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: CENTRE_RAISE,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderSubtle,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 4,
      minHeight: 44,
    },
    flatIcon: {
      marginTop: FLAT_ICON_TOP,
    },
    label: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.4,
      color: colors.textFaint,
    },
    labelActive: {
      color: colors.text,
    },
    // The ring is a border in the bar colour so the disc reads as sitting in
    // a notch cut from the bar's top edge, rather than pasted over it.
    centreRing: {
      marginTop: -(CENTRE_RAISE + spacing.sm),
      width: CENTRE_SIZE + RING * 2,
      height: CENTRE_SIZE + RING * 2,
      borderRadius: (CENTRE_SIZE + RING * 2) / 2,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    centreDisc: {
      width: CENTRE_SIZE,
      height: CENTRE_SIZE,
      borderRadius: CENTRE_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centreLabel: {
      color: colors.text,
    },
  });
