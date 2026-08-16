import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listSales } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import { formatMoney } from '../../../core/utils/format';
import type { SalesStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<SalesStackParamList>;

export function SaleListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading } = useLoad(listSales);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('SaleForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Sin ventas"
          description="Registra la primera operación de venta."
        />
      ) : (
        data.map((s) => (
          <ListItem
            key={s.id}
            icon={s.status === 'completada' ? '✅' : s.status === 'cancelada' ? '🚫' : '📝'}
            title={`${s.code} · ${s.items_count} item(s)`}
            subtitle={`${s.client_name ?? 'Sin cliente'} · ${new Date(s.date + 'T' + (s.time || '00:00:00')).toLocaleDateString()}`}
            right={formatMoney(s.total_amount)}
            onPress={() => navigation.navigate('SaleForm', { id: s.id })}
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
