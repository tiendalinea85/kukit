import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { getCategory, saveCategory } from '../repository';
import {
  DEFAULT_CATEGORY_ICON,
  isDataUrlIcon,
  normalizeCategoryIcon,
} from '../domain/categoryIcon';
import { Button } from '../../../components/ui/Button';
import { CategoryIcon } from '../../../components/ui/CategoryIcon';
import { IconPicker } from '../../../components/ui/IconPicker';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { colors, radius, spacing } from '../../../components/ui/theme';
import type { CatalogStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<CatalogStackParamList>;
type Route = RouteProp<CatalogStackParamList, 'CategoryForm'>;

const COLORS = ['#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899'];

export function CategoryFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState<string>(DEFAULT_CATEGORY_ICON);

  useEffect(() => {
    if (route.params?.id) {
      getCategory(route.params.id).then((c) => {
        if (c) {
          setName(c.name);
          setColor(c.color);
          // normalizeCategoryIcon conserva un data URL y evita meter basura en
          // el estado: el selector solo trabaja con emojis.
          setIcon(normalizeCategoryIcon(c.icon));
        }
      });
    }
  }, [route.params?.id]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'La categoría necesita un nombre.');
      return;
    }
    await saveCategory({
      id: route.params?.id,
      name: name.trim(),
      color,
      icon: normalizeCategoryIcon(icon),
    });
    navigation.goBack();
  }

  const customImage = isDataUrlIcon(icon);

  return (
    <Screen>
      <View style={styles.previewRow}>
        <View style={styles.previewBox}>
          <CategoryIcon icon={icon} size={34} />
        </View>
        <View style={styles.previewText}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {name.trim() || 'Nueva categoría'}
          </Text>
          <Text style={styles.previewHint}>
            {customImage ? 'Icono propio (subido en la PWA)' : 'Así se verá en las listas'}
          </Text>
        </View>
      </View>

      <IconPicker label="Icono" value={icon} onChange={setIcon} />
      <Input label="Nombre *" value={name} onChangeText={setName} placeholder="Nombre de la categoría" />
      <Input label="Color (hex)" value={color} onChangeText={setColor} placeholder="#8b5cf6" autoCapitalize="characters" />
      <Button title={route.params?.id ? 'Guardar cambios' : 'Crear categoría'} onPress={handleSave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  previewBox: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    flex: 1,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  previewHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});