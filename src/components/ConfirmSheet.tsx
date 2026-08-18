import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Flourish, Heading } from './ui';
import { useThemedStyles } from '../providers/theme';
import { radius, spacing, type Theme } from '../theme';

/**
 * A themed replacement for `Alert.alert` on destructive flows — the native
 * alert is the one place the dark room used to be interrupted by OS chrome.
 */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={busy ? undefined : onCancel}>
        {/* Stop presses inside the sheet from falling through to the scrim. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Heading style={styles.title}>{title}</Heading>
          <Flourish style={styles.message}>{message}</Flourish>
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={busy} style={styles.action} />
            <Button label={confirmLabel} variant="danger" onPress={onConfirm} loading={busy} style={styles.action} />
          </View>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.gutter,
  },
  sheet: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  action: {
    flex: 1,
  },
  });
