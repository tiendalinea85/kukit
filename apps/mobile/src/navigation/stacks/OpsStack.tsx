import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OpsHomeScreen } from '../../features/operations/screens/OpsHomeScreen';
import { PurchaseListScreen } from '../../features/purchases/screens/PurchaseListScreen';
import { PurchaseFormScreen } from '../../features/purchases/screens/PurchaseFormScreen';
import { ExpenseListScreen } from '../../features/expenses/screens/ExpenseListScreen';
import { ExpenseFormScreen } from '../../features/expenses/screens/ExpenseFormScreen';
import { ExpenseDetailScreen } from '../../features/expenses/screens/ExpenseDetailScreen';
import { ExpenseReportScreen } from '../../features/expenses/screens/ExpenseReportScreen';
import { InvestmentListScreen } from '../../features/investments/screens/InvestmentListScreen';
import { InvestmentFormScreen } from '../../features/investments/screens/InvestmentFormScreen';
import { InventoryListScreen } from '../../features/inventory/screens/InventoryListScreen';
import { MovementFormScreen } from '../../features/inventory/screens/MovementFormScreen';
import { ClientListScreen } from '../../features/customers/screens/ClientListScreen';
import { ClientFormScreen } from '../../features/customers/screens/ClientFormScreen';
import type { OpsStackParamList } from '../types';
import { colors } from '../../components/ui/theme';

const Stack = createNativeStackNavigator<OpsStackParamList>();

export function OpsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="OpsHome" component={OpsHomeScreen} options={{ title: 'Registros' }} />
      <Stack.Screen name="PurchaseList" component={PurchaseListScreen} options={{ title: 'Compras' }} />
      <Stack.Screen name="PurchaseForm" component={PurchaseFormScreen} options={{ title: 'Compra' }} />
      <Stack.Screen name="ExpenseList" component={ExpenseListScreen} options={{ title: 'Gastos' }} />
      <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} options={{ title: 'Gasto' }} />
      <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} options={{ title: 'Detalle de gasto' }} />
      <Stack.Screen name="ExpenseReport" component={ExpenseReportScreen} options={{ title: 'Reporte de gastos' }} />
      <Stack.Screen name="InvestmentList" component={InvestmentListScreen} options={{ title: 'Inversiones' }} />
      <Stack.Screen name="InvestmentForm" component={InvestmentFormScreen} options={{ title: 'Inversión' }} />
      <Stack.Screen name="InventoryList" component={InventoryListScreen} options={{ title: 'Inventario' }} />
      <Stack.Screen name="MovementForm" component={MovementFormScreen} options={{ title: 'Movimiento' }} />
      <Stack.Screen name="ClientList" component={ClientListScreen} options={{ title: 'Clientes' }} />
      <Stack.Screen name="ClientForm" component={ClientFormScreen} options={{ title: 'Cliente' }} />
    </Stack.Navigator>
  );
}
