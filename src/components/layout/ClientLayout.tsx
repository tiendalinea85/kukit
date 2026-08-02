"use client";
import { useEffect, useCallback } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/stores/useAppStore";
import { syncAllToSupabase, pullFromSupabase } from "@/lib/sync-supabase";
import { isSupabaseConfigured } from "@/lib/supabase";
import { seedIfEmpty } from "@/lib/seed";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { VoiceAssistant } from "@/components/voice/VoiceAssistant";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { setOnline, theme } = useAppStore();
  const { loading } = useAuth();

  const syncWithBackend = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await syncAllToSupabase();
      await pullFromSupabase();
    }
  }, []);

  useEffect(() => {
    seedIfEmpty();
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    if (navigator.onLine) syncWithBackend();
    const interval = setInterval(() => {
      if (navigator.onLine) syncWithBackend();
    }, 30000);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      clearInterval(interval);
    };
  }, [setOnline, syncWithBackend]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" /></div>;

  const isAuthPage = typeof window !== "undefined" && window.location.pathname === "/auth";

  return (
    <>
      {isAuthPage ? (
        <div className="min-h-screen bg-zinc-950">{children}</div>
      ) : (
        <div className="min-h-screen bg-zinc-950">
          <TopBar />
          <Sidebar />
          <main className="pt-[68px] pb-24 max-w-lg mx-auto px-4">
            {children}
          </main>
          <BottomNav />
        </div>
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
