import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';

import { Icon, type IconName } from '../../src/components/Icon';
import { colors } from '../../src/theme';

function icon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Icon name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        sceneStyle: { backgroundColor: colors.bg },
        // iOS floats a translucent bar over the content; Android keeps an
        // opaque one, since BlurView there is just a tint.
        ...(Platform.OS === 'ios'
          ? {
              tabBarStyle: {
                position: 'absolute' as const,
                backgroundColor: 'transparent',
                borderTopColor: colors.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
              tabBarBackground: () => (
                <BlurView
                  tint="systemChromeMaterialDark"
                  intensity={100}
                  style={StyleSheet.absoluteFill}
                />
              ),
            }
          : {
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.borderSubtle,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            }),
      }}
    >
      <Tabs.Screen name="(bar)" options={{ title: 'Bar', tabBarIcon: icon('bar') }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: icon('scan') }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask', tabBarIcon: icon('ask') }} />
      <Tabs.Screen name="(recipes)" options={{ title: 'Recipes', tabBarIcon: icon('recipes') }} />
    </Tabs>
  );
}
