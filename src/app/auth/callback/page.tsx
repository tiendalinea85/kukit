"use client";
import { useEffect, useRef, useState } from "react";
import { getOAuthCode, getSupabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const exchangingRef = useRef(false);

  useEffect(() => {
    if (exchangingRef.current) return;
    exchangingRef.current = true;

    async function exchangeCode() {
      try {
        const code = getOAuthCode();
        if (!code) {
          setStatus("error");
          setErrorMsg("No se encontró el código de autorización en la URL.");
          return;
        }

        const sb = getSupabase();
        if (!sb) {
          setStatus("error");
          setErrorMsg("Supabase no está configurado.");
          return;
        }

        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("error");
          setErrorMsg(error.message);
          return;
        }

        // Limpia el código de la URL y navega a la home real de la app.
        window.history.replaceState({}, "", "/");
        window.location.href = "/";
      } catch (err) {
        console.error("[auth] callback error:", err);
        setStatus("error");
        setErrorMsg("No se pudo completar el inicio de sesión. Inténtalo de nuevo.");
      }
    }

    void exchangeCode();
  }, []);

  if (status === "loading") return <p>Procesando inicio de sesión…</p>;
  if (status === "error") return <p role="alert">Error: {errorMsg}</p>;
  return <p>Redirigiendo…</p>;
}