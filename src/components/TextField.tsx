import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme, useThemedStyles } from '../providers/theme';
import { radius, spacing, typography, type Theme } from '../theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
}

/** The single input idiom: quiet surface, hairline border, copper on focus. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, style, onFocus, onBlur, ...props },
  ref,
) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    ...typography.overline,
    color: colors.textFaint,
    marginBottom: 2,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  inputError: {
    borderColor: colors.danger,
  },
  hint: {
    ...typography.small,
    color: colors.textFaint,
  },
  error: {
    ...typography.small,
    color: colors.danger,
  },
  });
