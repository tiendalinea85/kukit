import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { getExpense, voidExpense } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, spacing } from '../../../components/ui/theme';
import { formatMoney, formatDate } from '../../../core/utils/format';
import { canEditExpense, canVoidExpense } from '../domain/expenseRules';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList, 'ExpenseDetail'>;
type Route = RouteProp<OpsStackParamList, 'ExpenseDetail'>;

const STATUS_LABEL: Record<string, string> = {
  activo: 'Activo',
  pendiente: 'Pendiente',
  pagado: 'Pagado',
  cancelado: 'Anulado',
};

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

export function ExpenseDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { data, reload } = useLoad(() => getExpense(route.params.id));

  if (!data) {
    return (
      <Screen>
        <Text style={styles.loading}>Cargando gasto…</Text>
      </Screen>
    );
  }

  const expense = data;
  const voided = expense.status === 'cancelado';

  function confirmVoid() {
    Alert.alert('Anular gasto', '¿Anular este gasto? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: () => {
          voidExpense(expense.id).then(() => reload());
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card title={`${expense.code} · ${expense.name}`} icon={voided ? '🚫' : '💸'}>
        {expense.description ? <Text style={styles.desc}>{expense.description}</Text> : null}
        <Row label="Estado" value={STATUS_LABEL[expense.status] ?? expense.status} />
        <Row label="Categoría" value={expense.category_name ?? 'Sin categoría'} />
        <Row label="Tipo" value={expense.type_name ?? 'Sin tipo'} />
        <Row label="Método de pago" value={PAYMENT_LABEL[expense.payment_method] ?? expense.payment_method} />
        <Row label="Fecha" value={`${formatDate(expense.date)} · ${expense.time ?? ''}`} />
      </Card>

      {expense.details && expense.details.length > 0 ? (
        <Card title="Detalle del gasto" icon="🧾">
          {expense.details.map((d) => (
            <View key={d.id} style={styles.detailRow}>
              <View style={styles.detailMain}>
                <Text style={styles.detailName}>{d.product_name}</Text>
                <Text style={styles.detailSub}>
                  {d.quantity} × {formatMoney(d.unit_price)}
                </Text>
              </View>
              <Text style={styles.detailTotal}>{formatMoney(d.subtotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalStrong}>{formatMoney(expense.total_amount)}</Text>
          </View>
        </Card>
      ) : (
        <Card title="Monto" icon="💵">
          <Text style={styles.bigAmount}>{formatMoney(expense.total_amount)}</Text>
        </Card>
      )}

      {expense.notes ? (
        <Card title="Observaciones" icon="📝">
          <Text style={styles.desc}>{expense.notes}</Text>
        </Card>
      ) : null}

      {voided && expense.voided_at ? (
        <Card title="Anulado" icon="🚫">
          <Text style={styles.voidedText}>
            Este gasto fue anulado el {new Date(expense.voided_at).toLocaleString()}. Se conserva para
            el historial.
          </Text>
        </Card>
      ) : null}

      {canEditExpense(expense.status) ? (
        <Button
          title="Editar gasto"
          onPress={() => navigation.navigate('ExpenseForm', { id: expense.id })}
        />
      ) : null}
      {canVoidExpense(expense.status) ? (
        <Button title="Anular gasto" variant="danger" onPress={confirmVoid} style={styles.voidBtn} />
      ) : null}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  desc: {
    color: colors.textMuted,
    fontSize: font.body,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  rowValue: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '600',
    textAlign: 'right',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailMain: {
    flex: 1,
    marginRight: spacing.md,
  },
  detailName: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
  },
  detailSub: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 2,
  },
  detailTotal: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: font.body,
    fontWeight: '600',
  },
  totalStrong: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '800',
  },
  bigAmount: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  voidedText: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  voidBtn: {
    marginTop: spacing.md,
  },
});
