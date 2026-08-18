import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Heading } from './ui';
import { useThemedStyles } from '../providers/theme';
import { radius, spacing, type Theme } from '../theme';

/**
 * A themed sheet that rises from the bottom edge — the same scrim and raised
 * surface as ConfirmSheet, but sized to hold a scrolling body and an optional
 * footer that stays pinned while the body scrolls.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  headerAction,
  footer,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Small text action on the right of the title, e.g. "Clear all". */
  headerAction?: { label: string; onPress: () => void } | null;
  /** Pinned below the scrolling body. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close">
        {/* Stop presses inside the sheet from falling through to the scrim. */}
        <Pressable
          style={[
            styles.sheet,
            { maxHeight: height * 0.8, paddingBottom: insets.bottom + spacing.lg },
          ]}
          onPress={() => {}}
        >
          <View style={styles.grabber} />
          {title || headerAction ? (
            <View style={styles.header}>
              {title ? <Heading>{title}</Heading> : <View />}
              {headerAction ? (
                <Pressable onPress={headerAction.onPress} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.headerAction}>{headerAction.label}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = ({ colors, shadows }: Theme) =>
  StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surfaceRaised,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      paddingTop: spacing.sm,
      ...shadows.card,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.borderSubtle,
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.gutter,
      paddingBottom: spacing.md,
    },
    headerAction: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.cream,
    },
    body: {
      paddingHorizontal: spacing.gutter,
      paddingBottom: spacing.lg,
      gap: spacing.xl,
    },
    footer: {
      paddingHorizontal: spacing.gutter,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderSubtle,
    },
  });
