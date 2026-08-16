import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { defaultExpenseForm, getExpense, saveExpense } from '../repository';
import { listCategories, listExpenseTypes } from '../../catalog/repository';
import { ItemEditor, type LineItem } from '../../../components/ItemEditor';
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
type Route = RouteProp<OpsStackParamList, 'ExpenseForm'>;

const PAYMENT_METHODS = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Tarjeta', value: 'tarjeta' },
  { label: 'Transferencia', value: 'transferencia' },
  { label: 'Otro', value: 'otro' },
];

const STATUSES = [
  { label: 'Activo', value: 'activo' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Pagado', value: 'pagado' },
  { label: 'Cancelado', value: 'cancelado' },
];

export function ExpenseFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { data: categories } = useLoad(listCategories);
  const { data: types } = useLoad(listExpenseTypes);
  const [form, setForm] = useState(defaultExpenseForm());
  const [details, setDetails] = useState<LineItem[]>([]);

  useEffect(() => {
    if (route.params?.id) {
      getExpense(route.params.id).then((e) => {
        if (e) {
          setForm({
            id: e.id,
            name: e.name,
            description: e.description,
            amount: e.amount,
            category_id: e.category_id,
            type_id: e.type_id,
            payment_method: e.payment_method,
            status: e.status,
            date: e.date,
            time: e.time,
            notes: e.notes,
            details: [],
          });
          setDetails(
            (e.details ?? []).map((d) => ({
              product_id: null,
              product_name: d.product_name,
              quantity: d.quantity,
              unit_price: d.unit_price,
            }))
          );
        }
      });
    }
  }, [route.params?.id]);

  const hasDetails = details.length > 0;
  const total = useMemo(() => {
    if (hasDetails) {
      return details.reduce((acc, d) => acc + Math.round(d.quantity * d.unit_price), 0);
    }
    return Math.round(form.amount);
  }, [form.amount, details, hasDetails]);

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Nombre requerido', 'El gasto necesita un nombre.');
      return;
    }
    await saveExpense({
      ...form,
      details: details.map((d) => ({
        product_name: d.product_name,
        quantity: d.quantity,
        unit_price: d.unit_price,
      })),
    });
    navigation.goBack();
  }

  return (
    <Screen>
      <Input label="Nombre *" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Ej: Luz eléctrica" />
      <Input label="Descripción" value={form.description} onChangeText={(description) => setForm({ ...form, description })} />
      <Select
        label="Categoría"
        options={(categories ?? []).map((c) => ({ label: c.name, value: c.id }))}
        value={form.category_id}
        onChange={(category_id) => setForm({ ...form, category_id })}
      />
      <Select
        label="Tipo de gasto"
        options={(types ?? []).map((t) => ({ label: t.name, value: t.id }))}
        value={form.type_id}
        onChange={(type_id) => setForm({ ...form, type_id })}
      />
      <Select
        label="Método de pago"
        options={PAYMENT_METHODS}
        value={form.payment_method}
        onChange={(payment_method) => setForm({ ...form, payment_method: payment_method as typeof form.payment_method })}
      />
      <Select
        label="Estado"
        options={STATUSES}
        value={form.status}
        onChange={(status) => setForm({ ...form, status: status as typeof form.status })}
      />
      <Input label="Fecha" value={form.date} onChangeText={(date) => setForm({ ...form, date })} />
      <Input label="Hora" value={form.time} onChangeText={(time) => setForm({ ...form, time })} />
      <Input label="Notas" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline />

      {!hasDetails ? (
        <Input
          label="Monto (S/)"
          value={form.amount ? String(form.amount / 100) : ''}
          onChangeText={(t) => setForm({ ...form, amount: Math.round(parseFloat(t || '0') * 100) })}
          keyboardType="decimal-pad"
        />
      ) : null}

      <ItemEditor
        items={details}
        products={[]}
        onChange={setDetails}
      />

      <Card title="Total" icon="🧮">
        <Text style={styles.totalLine}>Total gasto: <Text style={styles.totalStrong}>{formatMoney(total)}</Text></Text>
      </Card>

      <Button title={route.params?.id ? 'Guardar cambios' : 'Registrar gasto'} onPress={handleSave} />
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
