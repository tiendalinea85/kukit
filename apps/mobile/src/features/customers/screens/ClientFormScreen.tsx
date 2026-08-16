import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { defaultClientForm, getClient, saveClient } from '../repository';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import type { OpsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<OpsStackParamList>;
type Route = RouteProp<OpsStackParamList, 'ClientForm'>;

export function ClientFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [form, setForm] = useState(defaultClientForm());

  useEffect(() => {
    if (route.params?.id) {
      getClient(route.params.id).then((c) => {
        if (c) {
          setForm({
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            notes: c.notes,
          });
        }
      });
    }
  }, [route.params?.id]);

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Nombre requerido', 'El cliente necesita un nombre.');
      return;
    }
    await saveClient(form);
    navigation.goBack();
  }

  return (
    <Screen>
      <Input label="Nombre *" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      <Input label="Teléfono" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" />
      <Input label="Correo" value={form.email} onChangeText={(email) => setForm({ ...form, email })} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Dirección" value={form.address} onChangeText={(address) => setForm({ ...form, address })} />
      <Input label="Notas" value={form.notes} onChangeText={(notes) => setForm({ ...form, notes })} multiline />
      <Button title={route.params?.id ? 'Guardar cambios' : 'Crear cliente'} onPress={handleSave} />
    </Screen>
  );
}
