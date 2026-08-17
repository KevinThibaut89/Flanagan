import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptics. Failures (simulators, devices without an engine)
 * are irrelevant, so every helper swallows them.
 */

/** A light tap for buttons and toggles. */
export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** The subtle tick used for changing a selection. */
export function select() {
  Haptics.selectionAsync().catch(() => {});
}

/** Something completed. */
export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** About to do something destructive. */
export function warn() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
