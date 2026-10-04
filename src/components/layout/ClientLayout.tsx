"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/stores/useAppStore";
import { startSyncEngine, stopSyncEngine, useSyncStore } from "@/lib/sync";
import { isSupabaseConfigured } from "@/lib/supabase";
import { registerPWA } from "@/lib/pwa";
import { Toaster, toast } from "react-hot-toast";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { WorkspaceGate } from "@/features/workspaces/components/WorkspaceGate";
import { useTranslation } from "@/hooks/useTranslation";

// El asistente solo se necesita cuando el usuario abre el micrófono. Importado
// estáticamente metía recharts (2 MB) en el grafo de módulos de TODAS las rutas,
// incluida /auth, que compilar 3000 módulos solo para pintar un login.
const VoiceAssistant = dynamic(
  () => import("@/components/voice/VoiceAssistant").then((m) => m.VoiceAssistant),
  { ssr: false }
);

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { setOnline, theme } = useAppStore();
  const { user, loading } = useAuth();
  const { t: _ } = useTranslation();
  const pathname = usePathname();

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // import() diferido: seed.ts arrastra las reglas de dominio de todas las
      // features y solo hace falta tras el primer montaje sin Supabase.
      void import("@/lib/seed").then((m) => m.seedIfEmpty());
      return;
    }
    startSyncEngine();
    return () => stopSyncEngine();
  }, []);

  useEffect(() => {
    registerPWA((apply) => {
      toast(
        (t) => (
          <div className="flex items-center gap-3">
            <span className="flex-1">{_("pwa.updateAvailable")}</span>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                apply();
              }}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 transition-colors"
            >
              {_("pwa.update")}
            </button>
          </div>
        ),
        { duration: Infinity }
      );
    });
  }, [_]);

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
          sin max-w-* ni mx-auto; en móvil padding normal con BottomNav.
          El padding lo impone .zane-main-area (globals.css). */}
      <main className="zane-main-area">
        <div className="w-full min-w-0">
          {children}
        </div>
      </main>

      {/* BottomNav: solo móvil (< 1024px), oculto en desktop (.zane-mobile-bottomnav). */}
      <BottomNav />
    </div>
  );

  return (
    <>
      {isAuthPage ? (
        <div className="min-h-screen bg-zinc-950">{children}</div>
      ) : (
        <WorkspaceGate>
          {appChrome}
          <VoiceAssistant />
        </WorkspaceGate>
      )}
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#18181b", color: "#f4f4f5", border: "1px solid #27272a", borderRadius: "12px" },
          duration: 3000,
        }}
      />
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