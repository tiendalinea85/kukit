import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb, seedDefaults } from './src/core/db/database';
import { logger } from './src/core/logging';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { colors } from './src/components/ui/theme';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const dbLogger = logger.child('db');
const appLogger = logger.child('app');

export default function App() {
  useEffect(() => {
    const handlers: { type: string; handler: (event: unknown) => void }[] = [
      {
        type: 'unhandledrejection',
        handler: (event) => {
          const reason = (event as { reason?: unknown }).reason;
          appLogger.error('Promesa no controlada', reason instanceof Error ? reason : undefined);
        },
      },
    ];

    for (const h of handlers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).addEventListener?.(h.type, h.handler as any);
    }

    getDb()
      .then(async () => {
        dbLogger.info('SQLite listo');
        await seedDefaults();
        dbLogger.info('Seed por defecto aplicado');
      })
      .catch((error) => {
        dbLogger.error('Error inicializando SQLite', error);
      });

    return () => {
      for (const h of handlers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).removeEventListener?.(h.type, h.handler as any);
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <NavigationContainer theme={theme}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
