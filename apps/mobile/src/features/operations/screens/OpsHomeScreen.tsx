import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/ui/Card';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, radius, spacing } from '../../../components/ui/theme';
import type { OpsStackParamList } from '../../../navigation/types';
import { useModuleStore } from '../../../core/workspace/moduleRegistry';
import type { ModuleCode } from '../../../core/domain/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;

interface ModuleTile {
  key: keyof OpsStackParamList;
  icon: string;
  label: string;
  accent: string;
  moduleCode: ModuleCode;
}

const ALL_MODULES: ModuleTile[] = [
  { key: 'PurchaseList', icon: '🛒', label: 'Compras', accent: colors.info, moduleCode: 'purchases' },
  { key: 'ExpenseList', icon: '💸', label: 'Gastos', accent: colors.danger, moduleCode: 'expenses' },
  { key: 'InvestmentList', icon: '📈', label: 'Inversiones', accent: colors.warning, moduleCode: 'investments' },
  { key: 'InventoryList', icon: '📦', label: 'Inventario', accent: colors.success, moduleCode: 'inventory' },
  { key: 'ClientList', icon: '👥', label: 'Clientes', accent: colors.primary, moduleCode: 'customers' },
];

export function OpsHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { enabled, load } = useModuleStore();

  useEffect(() => {
    load();
  }, [load]);

  const go = navigation.navigate as unknown as (screen: keyof OpsStackParamList) => void;
  const visibleModules = ALL_MODULES.filter((m) => enabled.has(m.moduleCode));

  return (
    <Screen>
      <Card title="Módulos de registro" icon="🗂️">
        <Text style={styles.hint}>
          Compras, gastos e inversiones son conceptos separados. Elige uno para empezar a registrar.
        </Text>
      </Card>
      <View style={styles.grid}>
        {visibleModules.map((m) => (
          <Pressable
            key={m.key}
            style={[styles.tile, { borderColor: m.accent }]}
            onPress={() => go(m.key)}
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
