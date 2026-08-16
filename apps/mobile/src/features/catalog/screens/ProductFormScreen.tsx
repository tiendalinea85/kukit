import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { defaultProductForm, listCategories, saveProduct, getProduct } from '../repository';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { Select } from '../../../components/ui/Select';
import { useLoad } from '../../../hooks/useLoad';
import type { Product } from '../../../core/domain/types';
import type { CatalogStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<CatalogStackParamList>;
type Route = RouteProp<CatalogStackParamList, 'ProductForm'>;

export function ProductFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editing = Boolean(route.params?.id);

  const { data: categories } = useLoad(listCategories);
  const [form, setForm] = useState(defaultProductForm());

  useEffect(() => {
    if (route.params?.id) {
      getProduct(route.params.id).then((p) => {
        if (p) {
          setForm({
            id: p.id,
            name: p.name,
            description: p.description,
            sku: p.sku,
            category_id: p.category_id,
            cost_price: p.cost_price,
            sale_price: p.sale_price,
            unit: p.unit,
            tax_rate: p.tax_rate,
            stock: p.stock,
            min_stock: p.min_stock,
            active: p.active,
          });
        }
      });
    }
  }, [route.params?.id]);

  const catOptions = (categories ?? []).map((c) => ({ label: c.name, value: c.id }));

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Nombre requerido', 'El producto necesita un nombre.');
      return;
    }
    await saveProduct(form as unknown as Omit<Product, 'id' | 'code' | 'created_at' | 'updated_at'> & { id?: string });
    navigation.goBack();
  }

  return (
    <Screen>
      <Input label="Nombre *" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Nombre del producto" />
      <Input label="SKU / Código de barras" value={form.sku} onChangeText={(sku) => setForm({ ...form, sku })} placeholder="Opcional" autoCapitalize="characters" />
      <Select
        label="Categoría"
        options={catOptions}
        value={form.category_id}
        onChange={(category_id) => setForm({ ...form, category_id })}
      />
      <Input
        label="Precio costo (soles)"
        value={form.cost_price ? String(form.cost_price / 100) : ''}
        onChangeText={(t) => setForm({ ...form, cost_price: Math.round(parseFloat(t || '0') * 100) })}
        keyboardType="decimal-pad"
      />
      <Input
        label="Precio venta (soles)"
        value={form.sale_price ? String(form.sale_price / 100) : ''}
        onChangeText={(t) => setForm({ ...form, sale_price: Math.round(parseFloat(t || '0') * 100) })}
        keyboardType="decimal-pad"
      />
      <Input label="Unidad" value={form.unit} onChangeText={(unit) => setForm({ ...form, unit })} placeholder="unidad" />
      <Input
        label="Impuesto (%)"
        value={String(form.tax_rate)}
        onChangeText={(t) => setForm({ ...form, tax_rate: parseFloat(t || '0') })}
        keyboardType="decimal-pad"
      />
      <Input
        label={editing ? 'Stock (no editable aquí — usa movimientos)' : 'Stock inicial'}
        value={String(form.stock)}
        onChangeText={(t) => setForm({ ...form, stock: parseFloat(t || '0') })}
        keyboardType="decimal-pad"
        editable={false}
      />
      <Input
        label="Stock mínimo"
        value={String(form.min_stock)}
        onChangeText={(t) => setForm({ ...form, min_stock: parseFloat(t || '0') })}
        keyboardType="decimal-pad"
      />
      <Button title={editing ? 'Guardar cambios' : 'Crear producto'} onPress={handleSave} />
    </Screen>
  );
}
