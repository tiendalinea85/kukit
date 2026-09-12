import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../../features/home/screens/DashboardScreen';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen';
import { AuditScreen } from '../../features/audit/screens/AuditScreen';
import { ModuleConfigScreen } from '../../features/workspaces/screens/ModuleConfigScreen';
import type { HomeStackParamList } from '../types';
import { colors } from '../../components/ui/theme';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
      <Stack.Screen name="Audit" component={AuditScreen} options={{ title: 'Auditoría' }} />
      <Stack.Screen name="ModuleConfig" component={ModuleConfigScreen} options={{ title: 'Configurar módulos' }} />
    </Stack.Navigator>
  );
}
