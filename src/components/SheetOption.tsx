import { StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { PressableScale } from './ui';
import { useTheme, useThemedStyles } from '../providers/theme';
import { spacing, typography, type Theme } from '../theme';

/** One tappable row in a BottomSheet: an icon, a label, an optional second line. */
export function SheetOption({
  icon,
  label,
  detail,
  onPress,
  destructive = false,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  detail?: string | null;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const color = destructive ? colors.danger : colors.text;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={styles.option}>
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <View style={styles.text}>
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    label: {
      ...typography.subheading,
    },
    detail: {
      ...typography.small,
      color: colors.textMuted,
    },
  });
