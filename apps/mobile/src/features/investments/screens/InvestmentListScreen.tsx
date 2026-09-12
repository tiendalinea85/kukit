import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { listInvestments } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import { formatMoney, formatDate } from '../../../core/utils/format';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

const TYPE_ICON: Record<string, string> = {
  activo: '🏦',
  ahorro: '💰',
  crypto: '🪙',
  inmobiliaria: '🏠',
  otro: '📈',
};

const CATEGORY_ICON: Record<string, string> = {
  Maquinaria: '⚙️',
  Herramienta: '🔧',
  Computadora: '💻',
  Equipamiento: '📦',
  Mobiliario: '🪑',
  Transporte: '🚛',
};

export function InvestmentListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, loading } = useLoad(listInvestments);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.fab} onPress={() => navigation.navigate('InvestmentForm')}>
          <Ionicons name="add" size={22} color={colors.white} />
        </Pressable>
      </View>

      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="📈" title="Sin inversiones" description="Registra tus inversiones." />
      ) : (
        data.map((i) => (
          <ListItem
            key={i.id}
            icon={CATEGORY_ICON[i.category] ?? TYPE_ICON[i.asset_type] ?? '📈'}
            title={`${i.code} · ${i.asset_name}`}
            subtitle={`${i.category ? `${i.category} · ` : ''}${formatDate(i.date)}${i.supplier ? ` · ${i.supplier}` : ''}`}
            right={formatMoney(i.current_value)}
            onPress={() => navigation.navigate('InvestmentForm', { id: i.id })}
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
