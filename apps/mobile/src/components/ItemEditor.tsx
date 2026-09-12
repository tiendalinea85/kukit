import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from './ui/theme';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

export interface LineItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount?: number;
}

interface ItemEditorProps {
  items: LineItem[];
  products: { id: string; name: string; sale_price?: number; cost_price?: number }[];
  onChange: (items: LineItem[]) => void;
  withDiscount?: boolean;
  priceField?: 'sale' | 'cost';
  onAdd?: () => void;
  editable?: boolean;
}

export function ItemEditor({ items, products, onChange, withDiscount = false, priceField = 'sale', onAdd, editable = true }: ItemEditorProps) {
  const productOptions = products.map((p) => ({ label: p.name, value: p.id }));

  function updateLine(index: number, patch: Partial<LineItem>) {
    const next = items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange(next);
  }

  function addLine() {
    const next = [...items, { product_id: null, product_name: '', quantity: 1, unit_price: 0, discount: 0 }];
    onChange(next);
  }

  function removeLine(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function pickProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    const price = priceField === 'sale' ? product?.sale_price ?? 0 : product?.cost_price ?? 0;
    updateLine(index, {
      product_id: productId,
      product_name: product?.name ?? '',
      unit_price: price,
    });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Líneas</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.line}>
          <View style={styles.lineHeader}>
            <Text style={styles.lineNum}>#{index + 1}</Text>
            <Pressable onPress={() => editable && removeLine(index)} style={styles.remove}>
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
          <Select
            label="Producto"
            options={productOptions}
            value={item.product_id}
            onChange={(v) => pickProduct(index, v)}
            editable={editable}
          />
          {item.product_id === null ? (
            <Input
              label="Nombre (producto libre)"
              value={item.product_name}
              onChangeText={(product_name) => updateLine(index, { product_name })}
              editable={editable}
            />
          ) : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Input
                label="Cantidad"
                value={String(item.quantity)}
                onChangeText={(t) => updateLine(index, { quantity: parseFloat(t || '0') })}
                keyboardType="decimal-pad"
                editable={editable}
              />
            </View>
            <View style={styles.flex}>
              <Input
                label="Precio unitario (S/)"
                value={item.unit_price ? String(item.unit_price / 100) : ''}
                onChangeText={(t) => updateLine(index, { unit_price: Math.round(parseFloat(t || '0') * 100) })}
                keyboardType="decimal-pad"
                editable={editable}
              />
            </View>
          </View>
          {withDiscount ? (
            <Input
              label="Descuento (S/)"
              value={item.discount ? String(item.discount / 100) : ''}
              onChangeText={(t) => updateLine(index, { discount: Math.round(parseFloat(t || '0') * 100) })}
              keyboardType="decimal-pad"
              editable={editable}
            />
          ) : null}
        </View>
      ))}

      <Pressable style={[styles.add, !editable && styles.addDisabled]} onPress={editable ? (onAdd ?? addLine) : undefined}>
        <Text style={styles.addText}>+ Agregar línea</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  line: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  lineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  lineNum: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  remove: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  removeText: {
    color: colors.danger,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  add: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  addDisabled: {
    opacity: 0.5,
  },
  addText: {
    color: colors.primary,
    fontWeight: '700',
  },
});
