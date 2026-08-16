import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from './supabase';
import { logger } from '../logging';

const authLogger = logger.child('auth');

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithOtp: (email: string) => Promise<string | null>;
  signUp: (email: string, password: string, name?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  supabase.auth.onAuthStateChange((event, session) => {
    const status = session ? 'authenticated' : 'unauthenticated';
    authLogger.info(`Cambio de sesión: ${event}`, {
      status,
      user_id: session?.user.id,
    });
    set({
      status,
      user: session?.user ?? null,
      session: session ?? null,
      initialized: true,
    });
  });

  return {
    status: 'loading',
    user: null,
    session: null,
    initialized: false,

    initialize: async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        set({
          status: 'authenticated',
          user: data.session.user,
          session: data.session,
          initialized: true,
        });
        return;
      }
      if (error) {
        authLogger.error('Error al recuperar sesión', error);
      }
      set({ status: 'unauthenticated', user: null, session: null, initialized: true });
    },

    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        authLogger.error('Error de inicio de sesión', error);
        return error.message;
      }
      authLogger.info('Sesión iniciada', { user_id: data.user?.id });
      return null;
    },

    signInWithOtp: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        authLogger.error('Error enviando OTP', error);
        return error.message;
      }
      authLogger.info('OTP enviado', { email });
      return null;
    },

    signUp: async (email, password, name) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name ?? '' } },
      });
      if (error) {
        authLogger.error('Error de registro', error);
        return error.message;
      }
      authLogger.info('Usuario registrado', { email });
      return null;
    },

    signOut: async () => {
      await supabase.auth.signOut();
      authLogger.info('Sesión cerrada');
      set({ status: 'unauthenticated', user: null, session: null });
    },
  };
});
