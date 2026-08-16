import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from './theme';

interface CardProps {
  title?: string;
  value?: string;
  icon?: string;
  children?: React.ReactNode;
  accent?: string;
}

export function Card({ title, value, icon, children, accent }: CardProps) {
  return (
    <View style={styles.card}>
      {title || value ? (
        <View style={styles.header}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {value ? <Text style={styles.value}>{value}</Text> : null}
        </View>
      ) : null}
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
});
