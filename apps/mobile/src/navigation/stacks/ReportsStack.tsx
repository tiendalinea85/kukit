import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReportsScreen } from '../../features/reports/screens/ReportsScreen';
import type { ReportsStackParamList } from '../types';
import { colors } from '../../components/ui/theme';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export function ReportsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ReportsHome" component={ReportsScreen} options={{ title: 'Reportes' }} />
    </Stack.Navigator>
  );
}
