import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProductListScreen } from '../../features/catalog/screens/ProductListScreen';
import { ProductFormScreen } from '../../features/catalog/screens/ProductFormScreen';
import { CategoryListScreen } from '../../features/catalog/screens/CategoryListScreen';
import { CategoryFormScreen } from '../../features/catalog/screens/CategoryFormScreen';
import type { CatalogStackParamList } from '../types';
import { colors } from '../../components/ui/theme';

const Stack = createNativeStackNavigator<CatalogStackParamList>();

export function CatalogNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="ProductList" component={ProductListScreen} options={{ title: 'Productos' }} />
      <Stack.Screen name="ProductForm" component={ProductFormScreen} options={{ title: 'Producto' }} />
      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: 'Categorías' }} />
      <Stack.Screen name="CategoryForm" component={CategoryFormScreen} options={{ title: 'Categoría' }} />
    </Stack.Navigator>
  );
}
