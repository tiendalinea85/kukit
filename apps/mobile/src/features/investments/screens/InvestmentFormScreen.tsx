import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Text } from 'react-native';
import { defaultInvestmentForm, getInvestment, saveInvestment } from '../repository';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { Select } from '../../../components/ui/Select';
import { formatMoney } from '../../../core/utils/format';
import { colors } from '../../../components/ui/theme';
import { INVESTMENT_CATEGORIES } from '../../../core/domain/types';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;
type Route = RouteProp<OpsStackParamList, 'InvestmentForm'>;

const ASSET_TYPES = [
  { label: 'Activo', value: 'activo' },
  { label: 'Ahorro', value: 'ahorro' },
  { label: 'Cripto', value: 'crypto' },
  { label: 'Inmobiliaria', value: 'inmobiliaria' },
  { label: 'Otro', value: 'otro' },
];

const CATEGORY_OPTIONS = INVESTMENT_CATEGORIES.map((c) => ({ label: c, value: c }));

const PAYMENT_OPTIONS = [
  { label: 'Efectivo', value: 'efectivo' },
  { label: 'Tarjeta', value: 'tarjeta' },
  { label: 'Transferencia', value: 'transferencia' },
  { label: 'Otro', value: 'otro' },
];

const STATUS_OPTIONS = [
  { label: 'Pagado', value: 'pagado' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Anulado', value: 'anulado' },
];

export function InvestmentFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [form, setForm] = useState(defaultInvestmentForm());

  useEffect(() => {
    if (route.params?.id) {
      getInvestment(route.params.id).then((i) => {
        if (i) {
          setForm({
            id: i.id,
            asset_name: i.asset_name,
            asset_type: i.asset_type,
            amount: i.amount,
            current_value: i.current_value,
            category: i.category,
            supplier: i.supplier,
            payment_method: i.payment_method,
            status: i.status,
            date: i.date,
            notes: i.notes,
          });
        }
      });
    }
  }, [route.params?.id]);

  const returnRate = useMemo(() => {
    if (form.amount <= 0) return 0;
    return ((form.current_value - form.amount) / form.amount) * 100;
  }, [form.amount, form.current_value]);

  async function handleSave() {
    if (!form.asset_name.trim()) {
      Alert.alert('Nombre requerido', 'La inversión necesita un nombre.');
      return;
    }
    await saveInvestment(form);
    navigation.goBack();
  }

  return (
    <Screen>
      <Input label="Nombre del activo *" value={form.asset_name} onChangeText={(asset_name) => setForm({ ...form, asset_name })} />
      <Select
        label="Categoría"
        options={CATEGORY_OPTIONS}
        value={form.category || undefined}
        onChange={(category) => setForm({ ...form, category })}
      />
      <Select
        label="Tipo"
        options={ASSET_TYPES}
        value={form.asset_type}
        onChange={(asset_type) => setForm({ ...form, asset_type: asset_type as typeof form.asset_type })}
      />
      <Input
        label="Monto invertido (S/)"
        value={form.amount ? String(form.amount / 100) : ''}
        onChangeText={(t) => setForm({ ...form, amount: Math.round(parseFloat(t || '0') * 100) })}
        keyboardType="decimal-pad"
      />
      <Input
        label="Valor actual (S/)"
        value={form.current_value ? String(form.current_value / 100) : ''}
        onChangeText={(t) => setForm({ ...form, current_value: Math.round(parseFloat(t || '0') * 100) })}
        keyboardType="decimal-pad"
      />
      <Input label="Proveedor" value={form.supplier} onChangeText={(supplier) => setForm({ ...form, supplier })} placeholder="Nombre del proveedor" />
      <Select
        label="Método de pago"
        options={PAYMENT_OPTIONS}
        value={form.payment_method}
        onChange={(payment_method) => setForm({ ...form, payment_method: payment_method as typeof form.payment_method })}
      />
      <Select
        label="Estado"
        options={STATUS_OPTIONS}
        value={form.status}
        onChange={(status) => setForm({ ...form, status: status as typeof form.status })}
      />
      <Input label="Fecha" value={form.date} onChangeText={(date) => setForm({ ...form, date })} />
      <Input label="Notas" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline />

      <Card title="Rendimiento" icon="📊">
        <Text style={{ color: returnRate >= 0 ? colors.success : colors.danger, fontSize: 18, fontWeight: '700' }}>
          {returnRate >= 0 ? '+' : ''}
          {returnRate.toFixed(2)}%
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
          Ganancia: {formatMoney(form.current_value - form.amount)}
        </Text>
      </Card>

      <Button title={route.params?.id ? 'Guardar cambios' : 'Registrar inversión'} onPress={handleSave} />
    </Screen>
  );
}
