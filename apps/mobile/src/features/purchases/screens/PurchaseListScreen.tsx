import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listPurchases } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import { formatMoney, formatDate } from '../../../core/utils/format';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

export function PurchaseListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading } = useLoad(listPurchases);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('PurchaseForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="🛒" title="Sin compras" description="Registra compras a proveedores." />
      ) : (
        data.map((p) => (
          <ListItem
            key={p.id}
            icon={p.status === 'recibida' ? '📥' : p.status === 'cancelada' ? '🚫' : '⏳'}
            title={`${p.code} · ${p.supplier || 'Proveedor'}`}
            subtitle={`${formatDate(p.date)} · ${p.invoice ? `F: ${p.invoice} · ` : ''}${p.items_count} item(s)`}
            right={formatMoney(p.total_amount)}
            onPress={() => navigation.navigate('PurchaseForm', { id: p.id })}
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
