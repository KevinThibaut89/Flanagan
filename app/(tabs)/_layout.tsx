import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { colors, gradients, shadows } from '../../src/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={name} color={color as string} size={size} />
  );
}

/** Scan sits centre-stage as a raised copper button, like a camera shutter. */
function ScanButton() {
  return (
    <View style={styles.scanWrap}>
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scanButton}
      >
        <MaterialCommunityIcons name="barcode-scan" size={24} color={colors.bg} />
      </LinearGradient>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentSoft,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: icon('home-variant-outline') }}
      />
      <Tabs.Screen
        name="bar"
        options={{ title: 'Bar', tabBarIcon: icon('bottle-wine-outline') }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarLabel: () => null,
          tabBarIcon: () => <ScanButton />,
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{ title: 'Ask', tabBarIcon: icon('creation') }}
      />
      <Tabs.Screen
        name="recipes"
        options={{ title: 'Recipes', tabBarIcon: icon('notebook-outline') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scanWrap: {
    marginTop: -22,
    // A bg-coloured ring separates the button from whatever scrolls beneath.
    padding: 4,
    borderRadius: 31,
    backgroundColor: colors.bg,
  },
  scanButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
});
