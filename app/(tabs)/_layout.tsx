import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, type ColorValue } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../src/providers/theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <MaterialCommunityIcons name={name} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
      screenListeners={{
        tabPress: () => {
          void Haptics.selectionAsync();
        },
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
