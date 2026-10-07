"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { onAuthStateChange, getCurrentUser, signOut as supabaseSignOut } from "@/lib/supabase";
import { clearLocalData } from "@/lib/db";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { markRecoveryPending, clearRecoveryPending, isRecoveryPending, shouldForceReset } from "@/lib/recoveryGuard";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        localStorage.setItem("zane-auth", "true");
      } else {
        const raw = localStorage.getItem("zane-user");
        if (raw) {
          try { setUser(JSON.parse(raw)); } catch { localStorage.removeItem("zane-user"); }
        } else {
          localStorage.removeItem("zane-auth");
        }
      }
      setLoading(false);
    });

    const unsub = onAuthStateChange((u, event) => {
      setUser(u);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        // Sesión creada por el link de recuperación: no vale para navegar la
        // app hasta que se cambie la contraseña.
        markRecoveryPending();
      }
      if (u) {
        localStorage.setItem("zane-auth", "true");
      } else {
        const mock = localStorage.getItem("zane-user");
        if (!mock) {
          localStorage.removeItem("zane-auth");
        }
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (loading) return;
    const pending = isRecoveryPending();
    // Cierre de seguridad: con recovery pendiente, cualquier ruta fuera de /auth
    // (incluida la home a la que supabase-js redirige tras crear la sesión)
    // vuelve al formulario de nueva contraseña.
    if (shouldForceReset(pathname, pending)) {
      router.replace("/auth/reset");
      return;
    }
    // Prefijo, no igualdad: /auth/reset y /auth/callback manejan su propia
    // navegación y no deben ser expulsados ni redirigidos a "/" a mitad de flujo.
    const isAuthPage = pathname === "/auth" || (pathname?.startsWith("/auth/") ?? false);
    const isSelfManaged = pathname === "/auth/reset" || pathname === "/auth/callback";
    if (!user && !isAuthPage) {
      router.replace("/auth");
    } else if (user && isAuthPage && !isSelfManaged && !pending) {
      // Con recovery pendiente el usuario se queda en /auth (puede pedir el link
      // de nuevo o volver); no se le manda a la app sin cambiar la contraseña.
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    await clearLocalData();
    useWorkspaceStore.getState().resetWorkspaces();
    localStorage.removeItem("zane-workspaces");
    localStorage.removeItem("zane-auth");
    localStorage.removeItem("zane-user");
    clearRecoveryPending();
    router.replace("/auth");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
