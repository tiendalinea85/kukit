import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchExpenses, type ExpenseFilters } from '../repository';
import { listCategories } from '../../catalog/repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { Select } from '../../../components/ui/Select';
import { colors, radius, spacing } from '../../../components/ui/theme';
import { formatMoney, formatDate } from '../../../core/utils/format';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

const STATUS_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Activos', value: 'activo' },
  { label: 'Pagados', value: 'pagado' },
  { label: 'Pendientes', value: 'pendiente' },
  { label: 'Anulados', value: 'cancelado' },
];

const STATUS_ICON: Record<string, string> = {
  activo: '🔵',
  pagado: '✅',
  pendiente: '⏳',
  cancelado: '🚫',
};

export function ExpenseListScreen() {
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [filters, setFilters] = useState<ExpenseFilters>({});

  const { data: categories } = useLoad(listCategories);
  const { data, loading, reload } = useLoad(() => searchExpenses(filters));

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters({
        search: query.trim() || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query, status, categoryId]);

  const categoryOptions = [
    { label: 'Todas las categorías', value: '' },
    ...(categories ?? []).map((c) => ({ label: c.name, value: c.id })),
  ];

  return (
    <Screen>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput placeholder="Buscar gasto…" value={query} onChangeText={setQuery} style={styles.searchInput} placeholderTextColor={colors.textMuted} />
      </View>

      <View style={styles.chips}>
        {STATUS_FILTERS.map((s) => (
          <FilterChip
            key={s.value}
            label={s.label}
            active={status === s.value}
            onPress={() => setStatus(s.value)}
          />
        ))}
      </View>

      <View style={styles.filtersRow}>
        <Select
          options={categoryOptions}
          value={categoryId}
          onChange={setCategoryId}
        />
        <View style={styles.actionBtns}>
          <Pressable style={styles.reportBtn} onPress={() => navigation.navigate('ExpenseReport')}>
            <Ionicons name="stats-chart-outline" size={18} color={colors.primary} />
          </Pressable>
          <Pressable style={styles.fab} onPress={() => navigation.navigate('ExpenseForm')}>
            <Ionicons name="add" size={22} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="💸" title="Sin gastos" description="Registra tus gastos operativos." />
      ) : (
        data.map((e) => (
          <ListItem
            key={e.id}
            icon={STATUS_ICON[e.status] ?? '💸'}
            title={`${e.code} · ${e.name}`}
            subtitle={`${e.category_name ?? 'Sin categoría'} · ${formatDate(e.date)}`}
            right={formatMoney(e.total_amount)}
            onPress={() => navigation.navigate('ExpenseDetail', { id: e.id })}
          />
        ))
      )}
    </Screen>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reportBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  fab: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
});
