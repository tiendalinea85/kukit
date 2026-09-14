"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UserPlus, LogIn, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import toast from "react-hot-toast";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  resetPassword,
  isSupabaseConfigured,
} from "@/lib/supabase";

type Mode = "login" | "register" | "reset";

// Validación previa antes de tocar la API: evita que correos inválidos
// disparen el rate limit (429) de Supabase en /auth/v1/signup.
function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  const [local, domain] = trimmed.split("@");
  if (/^\.|\.$/.test(local)) return false;
  if (/^\.|\.$|\.\./.test(domain)) return false;
  return true;
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function AuthPage() {
  const { t: _ } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const submittingRef = useRef(false);
  const lastSubmitAtRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  const demo = !isSupabaseConfigured() && process.env.NODE_ENV !== "production";

  // Cuenta atrás del cooldown tras un 429 (rate limit de Supabase). Al llegar
  // a 0 se vuelve a habilitar el botón sin recargar la página.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      const left = Math.ceil((cooldownUntilRef.current - Date.now()) / 1000);
      setCooldownLeft(left <= 0 ? 0 : left);
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft > 0]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setNotice("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      toast.error(_("auth.invalidEmail"));
      return;
    }

    if (mode === "register" && password !== confirm) {
      toast.error(_("auth.passwordMismatch"));
      return;
    }

    // Guard anti-duplicados: bloquea llamadas en paralelo (doble submit
    // antes del re-render), reintentos inmediatos tras un error (throttle)
    // y reintentos durante el cooldown impuesto por un 429.
    if (loading || submittingRef.current) return;
    if (Date.now() < cooldownUntilRef.current) return;
    const now = Date.now();
    if (now - lastSubmitAtRef.current < 1500) return;
    submittingRef.current = true;
    lastSubmitAtRef.current = now;
    setLoading(true);
    setNotice("");

    try {
      if (demo) {
        if (mode === "login" && email === "admin@test.com" && password === "123456") {
          localStorage.setItem("zane-auth", "true");
          localStorage.setItem(
            "zane-user",
            JSON.stringify({ email: "admin@test.com" })
          );
          window.location.href = "/";
        } else if (mode === "reset") {
          setNotice(_("auth.needSupabase"));
        } else if (mode === "login") {
          toast.error(_("auth.error"));
        } else {
          setNotice(_("auth.needSupabase"));
        }
        return;
      }

      if (mode === "reset") {
        await resetPassword(email);
        setNotice(_("auth.resetEmailSent"));
        return;
      }

      if (mode === "login") {
        await signInWithEmail(email, password);
        toast.success(_("auth.success"));
      } else {
        const { session, user } = await signUpWithEmail(email, password);
        if (session) {
          toast.success(_("auth.signupSuccess"));
        } else if (user) {
          // Confirmación por email activa: aún no hay sesión.
          setNotice(_("auth.checkEmail"));
        } else {
          // Sin error, ni sesión ni user (usuario ya creado / confirmación en
          // curso): no reintentar para no disparar el rate limit (429).
          setNotice(_("auth.checkEmail"));
        }
      }
    } catch (err) {
      const status = (err as { status?: number })?.status ?? 0;
      const message = err instanceof Error ? err.message : "";
      const lower = message.toLowerCase();

      if (status === 429) {
        // El 429 lo devuelve el edge de Supabase (rate limit). No reenviar:
        // se aplica un cooldown visible y el botón muestra la cuenta atrás.
        cooldownUntilRef.current = Date.now() + 45000;
        setCooldownLeft(45);
        toast.error(_("auth.rateLimit"));
      } else if (
        status === 504 ||
        lower.includes("failed to fetch") ||
        lower.includes("networkerror") ||
        lower.includes("load failed") ||
        lower.includes("timeout")
      ) {
        // Fallos de red/timeout del gateway (incluido el 504 "Gateway Timeout").
        console.error("[auth] network error:", err);
        toast.error(_("auth.networkError"));
      } else if (lower.includes("already")) {
        toast.error(_("auth.emailInUse"));
      } else if (lower.includes("not confirmed")) {
        setNotice(_("auth.checkEmail"));
      } else if (lower.includes("password should be")) {
        toast.error(_("auth.weakPassword"));
      } else if (lower.includes("validate") || lower.includes("invalid")) {
        toast.error(_("auth.invalidEmail"));
      } else if (
        lower.includes("signup not allowed") ||
        lower.includes("anonymous provider") ||
        lower.includes("otp verification disabled")
      ) {
        toast.error(_("auth.signupsDisabled"));
      } else if (mode === "register") {
        // Muestra el mensaje real del servidor para poder diagnosticar el 400.
        console.error("[auth] signup error:", err);
        toast.error(message || _("auth.signupError"));
      } else {
        toast.error(_("auth.error"));
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    if (demo) {
      toast.error(_("auth.needSupabase"));
      return;
    }
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("[auth] google error:", err);
      toast.error(_("auth.googleError"));
      setGoogleLoading(false);
    }
  };

  const submitLabel = () => {
    if (cooldownLeft > 0) return _("auth.waitRetry").replace("{s}", String(cooldownLeft));
    if (mode === "reset") return _("auth.resetPassword");
    if (mode === "login") return _("auth.login");
    return _("auth.register");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Zane
          </h1>
          <p className="text-zinc-500 text-sm">{_("app.tagline")}</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6 space-y-4">
          {mode === "reset" ? (
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ArrowLeft size={14} /> {_("auth.backToLogin")}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-800/60">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === "login"
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <LogIn size={14} /> {_("auth.login")}
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === "register"
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <UserPlus size={14} /> {_("auth.register")}
              </button>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <Input
              label={_("auth.email")}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode !== "reset" && (
              <>
                <Input
                  label={_("auth.password")}
                  type="password"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === "register" && (
                  <Input
                    label={_("auth.confirmPassword")}
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                )}
              </>
            )}

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode("reset")}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {_("auth.forgotPassword")}
                </button>
              </div>
            )}

            {notice && (
              <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
                {notice}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={loading || cooldownLeft > 0}
            >
              <LogIn size={16} /> {submitLabel()}
            </Button>
          </form>

          {mode !== "reset" && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-600">{_("auth.or")}</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
          )}

          {mode !== "reset" && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => void handleGoogle()}
              disabled={googleLoading}
            >
              <GoogleIcon /> {_("auth.google")}
            </Button>
          )}

          {demo && (
            <p className="text-[11px] text-zinc-600 text-center">
              {_("auth.demoHint")}
            </p>
          )}
        </div>

        <p className="text-xs text-zinc-600 text-center">{_("auth.terms")}</p>
      </motion.div>
    </div>
  );
}