import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert } from 'react-native';
import { registerMovement } from '../repository';
import { listProducts } from '../../catalog/repository';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { Select } from '../../../components/ui/Select';
import { useLoad } from '../../../hooks/useLoad';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;
type Route = RouteProp<OpsStackParamList, 'MovementForm'>;

export function MovementFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { data: products } = useLoad(listProducts);

  const [productId, setProductId] = useState<string | null>(route.params?.productId ?? null);
  const [movementType, setMovementType] = useState<'entrada' | 'salida' | 'ajuste'>('entrada');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  async function handleSave() {
    if (!productId) {
      Alert.alert('Producto requerido', 'Selecciona un producto.');
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      Alert.alert('Cantidad inválida', 'Ingresa una cantidad mayor a cero.');
      return;
    }
    await registerMovement({
      product_id: productId,
      movement_type: movementType,
      quantity: qty,
      notes,
    });
    navigation.goBack();
  }

  return (
    <Screen>
      <Select
        label="Producto"
        options={(products ?? []).map((p) => ({ label: `${p.name} (stock ${p.stock})`, value: p.id }))}
        value={productId}
        onChange={setProductId}
      />
      <Select
        label="Tipo de movimiento"
        options={[
          { label: 'Entrada', value: 'entrada' },
          { label: 'Salida', value: 'salida' },
          { label: 'Ajuste (fija el stock)', value: 'ajuste' },
        ]}
        value={movementType}
        onChange={(v) => setMovementType(v as typeof movementType)}
      />
      <Input
        label={movementType === 'ajuste' ? 'Nuevo stock' : 'Cantidad'}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
      />
      <Input label="Notas" value={notes} onChangeText={setNotes} multiline />

      <Button title="Registrar movimiento" onPress={handleSave} />
    </Screen>
  );
}
