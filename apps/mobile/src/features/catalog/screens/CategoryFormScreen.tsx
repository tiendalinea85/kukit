import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { getCategory, saveCategory } from '../repository';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import type { CatalogStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<CatalogStackParamList>;
type Route = RouteProp<CatalogStackParamList, 'CategoryForm'>;

const COLORS = ['#8b5cf6', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899'];

export function CategoryFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState('📦');

  useEffect(() => {
    if (route.params?.id) {
      getCategory(route.params.id).then((c) => {
        if (c) {
          setName(c.name);
          setColor(c.color);
          setIcon(c.icon);
        }
      });
    }
  }, [route.params?.id]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'La categoría necesita un nombre.');
      return;
    }
    await saveCategory({ id: route.params?.id, name, color, icon });
    navigation.goBack();
  }

  return (
    <Screen>
      <Input label="Icono" value={icon} onChangeText={setIcon} placeholder="📦" />
      <Input label="Nombre *" value={name} onChangeText={setName} placeholder="Nombre de la categoría" />
      <Input label="Color (hex)" value={color} onChangeText={setColor} placeholder="#8b5cf6" autoCapitalize="characters" />
      <Button title={route.params?.id ? 'Guardar cambios' : 'Crear categoría'} onPress={handleSave} />
    </Screen>
  );
}
