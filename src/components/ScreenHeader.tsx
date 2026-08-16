import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Heading, Muted } from './ui';
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
      <Pressable
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.back}
      >
        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.textMuted} />
      </Pressable>

      <View style={styles.titles}>
        <Heading numberOfLines={1}>{title}</Heading>
        {subtitle ? <Muted numberOfLines={1}>{subtitle}</Muted> : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  back: {
    width: 32,
    alignItems: 'flex-start',
  },
  titles: {
    flex: 1,
    gap: 1,
  },
  action: {
    minWidth: 32,
    alignItems: 'flex-end',
  },
  spacer: {
    width: 32,
  },
});
