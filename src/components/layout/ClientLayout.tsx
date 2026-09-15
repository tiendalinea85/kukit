"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/stores/useAppStore";
import { startSyncEngine, stopSyncEngine, useSyncStore } from "@/lib/sync";
import { isSupabaseConfigured } from "@/lib/supabase";
import { seedIfEmpty } from "@/lib/seed";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { VoiceAssistant } from "@/components/voice/VoiceAssistant";
import { WorkspaceGate } from "@/features/workspaces/components/WorkspaceGate";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { setOnline, theme } = useAppStore();
  const { user, loading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      seedIfEmpty();
      return;
    }
    startSyncEngine();
    return () => stopSyncEngine();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin SW el offline parcial sigue funcionando vía cache HTTP */
      });
    }
  }, []);

  useEffect(() => {
    const unsub = useSyncStore.subscribe((state) => setOnline(state.online));
    return unsub;
  }, [setOnline]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /></div>;

  const isAuthPage = pathname?.startsWith("/auth") ?? false;
  const configured = isSupabaseConfigured();

  // Sin sesión: si Supabase está configurado y NO estamos en el login,
  // NO montar el panel de la app (AuthProvider redirige a /auth en un efecto).
  // Evita ver login + panel superpuestos antes de ingresar.
  if (configured && !user && !isAuthPage) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const appChrome = (
    <div className="min-h-screen w-full bg-zinc-950 overflow-x-hidden">
      <TopBar />
      <Sidebar />

      {/* En desktop el contenido ocupa TODO el ancho tras el sidebar (256px),
          sin max-w-* ni mx-auto. En móvil padding normal con BottomNav. */}
      <main className="min-h-screen w-full pt-[68px] pb-24 px-4 md:pb-8 md:pl-[272px] md:pr-6">
        <div className="w-full min-w-0">
          {children}
        </div>
      </main>

      {/* BottomNav: solo móvil (md:hidden), oculto en desktop/tablet. */}
      <BottomNav />
    </div>
  );

  return (
    <>
      {isAuthPage ? (
        <div className="min-h-screen bg-zinc-950">{children}</div>
      ) : (
        <WorkspaceGate>{appChrome}</WorkspaceGate>
      )}
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#18181b", color: "#f4f4f5", border: "1px solid #27272a", borderRadius: "12px" },
          duration: 3000,
        }}
      />
      <VoiceAssistant />
    </>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LayoutInner>{children}</LayoutInner>
    </AuthProvider>
  );
}