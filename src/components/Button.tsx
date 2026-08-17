import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { tap } from '../lib/haptics';
import { colors, radius, spacing } from '../theme';

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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isInert, busy: loading }}
      onPress={() => {
        if (variant === 'primary' || variant === 'danger') tap();
        onPress();
      }}
      disabled={isInert}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sizeSm,
        variants[variant].container,
        pressed && !isInert && styles.pressed,
        isInert && styles.inert,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variants[variant].text.color} size="small" />
      ) : (
        <Text style={[styles.label, size === 'sm' && styles.labelSm, variants[variant].text]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// iOS button styles: filled, gray, and plain — no borders anywhere.
const variants: Record<Variant, { container: ViewStyle; text: { color: string } }> = {
  primary: {
    container: { backgroundColor: colors.accent },
    text: { color: '#FFFFFF' },
  },
  secondary: {
    container: { backgroundColor: colors.fill },
    text: { color: colors.accent },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.accent },
  },
  danger: {
    container: { backgroundColor: colors.fill },
    text: { color: colors.danger },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sizeSm: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontSize: 17,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 15,
  },
  pressed: {
    opacity: 0.7,
  },
  inert: {
    opacity: 0.45,
  },
});
