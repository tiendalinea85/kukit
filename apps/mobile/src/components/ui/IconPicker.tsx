import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  filterCategoryIconGroups,
  type CategoryIconGroup,
} from '../../features/catalog/domain/categoryIcon';
import { CategoryIcon } from './CategoryIcon';
import { colors, radius, spacing } from './theme';

// Selector de iconos de categoría: buscador + grupos, en la misma hoja que usa
// <Select>. El emoji elegido es un texto corto; una imagen (data URL) la pone la
// PWA y aquí solo se muestra, no se edita.

interface IconPickerProps {
  label?: string;
  /** Icono actual. Puede ser un emoji o un data URL. */
  value: string | undefined;
  onChange: (value: string) => void;
  editable?: boolean;
}

type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'icons'; key: string; icons: readonly string[] };

export function IconPicker({ label, value, onChange, editable = true }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const rows = useMemo<Row[]>(() => {
    const groups: readonly CategoryIconGroup[] = filterCategoryIconGroups(query);
    const out: Row[] = [];
    for (const g of groups) {
      out.push({ kind: 'header', key: `h:${g.label}`, label: g.label });
      out.push({ kind: 'icons', key: `i:${g.label}`, icons: g.icons });
    }
    return out;
  }, [query]);

  const notFound = rows.length === 0;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        style={[styles.field, !editable && styles.fieldDisabled]}
        onPress={() => editable && setOpen(true)}
        disabled={!editable}
      >
        <View style={styles.preview}>
          <CategoryIcon icon={value} size={26} />
        </View>
        <Text style={[styles.fieldHint, !editable && styles.valueDisabled]} numberOfLines={1}>
          {value ? 'Toca para cambiar el icono' : 'Toca para elegir un icono'}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label ?? 'Icono'}</Text>

            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar: tractor, dinero, tela…"
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
            />

            {notFound ? (
              <Text style={styles.empty}>Sin resultados para «{query.trim()}»</Text>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(r) => r.key}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) =>
                  item.kind === 'header' ? (
                    <Text style={styles.groupHeader}>{item.label}</Text>
                  ) : (
                    <View style={styles.grid}>
                      {item.icons.map((icon) => {
                        const active = icon === value;
                        return (
                          <Pressable
                            key={icon}
                            style={[styles.cell, active && styles.cellActive]}
                            onPress={() => {
                              onChange(icon);
                              setOpen(false);
                            }}
                            accessibilityLabel={`Icono ${icon}`}
                            accessibilityState={{ selected: active }}
                          >
                            <Text style={styles.cellIcon} allowFontScaling={false}>
                              {icon}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )
                }
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const CELL = 44;

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  field: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  preview: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldHint: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  valueDisabled: {
    color: colors.textMuted,
  },
  caret: {
    color: colors.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  search: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
  groupHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  cellIcon: {
    fontSize: 22,
  },
});