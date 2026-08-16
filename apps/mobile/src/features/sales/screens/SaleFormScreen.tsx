import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { defaultSaleForm, getSale, saveSale } from '../repository';
import { listProducts } from '../../catalog/repository';
import { listClients } from '../../customers/repository';
import { ItemEditor, type LineItem } from '../../../components/ItemEditor';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { Select } from '../../../components/ui/Select';
import { useLoad } from '../../../hooks/useLoad';
import { formatMoney } from '../../../core/utils/format';
import { colors } from '../../../components/ui/theme';
import type { SalesStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<SalesStackParamList>;
type Route = RouteProp<SalesStackParamList, 'SaleForm'>;

export function SaleFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const { data: products } = useLoad(listProducts);
  const { data: clients } = useLoad(listClients);

  const [form, setForm] = useState(defaultSaleForm());
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (route.params?.id) {
      getSale(route.params.id).then((s) => {
        if (s) {
          setForm({
            id: s.id,
            client_id: s.client_id,
            date: s.date,
            time: s.time,
            status: s.status,
            payment_method: s.payment_method,
            tax_rate: 0,
            notes: s.notes,
            items: [],
          });
          setItems(
            (s.items ?? []).map((i) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: i.quantity,
              unit_price: i.unit_price,
              discount: i.discount,
            }))
          );
        }
      });
    }
  }, [route.params?.id]);

  const clientOptions = useMemo(
    () => (clients ?? []).map((c) => ({ label: c.name, value: c.id })),
    [clients]
  );

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, i) => acc + Math.round(i.quantity * i.unit_price), 0);
    const discount = items.reduce((acc, i) => acc + Math.round(i.discount ?? 0), 0);
    const tax = Math.round(((subtotal - discount) * (form.tax_rate ?? 0)) / 100);
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [items, form.tax_rate]);

  async function handleSave() {
    if (items.length === 0 || !items.some((i) => i.product_name)) {
      Alert.alert('Sin líneas', 'Agrega al menos una línea con producto.');
      return;
    }
    await saveSale({
      ...form,
      items: items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount ?? 0,
      })),
    });
    navigation.goBack();
  }

  return (
    <Screen>
      <Select
        label="Cliente"
        options={clientOptions}
        value={form.client_id}
        onChange={(client_id) => setForm({ ...form, client_id })}
      />
      <Input label="Fecha" value={form.date} onChangeText={(date) => setForm({ ...form, date })} />
      <Input label="Hora" value={form.time} onChangeText={(time) => setForm({ ...form, time })} />
      <Input
        label="Impuesto (%)"
        value={String(form.tax_rate)}
        onChangeText={(t) => setForm({ ...form, tax_rate: parseFloat(t || '0') })}
        keyboardType="decimal-pad"
      />
      <Input label="Notas" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline />

      <ItemEditor
        items={items}
        products={products ?? []}
        priceField="sale"
        withDiscount
        onChange={setItems}
      />

      <Card title="Totales" icon="🧮">
        <Text style={styles.totalLine}>Subtotal: <Text style={styles.totalStrong}>{formatMoney(totals.subtotal)}</Text></Text>
        <Text style={styles.totalLine}>Descuento: <Text style={styles.totalStrong}>{formatMoney(totals.discount)}</Text></Text>
        <Text style={styles.totalLine}>Impuesto: <Text style={styles.totalStrong}>{formatMoney(totals.tax)}</Text></Text>
        <Text style={[styles.totalLine, styles.totalFinal]}>Total: <Text style={styles.totalStrong}>{formatMoney(totals.total)}</Text></Text>
      </Card>

      <Button title={route.params?.id ? 'Guardar cambios' : 'Registrar venta'} onPress={handleSave} />
    </Screen>
  );
}

const styles = {
  totalLine: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 4,
  },
  totalStrong: {
    color: colors.text,
    fontWeight: '700',
  },
  totalFinal: {
    marginTop: 8,
  },
} as const;
