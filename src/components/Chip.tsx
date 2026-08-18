import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

import { PressableScale } from './ui';
import { useTheme, useThemedStyles } from '../providers/theme';
import { radius, spacing, type Theme } from '../theme';

/**
 * The one chip in the app: text only, hairline border, copper text when
 * active. Replaces the assorted local chip implementations that used to live
 * in the forms and filter rows.
 */
export function Chip({
  label,
  icon,
  count,
  active = false,
  onPress,
}: {
  /** Visible text — or, when `icon` is set, the accessibility label only. */
  label: string;
  /** Renders an icon in place of the text; the label still names it for VoiceOver. */
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Optional tally shown as a small badge after the label. Hidden when 0 or undefined. */
  count?: number;
  active?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const showCount = typeof count === 'number' && count > 0;

  return (
    <PressableScale
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={showCount ? `${label}, ${count}` : label}
      style={[styles.chip, icon && styles.chipIcon, active && styles.chipActive]}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={16}
          color={active ? colors.accentSoft : colors.textMuted}
        />
      ) : (
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      )}
      {showCount ? (
        <View style={[styles.badge, active && styles.badgeActive]}>
          <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chipIcon: {
    // Icon-only chips are squarer: the same height as a text chip, less width.
    paddingHorizontal: spacing.md,
  },
  chipActive: {
    borderColor: colors.accent,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.accentSoft,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  badgeTextActive: {
    color: colors.bg,
  },
  });
