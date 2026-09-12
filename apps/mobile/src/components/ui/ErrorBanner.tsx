import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useErrorBus } from '../../core/errors/errorBus';
import { colors, font, radius, spacing } from './theme';

export function ErrorBanner() {
  const current = useErrorBus((s) => s.current);
  const clear = useErrorBus((s) => s.clear);
  const insets = useSafeAreaInsets();

  if (!current) return null;

  return (
    <Pressable
      style={[styles.banner, { top: insets.top + spacing.sm }]}
      onPress={clear}
      accessibilityRole="button"
      accessibilityLabel="Cerrar error"
    >
      <Text style={styles.icon}>⚠️</Text>
      <View style={styles.body}>
        <Text style={styles.title}>Error</Text>
        <Text style={styles.message} numberOfLines={2}>
          {current.message}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  icon: {
    fontSize: font.heading,
    marginRight: spacing.sm,
  },
  body: {
    flex: 1,
  },
  title: {
    color: colors.white,
    fontSize: font.small,
    fontWeight: '800',
  },
  message: {
    color: colors.white,
    fontSize: font.small,
    marginTop: 1,
  },
});
