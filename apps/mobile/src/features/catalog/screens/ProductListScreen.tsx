import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listProducts } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import { formatMoney } from '../../../core/utils/format';
import type { CatalogStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<CatalogStackParamList>;

export function ProductListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading } = useLoad(listProducts);

  return (
    <Screen>
      <View style={styles.actions}>
        <Pressable style={styles.smallBtn} onPress={() => navigation.navigate('CategoryList')}>
          <Ionicons name="folder-open-outline" size={16} color={colors.text} />
          <Ionicons name="add" size={16} color={colors.primary} />
        </Pressable>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('ProductForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Sin productos"
          description="Agrega tu primer producto para empezar."
        />
      ) : (
        data.map((p) => (
          <ListItem
            key={p.id}
            icon={p.stock <= p.min_stock ? '⚠️' : '📦'}
            title={p.name}
            subtitle={`Stock: ${p.stock} ${p.unit} · Precio: ${formatMoney(p.sale_price)}`}
            right={p.code}
            onPress={() => navigation.navigate('ProductForm', { id: p.id })}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  smallBtn: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
