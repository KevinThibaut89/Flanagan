import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { PressableScale } from './ui';
import { colors, gradients, radius, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isInert = disabled || loading;

  function handlePress() {
    if (variant === 'primary') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }

  const content = loading ? (
    <ActivityIndicator color={variants[variant].text.color} size="small" />
  ) : (
    <Text style={[styles.label, size === 'sm' && styles.labelSm, variants[variant].text]}>
      {label}
    </Text>
  );

  const shape = [styles.base, size === 'sm' && styles.sizeSm, isInert && styles.inert];

  // The primary button carries the app's one gradient; everything else is flat.
  if (variant === 'primary') {
    return (
      <PressableScale
        scaleTo={0.96}
        onPress={handlePress}
        disabled={isInert}
        accessibilityRole="button"
        accessibilityState={{ disabled: isInert, busy: loading }}
        style={style}
      >
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={shape}
        >
          {content}
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      scaleTo={0.96}
      onPress={handlePress}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      style={[...shape, variants[variant].container, style]}
    >
      {content}
    </PressableScale>
  );
}

const variants: Record<Variant, { container: ViewStyle; text: { color: string } }> = {
  primary: {
    container: {},
    text: { color: colors.bg },
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: { color: colors.text },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.cream },
  },
  danger: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.danger,
    },
    text: { color: colors.danger },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sizeSm: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 13,
  },
  inert: {
    opacity: 0.45,
  },
});
