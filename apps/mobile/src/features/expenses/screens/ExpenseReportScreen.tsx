import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { expensesSummary, type ExpenseFilters, type ExpenseSummary } from '../repository';
import { listCategories } from '../../catalog/repository';
import { useLoad } from '../../../hooks/useLoad';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { Select } from '../../../components/ui/Select';
import { colors, font, radius, spacing } from '../../../components/ui/theme';
import { formatMoney } from '../../../core/utils/format';

const PAYMENT_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  otro: 'Otro',
};

const EMPTY: ExpenseSummary = {
  total: 0,
  count: 0,
  paid: 0,
  pending: 0,
  voided: 0,
  by_category: [],
  by_payment: [],
};

export function ExpenseReportScreen() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const { data: categories } = useLoad(listCategories);

  const buildFilters = useCallback(
    (): ExpenseFilters => ({
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
      categoryId: categoryId || undefined,
    }),
    [dateFrom, dateTo, categoryId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await expensesSummary(buildFilters()));
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const s = summary ?? EMPTY;
  const categoryOptions = [
    { label: 'Todas las categorías', value: '' },
    ...(categories ?? []).map((c) => ({ label: c.name, value: c.id })),
  ];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Card title="Filtros" icon="⚙️">
          <View style={styles.rangeRow}>
            <View style={styles.flex}>
              <Input
                label="Desde (AAAA-MM-DD)"
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="2026-01-01"
              />
            </View>
            <View style={styles.flex}>
              <Input
                label="Hasta (AAAA-MM-DD)"
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="2026-12-31"
              />
            </View>
          </View>
          <Select options={categoryOptions} value={categoryId} onChange={setCategoryId} />
          <Pressable style={styles.applyBtn} onPress={load}>
            <Ionicons name="refresh" size={16} color={colors.white} />
            <Text style={styles.applyText}>Generar reporte</Text>
          </Pressable>
        </Card>

        {loading && !summary ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
        ) : (
          <>
            <View style={styles.grid}>
              <Card title="Total gastado" icon="💸" value={formatMoney(s.total)} accent={colors.danger} />
              <Card title="Gastos" icon="🧾" value={String(s.count)} accent={colors.primary} />
            </View>

            <Card title="Por estado" icon="📊">
              <SummaryLine label="Pagados" value={s.paid} total={s.count} />
              <SummaryLine label="Pendientes" value={s.pending} total={s.count} />
              <SummaryLine label="Anulados" value={s.voided} total={s.count} />
            </Card>

            <Card title="Por categoría" icon="🏷️">
              {s.by_category.length === 0 ? (
                <Text style={styles.muted}>Sin gastos en este rango.</Text>
              ) : (
                s.by_category.map((c) => (
                  <View key={c.category} style={styles.breakdownRow}>
                    <View style={styles.flex}>
                      <Text style={styles.breakdownName} numberOfLines={1}>{c.category}</Text>
                      <Text style={styles.breakdownCount}>{c.count} gasto(s)</Text>
                    </View>
                    <Text style={styles.breakdownTotal}>{formatMoney(c.total)}</Text>
                  </View>
                ))
              )}
            </Card>

            <Card title="Por método de pago" icon="💳">
              {s.by_payment.length === 0 ? (
                <Text style={styles.muted}>Sin gastos en este rango.</Text>
              ) : (
                s.by_payment.map((m) => (
                  <View key={m.method} style={styles.breakdownRow}>
                    <Text style={styles.breakdownName} numberOfLines={1}>
                      {PAYMENT_LABEL[m.method] ?? m.method}
                    </Text>
                    <Text style={styles.breakdownTotal}>{formatMoney(m.total)}</Text>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function SummaryLine({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.flex}>
        <Text style={styles.breakdownName}>{label}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
      </View>
      <Text style={styles.breakdownTotal}>
        {value} · {pct}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  applyText: {
    color: colors.white,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  breakdownName: {
    color: colors.text,
    fontSize: font.body,
  },
  breakdownCount: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  breakdownTotal: {
    color: colors.text,
    fontWeight: '700',
    fontSize: font.body,
  },
  barTrack: {
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  muted: {
    color: colors.textMuted,
    fontSize: font.body,
  },
});
