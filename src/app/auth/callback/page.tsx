"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, getOAuthCode } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const code = getOAuthCode();

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