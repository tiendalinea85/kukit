import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listClients } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

export function ClientListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading } = useLoad(listClients);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('ClientForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="👥" title="Sin clientes" description="Registra a tus clientes." />
      ) : (
        data.map((c) => (
          <ListItem
            key={c.id}
            icon="👤"
            title={c.name}
            subtitle={c.phone || c.email || 'Sin contacto'}
            right={c.code}
            onPress={() => navigation.navigate('ClientForm', { id: c.id })}
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
