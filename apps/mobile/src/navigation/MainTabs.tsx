import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { HomeNavigator } from './stacks/HomeStack';
import { CatalogNavigator } from './stacks/CatalogStack';
import { SalesNavigator } from './stacks/SalesStack';
import { OpsNavigator } from './stacks/OpsStack';
import { ReportsNavigator } from './stacks/ReportsStack';
import type { MainTabParamList } from './types';
import { colors } from '../components/ui/theme';
import { useModuleStore, visibleTabs } from '../core/workspace/moduleRegistry';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Inicio: ['home', 'home-outline'],
  Catalogo: ['cube', 'cube-outline'],
  Ventas: ['cart', 'cart-outline'],
  Operaciones: ['add-circle', 'add-circle-outline'],
  Reportes: ['bar-chart', 'bar-chart-outline'],
};

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  Inicio: HomeNavigator,
  Catalogo: CatalogNavigator,
  Ventas: SalesNavigator,
  Operaciones: OpsNavigator,
  Reportes: ReportsNavigator,
};

export function MainTabs() {
  const { enabled, load } = useModuleStore();

  useEffect(() => {
    load();
  }, [load]);

  const visible = visibleTabs(enabled);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = ICONS[route.name];
          if (!icons) return null;
          const [active, inactive] = icons;
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      {visible.map((tabName) => {
        const Component = TAB_COMPONENTS[tabName];
        if (!Component) return null;
        return (
          <Tab.Screen
            key={tabName}
            name={tabName as keyof MainTabParamList}
            component={Component}
          />
        );
      })}
    </Tab.Navigator>
  );
}
