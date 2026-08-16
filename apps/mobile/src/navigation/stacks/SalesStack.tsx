import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SaleListScreen } from '../../features/sales/screens/SaleListScreen';
import { SaleFormScreen } from '../../features/sales/screens/SaleFormScreen';
import type { SalesStackParamList } from '../types';
import { colors } from '../../components/ui/theme';

const Stack = createNativeStackNavigator<SalesStackParamList>();

export function SalesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="SaleList" component={SaleListScreen} options={{ title: 'Ventas' }} />
      <Stack.Screen name="SaleForm" component={SaleFormScreen} options={{ title: 'Venta' }} />
    </Stack.Navigator>
  );
}
