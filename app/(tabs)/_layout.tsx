import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { TabBar } from '../../src/components/TabBar';
import { useTheme } from '../../src/providers/theme';

/**
 * Titles and icons live in TabBar's TAB_META; the route order here is the
 * bar's order (Home · Bar · Barkeep · Recipes), with Scan appended by the bar
 * itself since it opens a modal rather than a tab.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
      screenListeners={{
        tabPress: () => {
          void Haptics.selectionAsync();
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="bar" options={{ title: 'Bar' }} />
      <Tabs.Screen name="ask" options={{ title: 'Barkeep' }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes' }} />
    </Tabs>
  );
}
