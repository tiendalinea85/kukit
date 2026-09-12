import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { dashboardSummary, salesSeries, expensesSeries, topProducts, stockValue } from '../repository';
import type { DashboardSummary, SeriesPoint, TopProduct } from '../repository';
import { Card } from '../../../components/ui/Card';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, radius, spacing } from '../../../components/ui/theme';
import { formatMoney } from '../../../core/utils/format';
import type { ReportsStackParamList } from '../../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<ReportsStackParamList, 'ReportsHome'>;

export function ReportsScreen() {
  const navigation = useNavigation<Nav>();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sales, setSales] = useState<SeriesPoint[]>([]);
  const [expenses, setExpenses] = useState<SeriesPoint[]>([]);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [stock, setStock] = useState<{ cost_value: number; sale_value: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          const [s, sv, ex, t, st] = await Promise.all([
            dashboardSummary(),
            salesSeries(14),
            expensesSeries(14),
            topProducts(5),
            stockValue(),
          ]);
          setSummary(s);
          setSales(sv);
          setExpenses(ex);
          setTop(t);
          setStock(st);
        } finally {
          setLoading(false);
        }
      })();
    }, [])
  );

  if (loading && !summary) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Card title="Ventas" icon="💰" value={formatMoney(summary?.total_sales ?? 0)} accent={colors.success} />
          </View>
          <Pressable
            style={styles.gridItem}
            onPress={() => navigation.navigate('ExpenseReport')}
          >
            <Card title="Gastos" icon="💸" value={formatMoney(summary?.total_expenses ?? 0)} accent={colors.danger} />
          </Pressable>
        </View>

        <Card title="Ventas vs Gastos (14 días)" icon="📈">
          <MiniChart series={[{ name: 'Ventas', data: sales }, { name: 'Gastos', data: expenses }]} />
        </Card>

        <Card title="Top productos" icon="🏆">
          {top.length === 0 ? (
            <Text style={styles.muted}>Sin datos de ventas aún.</Text>
          ) : (
            top.map((t, i) => (
              <View key={i} style={styles.topRow}>
                <Text style={styles.topRank}>#{i + 1}</Text>
                <Text style={styles.topName} numberOfLines={1}>{t.product}</Text>
                <Text style={styles.topQty}>{t.quantity} ud</Text>
                <Text style={styles.topRevenue}>{formatMoney(t.revenue)}</Text>
              </View>
            ))
          )}
        </Card>

        <Card title="Valor de inventario" icon="📦">
          <Text style={styles.line}>
            Costo: <Text style={styles.strong}>{formatMoney(stock?.cost_value ?? 0)}</Text>
          </Text>
          <Text style={styles.line}>
            Venta: <Text style={styles.strong}>{formatMoney(stock?.sale_value ?? 0)}</Text>
          </Text>
        </Card>

        <Card title="Productos con stock bajo" icon="⚠️">
          <Text style={styles.line}>
            <Text style={[styles.strong, { color: colors.danger }]}>{summary?.low_stock_count ?? 0}</Text>{' '}
            productos por debajo de su mínimo
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function MiniChart({ series }: { series: { name: string; data: SeriesPoint[] }[] }) {
  const labels = Array.from(
    new Set(series.flatMap((s) => s.data.map((d) => d.label)))
  );
  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  const max = Math.max(...allValues, 1);

  const colorsBySeries = [colors.success, colors.danger];

  return (
    <View>
      {series.map((s, si) => (
        <View key={s.name} style={styles.chartBlock}>
          <Text style={styles.chartTitle}>{s.name}</Text>
          <View style={styles.bars}>
            {labels.map((label, i) => {
              const point = s.data.find((d) => d.label === label);
              const h = point ? Math.max(3, (point.value / max) * 60) : 0;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: h, backgroundColor: colorsBySeries[si] }]} />
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    flex: 1,
  },
  chartBlock: {
    marginBottom: spacing.md,
  },
  chartTitle: {
    color: colors.textMuted,
    fontSize: font.small,
    marginBottom: spacing.xs,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 64,
    gap: 2,
  },
  barCol: {
    flex: 1,
    height: 64,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  topRank: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: font.small,
  },
  topName: {
    flex: 1,
    color: colors.text,
    fontSize: font.body,
  },
  topQty: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  topRevenue: {
    color: colors.text,
    fontWeight: '700',
    fontSize: font.small,
  },
  line: {
    color: colors.textMuted,
    fontSize: font.body,
    marginBottom: spacing.xs,
  },
  strong: {
    color: colors.text,
    fontWeight: '700',
  },
  muted: {
    color: colors.textMuted,
    fontSize: font.body,
  },
});
