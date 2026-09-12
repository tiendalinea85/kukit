import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getDb, seedDefaults } from './src/core/db/database';
import { logger } from './src/core/logging';
import { startConnectivityMonitoring } from './src/core/network/connectivity';
import { useSyncStore } from './src/core/sync/syncManager';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { ErrorBanner } from './src/components/ui/ErrorBanner';
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

    const stopConnectivity = startConnectivityMonitoring((online) => {
      if (online) {
        void useSyncStore.getState().runSync();
      } else {
        useSyncStore.setState({ status: 'offline' });
      }
    });

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
      stopConnectivity();
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
          <ErrorBanner />
        </NavigationContainer>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
