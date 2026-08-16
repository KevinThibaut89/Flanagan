import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '../theme';

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
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.title, style]} {...props}>
      {children}
    </Text>
  );
}

export function Heading({ children, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.heading, style]} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.body, style]} {...props}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.muted, style]} {...props}>
      {children}
    </Text>
  );
}

/** Small uppercase label used for section headers and metadata. */
export function Label({ children, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.label, style]} {...props}>
      {String(children).toUpperCase()}
    </Text>
  );
}

export function Pill({
  children,
  color = colors.accent,
  filled = false,
}: {
  children: ReactNode;
  color?: string;
  filled?: boolean;
}) {
  return (
    <View
      style={[
        styles.pill,
        { borderColor: color },
        filled && { backgroundColor: color },
      ]}
    >
      <Text style={[styles.pillText, { color: filled ? colors.bg : color }]}>{children}</Text>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Muted style={{ marginTop: spacing.md }}>{label}</Muted> : null}
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
  return (
    <View style={styles.centered}>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      {message ? (
        <Muted style={{ textAlign: 'center', marginTop: spacing.sm, maxWidth: 300 }}>
          {message}
        </Muted>
      ) : null}
      {action ? <View style={{ marginTop: spacing.xl }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <View style={styles.centered}>
      <Heading style={{ textAlign: 'center', color: colors.danger }}>Couldn’t load that</Heading>
      <Muted style={{ textAlign: 'center', marginTop: spacing.sm }}>{message}</Muted>
      {action ? <View style={{ marginTop: spacing.xl }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
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
    lineHeight: 22,
  },
  muted: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 20,
  },
  label: {
    ...typography.tiny,
    color: colors.textFaint,
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
});
