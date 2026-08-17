import { StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

import { PressableScale } from './ui';
import { colors, radius, spacing } from '../theme';

/**
 * The one chip in the app: text only, hairline border, copper text when
 * active. Replaces the assorted local chip implementations that used to live
 * in the forms and filter rows.
 */
export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
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
});
