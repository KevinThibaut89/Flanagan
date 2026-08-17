import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import { Body, Card, Divider, Label, Muted, Screen } from '../src/components/ui';
import { select } from '../src/lib/haptics';
import { useAuth } from '../src/providers/auth';
import { usePreferences } from '../src/providers/preferences';
import { colors, spacing, typography } from '../src/theme';
import type { UnitPreference } from '../src/types/database';

const UNIT_OPTIONS: Array<{ value: UnitPreference; label: string; example: string }> = [
  { value: 'metric', label: 'Millilitres', example: '45 ml gin' },
  { value: 'imperial', label: 'Ounces', example: '1½ oz gin' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { units, setUnits } = usePreferences();

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Done">
              <Text style={styles.done}>Done</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Label style={styles.sectionHeader}>Measurements</Label>
          <Card style={styles.optionCard}>
            {UNIT_OPTIONS.map((option, i) => (
              <View key={option.value}>
                {i > 0 ? <Divider style={styles.optionDivider} /> : null}
                <Pressable
                  onPress={() => {
                    select();
                    setUnits(option.value);
                  }}
                  style={styles.option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: units === option.value }}
                >
                  <View style={styles.optionText}>
                    <Body>{option.label}</Body>
                    <Muted style={styles.optionExample}>{option.example}</Muted>
                  </View>
                  {units === option.value ? (
                    <Icon name="check" size={20} color={colors.accent} />
                  ) : null}
                </Pressable>
              </View>
            ))}
          </Card>
          <Muted style={styles.note}>
            Amounts are stored the same either way — this only changes how they’re shown, so you
            can switch back at any time without touching your recipes.
          </Muted>
        </View>

        <View style={styles.section}>
          <Label style={styles.sectionHeader}>Account</Label>
          <Card style={styles.optionCard}>
            <View style={styles.option}>
              <Body>Signed in as</Body>
              <Muted>{user?.email ?? 'Unknown'}</Muted>
            </View>
          </Card>
          <Button label="Sign out" variant="danger" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: {
    ...typography.headline,
    color: colors.accent,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.xxl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    marginLeft: spacing.lg,
  },
  optionCard: {
    padding: 0,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  optionDivider: {
    marginLeft: spacing.lg,
  },
  optionText: {
    gap: 2,
  },
  optionExample: {
    ...typography.footnote,
  },
  note: {
    ...typography.footnote,
    paddingHorizontal: spacing.lg,
  },
});
