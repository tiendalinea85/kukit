"use client";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { UserPlus, LogIn } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import toast from "react-hot-toast";
import {
  signInWithEmail,
  signUpWithEmail,
  isSupabaseConfigured,
} from "@/lib/supabase";

type Mode = "login" | "register";

export default function AuthPage() {
  const { t: _ } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const submittingRef = useRef(false);
  const lastSubmitAtRef = useRef(0);

  const demo = !isSupabaseConfigured() && process.env.NODE_ENV !== "production";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "register" && password !== confirm) {
      toast.error(_("auth.passwordMismatch"));
      return;
    }

    // Guard anti-duplicados: bloquea llamadas en paralelo (doble submit
    // antes del re-render) y reintentos inmediatos tras un error (throttle).
    if (loading || submittingRef.current) return;
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
        } else if (mode === "login") {
          toast.error(_("auth.error"));
        } else {
          setNotice(_("auth.needSupabase"));
        }
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
        toast.error(_("auth.rateLimit"));
      } else if (lower.includes("already")) {
        toast.error(_("auth.emailInUse"));
      } else if (lower.includes("not confirmed")) {
        setNotice(_("auth.checkEmail"));
      } else if (lower.includes("password should be")) {
        toast.error(_("auth.weakPassword"));
      } else if (
        lower.includes("signup not allowed") ||
        lower.includes("anonymous provider") ||
        lower.includes("otp verification disabled")
      ) {
        toast.error(_("auth.signupsDisabled"));
      } else if (mode === "register") {
        toast.error(_("auth.signupError"));
      } else {
        toast.error(_("auth.error"));
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
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
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-800/60">
            <button
              type="button"
              onClick={() => { setMode("login"); setNotice(""); }}
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
              onClick={() => { setMode("register"); setNotice(""); }}
              className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === "register"
                  ? "bg-purple-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <UserPlus size={14} /> {_("auth.register")}
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <Input
              label={_("auth.email")}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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

            {notice && (
              <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2">
                {notice}
              </p>
            )}

            <Button type="submit" className="w-full" loading={loading} disabled={loading}>
              {mode === "login" ? (
                <>
                  <LogIn size={16} /> {_("auth.login")}
                </>
              ) : (
                <>
                  <UserPlus size={16} /> {_("auth.register")}
                </>
              )}
            </Button>
          </form>

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
