import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listAudit } from '../repository';
import { useLoad } from '../../../hooks/useLoad';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, spacing } from '../../../components/ui/theme';
import type { AuditEntry } from '../../../core/domain/types';

export function AuditScreen() {
  const { data, loading } = useLoad(listAudit);

  return (
    <Screen>
      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.primary} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon="🔍" title="Sin registros" description="Las acciones locales se auditan aquí." />
      ) : (
        data.map((entry: AuditEntry) => (
          <Card key={entry.id}>
            <View style={styles.row}>
              <Text style={styles.action}>{entry.action}</Text>
              <Text style={styles.time}>
                {new Date(entry.created_at).toLocaleString()}
              </Text>
            </View>
            <Text style={styles.meta}>
              {entry.entity_type} · {entry.entity_id.slice(0, 8)}…
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  action: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '700',
  },
  time: {
    color: colors.textMuted,
    fontSize: font.small,
  },
  meta: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: spacing.xs,
  },
});
