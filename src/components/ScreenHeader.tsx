import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Heading, Muted, PressableScale } from './ui';
import { colors, spacing } from '../theme';

export function ScreenHeader({
  title,
  subtitle,
  action,
  onBack,
}: {
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
  onBack?: () => void;
}) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <PressableScale
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.back}
      >
        <MaterialCommunityIcons name="chevron-left" size={26} color={colors.textMuted} />
      </PressableScale>

      <View style={styles.titles}>
        <Heading numberOfLines={1}>{title}</Heading>
        {subtitle ? <Muted numberOfLines={1}>{subtitle}</Muted> : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.gutter,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  back: {
    width: 30,
    alignItems: 'flex-start',
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  action: {
    alignItems: 'flex-end',
  },
});
