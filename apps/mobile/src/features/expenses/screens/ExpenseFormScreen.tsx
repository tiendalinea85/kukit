import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { defaultExpenseForm, getExpense, saveExpense, voidExpense } from '../repository';
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
import { canEditExpense, canVoidExpense, isVoided } from '../domain/expenseRules';
import { expenseSchema } from '../schemas/expenseSchema';
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
];

const VOIDED_STATUS = 'cancelado';

export function ExpenseFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { data: categories } = useLoad(listCategories);
  const { data: types } = useLoad(listExpenseTypes);
  const [form, setForm] = useState(defaultExpenseForm());
  const [details, setDetails] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  const editing = Boolean(route.params?.id);
  const voided = isVoided(form.status);

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
    if (saving) return;
    const result = expenseSchema.safeParse({
      name: form.name,
      description: form.description,
      amount: form.amount / 100,
      category_id: form.category_id,
      type_id: form.type_id,
      payment_method: form.payment_method,
      status: form.status,
      date: form.date,
      time: form.time,
      notes: form.notes,
      details: hasDetails
        ? details.map((d) => ({
            product_name: d.product_name,
            quantity: d.quantity,
            unit_price: d.unit_price / 100,
          }))
        : undefined,
    });
    if (!result.success) {
      const first = result.error.issues[0];
      Alert.alert('Datos inválidos', first?.message ?? 'Revisa los campos marcados.');
      return;
    }
    setSaving(true);
    try {
      await saveExpense({
        ...form,
        amount: Math.round(result.data.amount * 100),
        details: hasDetails
          ? details.map((d) => ({
              product_name: d.product_name,
              quantity: d.quantity,
              unit_price: Math.round(d.unit_price),
            }))
          : [],
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  function confirmVoid() {
    if (!route.params?.id) return;
    Alert.alert('Anular gasto', '¿Anular este gasto? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: () => {
          voidExpense(route.params!.id!).then(() => navigation.goBack());
        },
      },
    ]);
  }

  return (
    <Screen>
      {voided ? (
        <Card title="Gasto anulado" icon="🚫">
          <Text style={styles.voidedText}>
            Este gasto fue anulado y no puede editarse. Las operaciones históricas se conservan.
          </Text>
        </Card>
      ) : null}

      <Input
        label="Nombre *"
        value={form.name}
        onChangeText={(name) => setForm({ ...form, name })}
        placeholder="Ej: Luz eléctrica"
        editable={!voided}
      />
      <Input
        label="Descripción"
        value={form.description}
        onChangeText={(description) => setForm({ ...form, description })}
        editable={!voided}
      />
      <Select
        label="Categoría"
        options={(categories ?? []).map((c) => ({ label: c.name, value: c.id }))}
        value={form.category_id}
        onChange={(category_id) => setForm({ ...form, category_id })}
        editable={!voided}
      />
      <Select
        label="Tipo de gasto"
        options={(types ?? []).map((t) => ({ label: t.name, value: t.id }))}
        value={form.type_id}
        onChange={(type_id) => setForm({ ...form, type_id })}
        editable={!voided}
      />
      <Select
        label="Método de pago"
        options={PAYMENT_METHODS}
        value={form.payment_method}
        onChange={(payment_method) => setForm({ ...form, payment_method: payment_method as typeof form.payment_method })}
        editable={!voided}
      />
      <Select
        label="Estado"
        options={STATUSES}
        value={form.status}
        onChange={(status) => setForm({ ...form, status: status as typeof form.status })}
        editable={!voided}
      />
      <Input label="Fecha" value={form.date} onChangeText={(date) => setForm({ ...form, date })} editable={!voided} />
      <Input label="Hora" value={form.time} onChangeText={(time) => setForm({ ...form, time })} editable={!voided} />
      <Input label="Observaciones" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline editable={!voided} />

      {!hasDetails ? (
        <Input
          label="Monto (S/)"
          value={form.amount ? String(form.amount / 100) : ''}
          onChangeText={(t) => setForm({ ...form, amount: Math.round(parseFloat(t || '0') * 100) })}
          keyboardType="decimal-pad"
          editable={!voided}
        />
      ) : null}

      <ItemEditor items={details} products={[]} onChange={setDetails} editable={!voided} />

      <Card title="Total" icon="🧮">
        <Text style={styles.totalLine}>Total gasto: <Text style={styles.totalStrong}>{formatMoney(total)}</Text></Text>
      </Card>

      {!voided ? (
        <>
          <Button
            title={editing ? 'Guardar cambios' : 'Registrar gasto'}
            onPress={handleSave}
            disabled={saving || !canEditExpense(form.status)}
          />
          {editing && canVoidExpense(form.status) ? (
            <Button title="Anular gasto" variant="danger" onPress={confirmVoid} style={styles.voidBtn} />
          ) : null}
        </>
      ) : null}
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
  voidedText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  voidBtn: {
    marginTop: 12,
  },
} as const;
