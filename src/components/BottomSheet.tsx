import { useEffect, useRef, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Heading } from './ui';
import { useThemedStyles } from '../providers/theme';
import { radius, spacing, type Theme } from '../theme';

/**
 * Fires `onDidClose` once a modal is really gone from the screen — not when it
 * is asked to close.
 *
 * Anything that presents its own native UI (the image picker, the camera,
 * another modal) fails silently on iOS if it is asked to present while a modal
 * is still animating out: UIKit refuses to present over a dismissing view
 * controller. Callers that want to open something *after* a sheet must wait for
 * this hook, not for the state change that closed the sheet.
 *
 * On iOS the signal is `Modal`'s `onDismiss`, which runs when the dismissal
 * finishes. That prop is iOS-only, so on Android we fire once `visible` flips
 * off — Android dialogs go away synchronously and never block a new activity.
 */
export function useModalDidClose(visible: boolean, onDidClose?: () => void) {
  const callback = useRef(onDidClose);
  callback.current = onDidClose;
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (wasVisible.current && !visible && Platform.OS !== 'ios') {
      callback.current?.();
    }
    wasVisible.current = visible;
  }, [visible]);

  return Platform.OS === 'ios' ? () => callback.current?.() : undefined;
}

/**
 * A themed sheet that rises from the bottom edge — the same scrim and raised
 * surface as ConfirmSheet, but sized to hold a scrolling body and an optional
 * footer that stays pinned while the body scrolls.
 */
export function BottomSheet({
  visible,
  onClose,
  onDidClose,
  title,
  headerAction,
  footer,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** Runs once the sheet has fully left the screen — see `useModalDidClose`. */
  onDidClose?: () => void;
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
  const handleDismiss = useModalDidClose(visible, onDidClose);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={handleDismiss}
    >
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
