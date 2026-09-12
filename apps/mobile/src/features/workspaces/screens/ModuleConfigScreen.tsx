import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState, useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card } from '../../../components/ui/Card';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, radius, spacing } from '../../../components/ui/theme';
import type { HomeStackParamList } from '../../../navigation/types';
import type { ModuleCode } from '../../../core/domain/types';
import { MODULES } from '../../../core/workspace/modules';
import { listWorkspaceModules, toggleModule } from '../repository';
import { getActiveWorkspaceId } from '../../../core/workspace/activeWorkspace';
import { getDb } from '../../../core/db/database';
import { useModuleStore } from '../../../core/workspace/moduleRegistry';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'ModuleConfig'>;
type ScreenRoute = RouteProp<HomeStackParamList, 'ModuleConfig'>;

const TRANSVERSAL: ModuleCode[] = ['expenses', 'reports'];

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Módulos principales',
  specialized: 'Módulos especializados',
};

const CATEGORY_ICONS: Record<string, string> = {
  core: '⚡',
  specialized: '🧩',
};

interface ModuleItem {
  code: ModuleCode;
  name: string;
  description: string;
  category: string;
  active: boolean;
  isTransversal: boolean;
}

export function ModuleConfigScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<ScreenRoute>();
  const workspaceId = route.params?.workspaceId;
  const { load: reloadModuleStore } = useModuleStore();
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const loadModules = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    const db = await getDb();
    const wsId = workspaceId || (await getActiveWorkspaceId(db));
    if (!wsId) { setLoading(false); return; }

    const dbModules = await listWorkspaceModules(wsId);
    const activeSet = new Set(dbModules.filter((m) => m.status === 'active').map((m) => m.module_key));

    const items: ModuleItem[] = Object.values(MODULES).map((m) => ({
      code: m.code,
      name: m.name,
      description: m.description,
      category: m.category,
      active: activeSet.has(m.code),
      isTransversal: TRANSVERSAL.includes(m.code),
    }));

    items.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    setModules(items);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    loadModules();
  }, [loadModules]);

  const handleToggle = async (code: ModuleCode, currentActive: boolean) => {
    if (!workspaceId) return;
    const newStatus = currentActive ? 'disabled' : 'active';
    setSaving(code);
    try {
      await toggleModule(workspaceId, code, newStatus);
      await loadModules();
      await reloadModuleStore();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Error', msg);
    } finally {
      setSaving(null);
    }
  };

  const grouped = modules.reduce<Record<string, ModuleItem[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {});

  return (
    <Screen>
      {loading ? (
        <Text style={styles.loadingText}>Cargando módulos…</Text>
      ) : (
        <>
          <Card title="Configuración de módulos" icon="🧩">
            <Text style={styles.hint}>
              Activa o desactiva los módulos según las necesidades de tu workspace.
              Los módulos transversales (gastos, reportes) siempre están activos.
            </Text>
          </Card>

          {Object.entries(grouped).map(([category, items]) => (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[category] ?? '📦'}</Text>
                <Text style={styles.categoryTitle}>{CATEGORY_LABELS[category] ?? category}</Text>
                <Text style={styles.categoryCount}>
                  {items.filter((m) => m.active).length}/{items.length}
                </Text>
              </View>

              {items.map((m) => (
                <Pressable
                  key={m.code}
                  style={styles.moduleRow}
                  onPress={() => !m.isTransversal && handleToggle(m.code, m.active)}
                  disabled={m.isTransversal || saving === m.code}
                >
                  <View style={styles.moduleInfo}>
                    <Text style={[styles.moduleName, m.active && styles.moduleNameActive]}>
                      {m.name}
                    </Text>
                    <Text style={styles.moduleDesc} numberOfLines={1}>
                      {m.description}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.toggle,
                      m.active ? styles.toggleOn : styles.toggleOff,
                      m.isTransversal && styles.toggleDisabled,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        m.active ? styles.toggleThumbOn : styles.toggleThumbOff,
                      ]}
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  hint: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  categoryIcon: {
    fontSize: 16,
  },
  categoryTitle: {
    flex: 1,
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryCount: {
    color: colors.primary,
    fontSize: font.caption,
    fontWeight: '700',
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  moduleInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  moduleName: {
    color: colors.textMuted,
    fontSize: font.body,
    fontWeight: '600',
  },
  moduleNameActive: {
    color: colors.text,
  },
  moduleDesc: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: colors.success,
  },
  toggleOff: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleThumbOff: {
    alignSelf: 'flex-start',
  },
});
