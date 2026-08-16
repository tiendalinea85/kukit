"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { onAuthStateChange, getCurrentUser, signOut as supabaseSignOut } from "@/lib/supabase";
import { clearLocalData } from "@/lib/db";

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

    const unsub = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
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
    const isAuthPage = pathname === "/auth";
    if (!user && !isAuthPage) {
      router.replace("/auth");
    } else if (user && isAuthPage) {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    await clearLocalData();
    localStorage.removeItem("zane-auth");
    localStorage.removeItem("zane-user");
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
