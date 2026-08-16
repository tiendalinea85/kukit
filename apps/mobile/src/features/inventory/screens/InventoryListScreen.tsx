import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listProducts } from '../../catalog/repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

export function InventoryListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading } = useLoad(listProducts);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('MovementForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="📦" title="Sin productos" description="Crea productos para gestionar stock." />
      ) : (
        data.map((p) => (
          <ListItem
            key={p.id}
            icon={p.stock <= p.min_stock ? '⚠️' : p.stock > 0 ? '📦' : '🚫'}
            title={p.name}
            subtitle={`Mínimo ${p.min_stock} · Precio costo ${p.cost_price}`}
            right={`${p.stock} ${p.unit}`}
            onPress={() => navigation.navigate('MovementForm', { productId: p.id })}
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
