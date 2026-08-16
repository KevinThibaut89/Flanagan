import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Button } from '../src/components/Button';
import { Body, Card, Divider, Label, Muted, Screen, Title } from '../src/components/ui';
import { useAuth } from '../src/providers/auth';
import { usePreferences } from '../src/providers/preferences';
import { colors, radius, spacing } from '../src/theme';
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
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Title>Settings</Title>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Close">
          <MaterialCommunityIcons name="close" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Label>Measurements</Label>
          <Card style={styles.optionCard}>
            {UNIT_OPTIONS.map((option, i) => (
              <View key={option.value}>
                {i > 0 ? <Divider style={styles.optionDivider} /> : null}
                <Pressable
                  onPress={() => setUnits(option.value)}
                  style={styles.option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: units === option.value }}
                >
                  <View style={styles.optionText}>
                    <Body style={styles.optionLabel}>{option.label}</Body>
                    <Muted>{option.example}</Muted>
                  </View>
                  {units === option.value ? (
                    <MaterialCommunityIcons name="check" size={20} color={colors.accent} />
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  content: {
    padding: spacing.lg,
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
    color: colors.accentSoft,
  },
});
