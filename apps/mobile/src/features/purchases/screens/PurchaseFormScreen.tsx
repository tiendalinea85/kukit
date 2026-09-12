import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { defaultPurchaseForm, getPurchase, savePurchase } from '../repository';
import { listProducts } from '../../catalog/repository';
import { ItemEditor } from '../../../components/ItemEditor';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { Select } from '../../../components/ui/Select';
import { useLoad } from '../../../hooks/useLoad';
import { formatMoney } from '../../../core/utils/format';
import { colors } from '../../../components/ui/theme';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;
type Route = RouteProp<OpsStackParamList, 'PurchaseForm'>;

export function PurchaseFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { data: products } = useLoad(listProducts);
  const [form, setForm] = useState(defaultPurchaseForm());

  useEffect(() => {
    if (route.params?.id) {
      getPurchase(route.params.id).then((p) => {
        if (p) {
          setForm({
            id: p.id,
            supplier: p.supplier,
            invoice: p.invoice,
            payment_method: p.payment_method,
            date: p.date,
            time: p.time,
            status: p.status,
            notes: p.notes,
            items: (p.items ?? []).map((i) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              quantity: i.quantity,
              unit_price: i.unit_price,
            })),
          });
        }
      });
    }
  }, [route.params?.id]);

  const total = useMemo(
    () => form.items.reduce((acc, i) => acc + Math.round(i.quantity * i.unit_price), 0),
    [form.items]
  );

  async function handleSave() {
    if (form.items.length === 0 || !form.items.some((i) => i.product_name)) {
      Alert.alert('Sin líneas', 'Agrega al menos una línea con producto.');
      return;
    }
    await savePurchase(form);
    navigation.goBack();
  }

  return (
    <Screen>
      <Input label="Proveedor" value={form.supplier} onChangeText={(supplier) => setForm({ ...form, supplier })} placeholder="Nombre del proveedor" />
      <Input label="N° Factura" value={form.invoice} onChangeText={(invoice) => setForm({ ...form, invoice })} placeholder="Número de factura (opcional)" />
      <Select
        label="Método de pago"
        options={[
          { label: 'Efectivo', value: 'efectivo' },
          { label: 'Tarjeta', value: 'tarjeta' },
          { label: 'Transferencia', value: 'transferencia' },
          { label: 'Otro', value: 'otro' },
        ]}
        value={form.payment_method}
        onChange={(payment_method) => setForm({ ...form, payment_method: payment_method as typeof form.payment_method })}
      />
      <Input label="Fecha" value={form.date} onChangeText={(date) => setForm({ ...form, date })} />
      <Input label="Hora" value={form.time} onChangeText={(time) => setForm({ ...form, time })} />
      <Select
        label="Estado"
        options={[
          { label: 'Pendiente', value: 'pendiente' },
          { label: 'Recibida (entra a inventario)', value: 'recibida' },
          { label: 'Cancelada', value: 'cancelada' },
        ]}
        value={form.status}
        onChange={(status) => setForm({ ...form, status: status as 'pendiente' | 'recibida' | 'cancelada' })}
      />
      <Input label="Notas" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline />

      <ItemEditor
        items={form.items}
        products={products ?? []}
        priceField="cost"
        onChange={(items) => setForm({ ...form, items })}
      />

      <Card title="Total" icon="🧮">
        <Text style={styles.totalLine}>Total compra: <Text style={styles.totalStrong}>{formatMoney(total)}</Text></Text>
      </Card>

      <Button title={route.params?.id ? 'Guardar cambios' : 'Registrar compra'} onPress={handleSave} />
    </Screen>
  );
}

const styles = {
  totalLine: {
    color: colors.textMuted,
    fontSize: 15,
  },
  totalStrong: {
    color: colors.text,
    fontWeight: '700',
  },
} as const;
