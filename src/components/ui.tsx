import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme, useThemedStyles } from '../providers/theme';
import { radius, spacing, typography, type Theme } from '../theme';

/** Text primitives forward the rest of TextProps so callers can set
 * `numberOfLines`, accessibility props, and so on. */
type TypographyProps = TextProps & { children: ReactNode };

export function Screen({
  children,
  edges = ['top'],
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Display({ children, style, ...props }: TypographyProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.display, style]} {...props}>
      {children}
    </Text>
  );
}

export function Title({ children, style, ...props }: TypographyProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.title, style]} {...props}>
      {children}
    </Text>
  );
}

export function Heading({ children, style, ...props }: TypographyProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.heading, style]} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, style, ...props }: TypographyProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.body, style]} {...props}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, ...props }: TypographyProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.muted, style]} {...props}>
      {children}
    </Text>
  );
}

/** Letterspaced uppercase label used for section headers and field labels. */
export function Label({ children, style, ...props }: TypographyProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.label, style]} {...props}>
      {children}
    </Text>
  );
}

/** Fraunces italic — invitations, "No. 12", empty-state lines. */
export function Flourish({ children, style, ...props }: TypographyProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Text style={[styles.flourish, style]} {...props}>
      {children}
    </Text>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The one press affordance in the app: a quiet scale-down, no opacity flash.
 * `style` lands on the pressable itself, so layout props such as `flex` and
 * `alignSelf` take part in the parent's layout (a wrapped inner view would
 * swallow them and leave the pressable sized to its content).
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  onPress,
  ...props
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const settle = (toValue: number) =>
    Animated.timing(scale, {
      toValue,
      duration: toValue === 1 ? 160 : 110,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  return (
    <AnimatedPressable
      onPressIn={() => settle(scaleTo)}
      onPressOut={() => settle(1)}
      onPress={onPress}
      style={[style, { transform: [{ scale }] }]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Fades content in with a small rise, once per mount. */
export function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Overline label with a hairline rule filling the remaining width. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionHeader}>
      <Label>{title}</Label>
      <View style={styles.sectionRule} />
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Centered ornament: hairline — copper diamond — hairline. Used sparingly. */
export function OrnamentRule({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.ornament, style]}>
      <View style={styles.ornamentLine} />
      <View style={styles.ornamentDiamond} />
      <View style={styles.ornamentLine} />
    </View>
  );
}

/** The coaster monogram: a thin copper circle around an italic F. */
export function Monogram({ size = 56 }: { size?: number }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View
      style={[
        styles.monogram,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.monogramText, { fontSize: size * 0.46 }]}>F</Text>
    </View>
  );
}

export function Pill({
  children,
  color,
  filled = false,
}: {
  children: ReactNode;
  color?: string;
  filled?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tint = color ?? colors.accent;
  return (
    <View
      style={[
        styles.pill,
        { borderColor: tint },
        filled && { backgroundColor: tint },
      ]}
    >
      <Text style={[styles.pillText, { color: filled ? colors.bg : tint }]}>{children}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.divider, style]} />;
}

export function Loading({ label }: { label?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <Monogram />
      {label ? <Flourish style={styles.stateMessage}>{label}</Flourish> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.centered}>
      <Monogram />
      <Heading style={styles.stateTitle}>{title}</Heading>
      {message ? <Flourish style={styles.stateMessage}>{message}</Flourish> : null}
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <View style={styles.centered}>
      <Monogram />
      <Heading style={styles.stateTitle}>Couldn’t load that</Heading>
      <Flourish style={styles.stateMessage}>{message}</Flourish>
      {action ? <View style={styles.stateAction}>{action}</View> : null}
    </View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  display: {
    ...typography.display,
    color: colors.text,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  heading: {
    ...typography.heading,
    color: colors.text,
  },
  body: {
    ...typography.body,
    color: colors.text,
  },
  muted: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 19,
  },
  label: {
    ...typography.overline,
    color: colors.textFaint,
  },
  flourish: {
    ...typography.flourish,
    color: colors.cream,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  sectionAction: {
    ...typography.small,
    fontWeight: '600',
    color: colors.cream,
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ornamentLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  ornamentDiamond: {
    width: 5,
    height: 5,
    backgroundColor: colors.accent,
    transform: [{ rotate: '45deg' }],
  },
  monogram: {
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: 'Fraunces_400Regular_Italic',
    color: colors.cream,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateTitle: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  stateMessage: {
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 300,
    color: colors.textMuted,
  },
  stateAction: {
    marginTop: spacing.xl,
  },
  });
