"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    let code = url.searchParams.get("code");
    if (!code) {
      code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    }

    if (!code) {
      router.replace("/auth");
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      router.replace("/auth");
      return;
    }

    void sb.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        router.replace(error ? "/auth" : "/");
      })
      .catch(() => router.replace("/auth"));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Cargando...</p>
    </div>
  );
}