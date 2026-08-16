import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeNavigator } from './stacks/HomeStack';
import { CatalogNavigator } from './stacks/CatalogStack';
import { SalesNavigator } from './stacks/SalesStack';
import { OpsNavigator } from './stacks/OpsStack';
import { ReportsNavigator } from './stacks/ReportsStack';
import type { MainTabParamList } from './types';
import { colors } from '../components/ui/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Inicio: ['home', 'home-outline'],
  Catalogo: ['cube', 'cube-outline'],
  Ventas: ['cart', 'cart-outline'],
  Operaciones: ['add-circle', 'add-circle-outline'],
  Reportes: ['bar-chart', 'bar-chart-outline'],
};

export function MainTabs() {
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
          const [active, inactive] = ICONS[route.name];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Inicio" component={HomeNavigator} />
      <Tab.Screen name="Catalogo" component={CatalogNavigator} />
      <Tab.Screen name="Ventas" component={SalesNavigator} />
      <Tab.Screen name="Operaciones" component={OpsNavigator} />
      <Tab.Screen name="Reportes" component={ReportsNavigator} />
    </Tab.Navigator>
  );
}
