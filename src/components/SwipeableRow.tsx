import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme, useThemedStyles } from '../providers/theme';
import { spacing, type Theme } from '../theme';

export type SwipeSide = 'left' | 'right';

export type SwipeAction = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** Background colour of the revealed pane. */
  color: string;
  /**
   * When true the row slides fully off-screen before `onPress` fires — for
   * actions that remove the row from the list. Otherwise the row stays peeked
   * open (e.g. while a confirmation sheet is showing) until the parent closes it.
   */
  dismisses?: boolean;
  onPress: () => void;
};

/** How far the row peeks open to reveal an action button. */
const ACTION_WIDTH = 96;
/** Dragging past this fraction of the row width fires the action on release. */
const COMMIT_FRACTION = 0.42;
/** Finger travel before we take the gesture away from the vertical list. */
const DRAG_START = 10;

/**
 * A row that reveals an action when dragged left (`right` action) or right
 * (`left` action). A short drag snaps open so the button can be tapped; a long
 * drag commits the action on release, the way Mail deletes.
 *
 * Built on the core `Animated`/`PanResponder` APIs rather than gesture-handler
 * so it ships in an OTA update without a native rebuild.
 */
export function SwipeableRow({
  children,
  left,
  right,
  open,
  onOpen,
  onClose,
  onDragStateChange,
  borderRadius = 0,
}: {
  children: ReactNode;
  /** Match the child's corner radius when the row is a card rather than a full-bleed line. */
  borderRadius?: number;
  /** Revealed by dragging the row to the right. */
  left?: SwipeAction;
  /** Revealed by dragging the row to the left. */
  right?: SwipeAction;
  /**
   * Controlled open state so a list can keep at most one row open. `null`
   * closes the row; a side means that pane is showing (or has been committed).
   */
  open: SwipeSide | null;
  onOpen: (side: SwipeSide) => void;
  onClose: () => void;
  /** Fires as a horizontal drag begins/ends — lists use it to pause scrolling. */
  onDragStateChange?: (dragging: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const translateX = useRef(new Animated.Value(0)).current;
  const dragOrigin = useRef(0);
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const [side, setSide] = useState<SwipeSide | null>(null);

  // The PanResponder is created once, so it reads live props through a ref.
  const latest = useRef({ left, right, open, onOpen, onClose, onDragStateChange });
  latest.current = { left, right, open, onOpen, onClose, onDragStateChange };

  const settle = (toValue: number, onDone?: () => void) =>
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      damping: 24,
      stiffness: 260,
      mass: 0.8,
      overshootClamping: toValue === 0,
    }).start(({ finished }) => finished && onDone?.());

  const close = () => {
    latest.current.onClose();
    settle(0, () => setSide(null));
  };

  const commit = (action: SwipeAction, commitSide: SwipeSide) => {
    const direction = commitSide === 'left' ? 1 : -1;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSide(commitSide);
    latest.current.onOpen(commitSide);

    if (action.dismisses) {
      Animated.timing(translateX, {
        toValue: direction * widthRef.current,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && action.onPress());
    } else {
      settle(direction * ACTION_WIDTH);
      action.onPress();
    }
  };

  // Slide back when the parent closes us (another row opened, a sheet was
  // cancelled, a mutation failed…).
  useEffect(() => {
    if (open === null && side !== null) settle(0, () => setSide(null));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, g) => {
        const { left: l, right: r, open: o } = latest.current;
        if (Math.abs(g.dx) < DRAG_START || Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return false;
        // Only claim the gesture when there is somewhere to go in that direction.
        if (g.dx > 0 && !l && o !== 'right') return false;
        if (g.dx < 0 && !r && o !== 'left') return false;
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const { open: o, onDragStateChange: dragCb } = latest.current;
        dragOrigin.current = o === 'left' ? ACTION_WIDTH : o === 'right' ? -ACTION_WIDTH : 0;
        translateX.stopAnimation();
        dragCb?.(true);
      },
      onPanResponderMove: (_evt, g) => {
        const { left: l, right: r } = latest.current;
        let x = dragOrigin.current + g.dx;
        // Resist dragging toward a side with no action.
        if (x > 0 && !l) x *= 0.15;
        if (x < 0 && !r) x *= 0.15;
        // Ease off past the commit point so a full swipe doesn't fly away.
        const limit = widthRef.current * COMMIT_FRACTION;
        if (Math.abs(x) > limit) x = Math.sign(x) * (limit + (Math.abs(x) - limit) * 0.4);
        const nextSide: SwipeSide | null = x > 0 ? 'left' : x < 0 ? 'right' : null;
        setSide((prev) => (prev === nextSide ? prev : nextSide));
        translateX.setValue(x);
      },
      onPanResponderRelease: (_evt, g) => {
        const { left: l, right: r, onOpen: openCb, onDragStateChange: dragCb } = latest.current;
        dragCb?.(false);
        const x = dragOrigin.current + g.dx;
        const commitAt = widthRef.current * COMMIT_FRACTION;
        const flung = Math.abs(g.vx) > 1.2;

        if (x > 0 && l) {
          if (x >= commitAt || (flung && g.vx > 0 && x > ACTION_WIDTH * 0.5)) {
            commit(l, 'left');
            return;
          }
          if (x >= ACTION_WIDTH * 0.5 && !(flung && g.vx < 0)) {
            openCb('left');
            settle(ACTION_WIDTH);
            return;
          }
        } else if (x < 0 && r) {
          if (-x >= commitAt || (flung && g.vx < 0 && -x > ACTION_WIDTH * 0.5)) {
            commit(r, 'right');
            return;
          }
          if (-x >= ACTION_WIDTH * 0.5 && !(flung && g.vx > 0)) {
            openCb('right');
            settle(-ACTION_WIDTH);
            return;
          }
        }
        close();
      },
      onPanResponderTerminate: () => {
        latest.current.onDragStateChange?.(false);
        close();
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  // The icon grows as the row opens and nudges past 1 once a release would commit.
  const commitAt = Math.max(width * COMMIT_FRACTION, ACTION_WIDTH + 1);
  const leftScale = translateX.interpolate({
    inputRange: [0, ACTION_WIDTH * 0.6, ACTION_WIDTH, commitAt],
    outputRange: [0.6, 0.9, 1, 1.15],
    extrapolate: 'clamp',
  });
  const rightScale = translateX.interpolate({
    inputRange: [-commitAt, -ACTION_WIDTH, -ACTION_WIDTH * 0.6, 0],
    outputRange: [1.15, 1, 0.9, 0.6],
    extrapolate: 'clamp',
  });

  const active = side === 'left' ? left : side === 'right' ? right : undefined;

  return (
    <View style={[styles.wrap, { borderRadius }]} onLayout={onLayout}>
      {active && side ? (
        <View
          pointerEvents={open ? 'auto' : 'none'}
          style={[
            styles.pane,
            { backgroundColor: active.color },
            side === 'left' ? styles.paneLeft : styles.paneRight,
          ]}
        >
          <Pressable
            onPress={() => commit(active, side)}
            accessibilityRole="button"
            accessibilityLabel={active.label}
            style={styles.action}
          >
            <Animated.View
              style={[
                styles.actionInner,
                { transform: [{ scale: side === 'left' ? leftScale : rightScale }] },
              ]}
            >
              <MaterialCommunityIcons name={active.icon} size={20} color={colors.text} />
              <Text style={styles.actionLabel}>{active.label}</Text>
            </Animated.View>
          </Pressable>
        </View>
      ) : null}

      <Animated.View
        {...responder.panHandlers}
        style={[styles.content, { transform: [{ translateX }] }]}
      >
        <View pointerEvents={open ? 'none' : 'auto'}>{children}</View>
        {open ? (
          // Tapping an open row closes it instead of navigating.
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Hide actions"
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  pane: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  paneLeft: {
    justifyContent: 'flex-start',
  },
  paneRight: {
    justifyContent: 'flex-end',
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionInner: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: colors.text,
  },
  content: {
    backgroundColor: colors.bg,
  },
  });
