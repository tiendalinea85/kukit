import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../../core/auth/session';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Screen } from '../../../components/ui/Screen';
import { colors, font, spacing } from '../../../components/ui/theme';

export function AuthScreen() {
  const { signIn, signUp, signInWithOtp, signOut } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email || !password) {
      Alert.alert('Campos requeridos', 'Ingresa correo y contraseña.');
      return;
    }
    setBusy(true);
    try {
      const error =
        mode === 'login' ? await signIn(email, password) : await signUp(email, password, name);
      if (error) Alert.alert('Error', error);
      else if (mode === 'signup') Alert.alert('Cuenta creada', 'Ya puedes iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll={false} padded>
      <View style={styles.wrap}>
        <Text style={styles.logo}>📒</Text>
        <Text style={styles.title}>CatoLedger</Text>
        <Text style={styles.subtitle}>
          Registro y control de tu negocio, sin conexión.
        </Text>

        <View style={styles.form}>
          {mode === 'signup' ? (
            <Input label="Nombre" value={name} onChangeText={setName} placeholder="Tu nombre" />
          ) : null}
          <Input
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="correo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secure
            autoCapitalize="none"
          />

          <Button
            title={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            onPress={submit}
            disabled={busy}
            style={styles.button}
          />
          <Button
            title={mode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
            onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}
            variant="ghost"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xxl * 2,
  },
  logo: {
    fontSize: 48,
    textAlign: 'center',
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  form: {
    marginTop: spacing.xxl,
  },
  button: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
});
