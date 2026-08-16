import type { ReactNode } from 'react';
import { Component, type ErrorInfo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppError, errorMessage } from '../core/errors';
import { logger } from '../core/logging';
import { colors, font, radius, spacing } from './ui/theme';

interface State {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: errorMessage(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('Error de renderizado no controlado', AppError.from(error), {
      componentStack: info.componentStack,
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.title}>Algo salió mal</Text>
        <Text style={styles.message}>{this.state.message}</Text>
        <Pressable style={styles.button} onPress={this.handleReset}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  icon: {
    fontSize: 44,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: font.heading,
    fontWeight: '800',
  },
  message: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '700',
  },
});
