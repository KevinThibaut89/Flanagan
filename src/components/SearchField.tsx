import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme, useThemedStyles } from '../providers/theme';
import { radius, spacing, type Theme } from '../theme';

interface SearchFieldProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'style'> {
  value: string;
  onChangeText: (text: string) => void;
  /** Applied to the outer box, e.g. `flex: 1` when sharing a row. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * The one search box: magnifier, quiet surface, hairline border that turns
 * copper on focus, and a clear button once there is something to clear. Used
 * by the list screens and the ingredient picker so they cannot drift apart.
 */
export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  { value, onChangeText, containerStyle, onFocus, onBlur, ...props },
  ref,
) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, focused && styles.wrapFocused, containerStyle]}>
      <MaterialCommunityIcons name="magnify" size={18} color={colors.textFaint} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        autoCorrect={false}
        clearButtonMode="never"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={styles.input}
        {...props}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear search">
          <MaterialCommunityIcons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
});

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      paddingHorizontal: spacing.lg,
      height: 46,
    },
    wrapFocused: {
      borderColor: colors.accent,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
    },
  });
