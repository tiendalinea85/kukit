import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../../core/auth/session';
import { useSyncStore } from '../../../core/sync/syncManager';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ListItem } from '../../../components/ui/ListItem';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, spacing } from '../../../components/ui/theme';
import type { HomeStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { user, signOut } = useAuthStore();
  const { status, lastSyncAt, pendingCount, runSync, refreshPending } = useSyncStore();

  async function handleSignOut() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <Screen>
      <Card title="Cuenta" icon="👤">
        <Text style={styles.email}>{user?.email}</Text>
      </Card>

      <Card title="Sincronización" icon="🔄">
        <Text style={styles.row}>
          Estado: <Text style={[styles.strong, { color: colors.success }]}>{status}</Text>
        </Text>
        <Text style={styles.row}>
          Pendientes: <Text style={styles.strong}>{pendingCount}</Text>
        </Text>
        <Text style={styles.row}>
          Última sync: <Text style={styles.strong}>{lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'nunca'}</Text>
        </Text>
        <Button
          title="Sincronizar ahora"
          onPress={() => {
            runSync();
            refreshPending();
          }}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card title="Información" icon="ℹ️">
        <ListItem title="Auditoría de acciones" subtitle="Historial de cambios locales" onPress={() => navigation.navigate('Audit')} />
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={handleSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: {
    color: colors.text,
    fontSize: font.body,
  },
  row: {
    color: colors.textMuted,
    fontSize: font.body,
    marginBottom: spacing.xs,
  },
  strong: {
    color: colors.text,
    fontWeight: '700',
  },
});
