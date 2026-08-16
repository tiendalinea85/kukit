import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listExpenses } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import { formatMoney, formatDate } from '../../../core/utils/format';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

const STATUS_ICON: Record<string, string> = {
  activo: '🔵',
  pagado: '✅',
  pendiente: '⏳',
  cancelado: '🚫',
};

export function ExpenseListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading } = useLoad(listExpenses);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('ExpenseForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
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
            onPress={() => navigation.navigate('ExpenseForm', { id: e.id })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.md,
  },
  fab: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
});
