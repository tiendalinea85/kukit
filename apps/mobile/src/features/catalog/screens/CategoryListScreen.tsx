import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { deleteCategory, listCategories } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import type { CatalogStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<CatalogStackParamList>;

export function CategoryListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading, reload } = useLoad(listCategories);

  function confirmDelete(id: string) {
    Alert.alert('Eliminar categoría', '¿Eliminar esta categoría?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteCategory(id).then(reload) },
    ]);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('CategoryForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="🏷️" title="Sin categorías" description="Organiza tus productos por categorías." />
      ) : (
        data.map((c) => (
          <ListItem
            key={c.id}
            icon={c.icon}
            title={c.name}
            subtitle={`${c.product_count ?? 0} productos`}
            onPress={() => navigation.navigate('CategoryForm', { id: c.id })}
            right="✏️"
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
