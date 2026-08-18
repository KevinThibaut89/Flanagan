import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

import { Button } from '../src/components/Button';
import {
  Body,
  Card,
  Divider,
  Label,
  Muted,
  PressableScale,
  Screen,
  Title,
} from '../src/components/ui';
import { useAuth } from '../src/providers/auth';
import { usePreferences } from '../src/providers/preferences';
import {
  useTheme,
  useThemePreference,
  useThemedStyles,
  type ThemePreference,
} from '../src/providers/theme';
import { spacing, type Theme } from '../src/theme';
import type { UnitPreference } from '../src/types/database';

interface Option<T extends string> {
  value: T;
  label: string;
  example: string;
}

const UNIT_OPTIONS: Array<Option<UnitPreference>> = [
  { value: 'metric', label: 'Millilitres', example: '45 ml gin' },
  { value: 'imperial', label: 'Ounces', example: '1½ oz gin' },
];

const THEME_OPTIONS: Array<Option<ThemePreference>> = [
  { value: 'dark', label: 'Dark', example: 'Walnut and cream — for the dim room' },
  { value: 'light', label: 'Light', example: 'Parchment and ink — for daylight' },
  { value: 'system', label: 'Match device', example: 'Follows your phone’s appearance' },
];

/** A radio list in a card: label + example on the left, copper check on the right. */
function OptionList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<Option<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Card style={styles.optionCard}>
      {options.map((option, i) => {
        const selected = value === option.value;
        return (
          <View key={option.value}>
            {i > 0 ? <Divider style={styles.optionDivider} /> : null}
            <PressableScale
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(option.value);
              }}
              style={styles.option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.optionText}>
                <Body style={styles.optionLabel}>{option.label}</Body>
                <Muted>{option.example}</Muted>
              </View>
              {selected ? (
                <MaterialCommunityIcons name="check" size={20} color={colors.accent} />
              ) : null}
            </PressableScale>
          </View>
        );
      })}
    </Card>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { units, setUnits } = usePreferences();
  const { preference, setPreference } = useThemePreference();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Title>Settings</Title>
        <PressableScale onPress={() => router.back()} hitSlop={8} accessibilityLabel="Close">
          <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Label>Measurements</Label>
          <OptionList options={UNIT_OPTIONS} value={units} onChange={setUnits} />
          <Muted style={styles.note}>
            Amounts are stored the same either way — this only changes how they’re shown, so you
            can switch back at any time without touching your recipes.
          </Muted>
        </View>

        <View style={styles.section}>
          <Label>Appearance</Label>
          <OptionList options={THEME_OPTIONS} value={preference} onChange={setPreference} />
        </View>

        <View style={styles.section}>
          <Label>Account</Label>
          <Card>
            <Muted>Signed in as</Muted>
            <Body style={styles.email}>{user?.email ?? 'Unknown'}</Body>
          </Card>
          <Button label="Sign out" variant="danger" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.gutter,
      paddingVertical: spacing.md,
    },
    content: {
      padding: spacing.gutter,
      gap: spacing.xxl,
    },
    section: {
      gap: spacing.md,
    },
    optionCard: {
      padding: 0,
      overflow: 'hidden',
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
    },
    optionDivider: {
      marginHorizontal: spacing.lg,
    },
    optionText: {
      gap: 2,
      flexShrink: 1,
    },
    optionLabel: {
      fontWeight: '600',
    },
    note: {
      paddingHorizontal: spacing.xs,
    },
    email: {
      marginTop: spacing.xs,
      fontWeight: '600',
      color: colors.cream,
    },
  });
