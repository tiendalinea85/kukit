import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, radius, spacing } from '../../../components/ui/theme';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

const MODULES: { key: keyof OpsStackParamList; icon: string; label: string; accent: string }[] = [
  { key: 'PurchaseList', icon: '🛒', label: 'Compras', accent: colors.info },
  { key: 'ExpenseList', icon: '💸', label: 'Gastos', accent: colors.danger },
  { key: 'InvestmentList', icon: '📈', label: 'Inversiones', accent: colors.warning },
  { key: 'InventoryList', icon: '📦', label: 'Inventario', accent: colors.success },
  { key: 'ClientList', icon: '👥', label: 'Clientes', accent: colors.primary },
];

export function OpsHomeScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <Screen>
      <Card title="Módulos de registro" icon="🗂️">
        <Text style={styles.hint}>
          Compras, gastos e inversiones son conceptos separados. Elige uno para empezar a registrar.
        </Text>
      </Card>
      <View style={styles.grid}>
        {MODULES.map((m) => (
          <Pressable
            key={m.key}
            style={[styles.tile, { borderColor: m.accent }]}
            onPress={() => navigation.navigate(m.key)}
          >
            <Text style={styles.tileIcon}>{m.icon}</Text>
            <Text style={styles.tileLabel}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tile: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tileIcon: {
    fontSize: 30,
  },
  tileLabel: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '700',
  },
});
