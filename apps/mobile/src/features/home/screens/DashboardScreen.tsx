import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../../core/auth/session';
import { useSyncStore } from '../../../core/sync/syncManager';
import { dashboardSummary, type DashboardSummary as Summary } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { Card } from '../../../components/ui/Card';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, radius, spacing } from '../../../components/ui/theme';
import { formatMoney } from '../../../core/utils/format';
import type { HomeStackParamList } from '../../../navigation/types';
import { useModuleStore, visibleQuickLinks, visibleDashboardCards } from '../../../core/workspace/moduleRegistry';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

const CARD_CONFIG: Record<string, { title: string; icon: string; key: keyof Summary; accent: string }> = {
  'Ventas':    { title: 'Ventas',    icon: '💰', key: 'total_sales',    accent: colors.success },
  'Gastos':    { title: 'Gastos',    icon: '💸', key: 'total_expenses', accent: colors.danger },
  'Compras':   { title: 'Compras',   icon: '📦', key: 'total_purchases', accent: colors.info },
  'Invertido': { title: 'Invertido', icon: '📈', key: 'total_invested', accent: colors.warning },
};

const QUICK_LINK_ICONS: Record<string, string> = {
  'Nueva venta': '➕',
  'Productos': '📦',
  'Nuevo gasto': '💸',
  'Reportes': '📊',
};

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuthStore();
  const sync = useSyncStore();
  const { data, reload } = useLoad<Summary>(dashboardSummary);
  const { enabled, load: loadModules } = useModuleStore();

  useEffect(() => {
    loadModules();
    sync.runSync().catch(() => undefined);
    const timer = setInterval(() => sync.runSync().catch(() => undefined), 60000);
    return () => clearInterval(timer);
  }, []);

  const syncLabel =
    sync.status === 'syncing'
      ? 'Sincronizando…'
      : sync.status === 'offline'
        ? 'Sin conexión'
        : sync.status === 'error'
          ? 'Error de sincronización'
          : sync.lastSyncAt
            ? `Sincronizado ${new Date(sync.lastSyncAt).toLocaleTimeString()}`
            : 'Sincronizar';

  const syncColor =
    sync.status === 'synced' || sync.status === 'idle'
      ? colors.success
      : sync.status === 'error' || sync.status === 'offline'
        ? colors.danger
        : colors.warning;

  const goTab = (name: string) => {
    const parent = navigation.getParent() as unknown as
      | { navigate: (screen: string) => void }
      | undefined;
    parent?.navigate(name);
  };

  const goQuickLink = (label: string) => {
    const tabMap: Record<string, string> = {
      'Nueva venta': 'Ventas',
      'Productos': 'Catalogo',
      'Nuevo gasto': 'Operaciones',
      'Reportes': 'Reportes',
    };
    goTab(tabMap[label] ?? 'Operaciones');
  };

  const visibleCards = visibleDashboardCards(enabled);
  const quickLinks = visibleQuickLinks(enabled);

  return (
    <Screen scroll={false} padded>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hola, {user?.email?.split('@')[0] ?? 'usuario'}</Text>
          <Text style={styles.sub}>Tu negocio al día</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <Pressable
        style={styles.syncRow}
        onPress={() => {
          sync.runSync().catch(() => undefined);
          reload();
        }}
      >
        <Ionicons
          name={sync.status === 'syncing' ? 'sync' : 'cloud-done-outline'}
          size={16}
          color={syncColor}
        />
        <Text style={[styles.syncText, { color: syncColor }]}>{syncLabel}</Text>
        {sync.pendingCount > 0 ? (
          <Text style={styles.syncPending}>{sync.pendingCount} pendientes</Text>
        ) : null}
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        {!data ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : (
          <>
            <View style={styles.grid}>
              {visibleCards.map((cardName) => {
                const cfg = CARD_CONFIG[cardName];
                if (!cfg) return null;
                return (
                  <Card
                    key={cardName}
                    title={cfg.title}
                    icon={cfg.icon}
                    value={formatMoney(data[cfg.key] as number)}
                    accent={cfg.accent}
                  />
                );
              })}
            </View>

            <Card title="Resumen del negocio" icon="📊">
              {enabled.has('products') && (
                <>
                  <Text style={styles.statLine}>Productos activos: <Text style={styles.statStrong}>{data.product_count}</Text></Text>
                  <Text style={styles.statLine}>Stock bajo: <Text style={[styles.statStrong, { color: colors.danger }]}>{data.low_stock_count}</Text></Text>
                </>
              )}
              {enabled.has('sales') && (
                <Text style={styles.statLine}>Operaciones de venta: <Text style={styles.statStrong}>{data.sales_count}</Text></Text>
              )}
              {enabled.has('expenses') && (
                <Text style={styles.statLine}>Gastos registrados: <Text style={styles.statStrong}>{data.expenses_count}</Text></Text>
              )}
            </Card>

            {quickLinks.length > 0 && (
              <Card title="Accesos rápidos" icon="⚡">
                <View style={styles.quickGrid}>
                  {quickLinks.map((ql) => (
                    <QuickLink
                      key={ql.label}
                      icon={QUICK_LINK_ICONS[ql.label] ?? '•'}
                      label={ql.label}
                      onPress={() => goQuickLink(ql.label)}
                    />
                  ))}
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function QuickLink({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quick} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    color: colors.text,
    fontSize: font.heading,
    fontWeight: '800',
  },
  sub: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
  },
  iconBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  syncText: {
    fontSize: font.small,
    fontWeight: '600',
    flex: 1,
  },
  syncPending: {
    fontSize: font.small,
    color: colors.warning,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  loading: {
    marginTop: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statLine: {
    color: colors.textMuted,
    fontSize: font.body,
    marginBottom: spacing.xs,
  },
  statStrong: {
    color: colors.text,
    fontWeight: '700',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickIcon: {
    fontSize: 18,
  },
  quickLabel: {
    color: colors.text,
    fontSize: font.small,
    fontWeight: '600',
  },
});
