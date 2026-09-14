"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KeyRound } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import toast from "react-hot-toast";
import { getSupabase, updatePassword, signOut } from "@/lib/supabase";

export default function AuthResetPage() {
  const { t: _ } = useTranslation();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const exchangingRef = useRef(false);

  useEffect(() => {
    if (exchangingRef.current) return;
    exchangingRef.current = true;

    const url = new URL(window.location.href);
    let code = url.searchParams.get("code");
    if (!code) {
      code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    }

    if (!code) {
      toast.error(_("auth.resetInvalid"));
      window.location.replace("/auth");
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      toast.error(_("auth.resetInvalid"));
      window.location.replace("/auth");
      return;
    }

    void sb.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) throw error;
        setReady(true);
      })
      .catch(() => {
        toast.error(_("auth.resetInvalid"));
        window.location.replace("/auth");
      });
  }, [_]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await updatePassword(password);
      await signOut();
      toast.success(_("auth.resetSuccess"));
      window.location.replace("/auth");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const lower = message.toLowerCase();
      if (lower.includes("password should be")) {
        toast.error(_("auth.weakPassword"));
      } else {
        console.error("[auth] reset password error:", err);
        toast.error(_("auth.resetError"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6 space-y-4">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 flex items-center justify-center">
              <KeyRound size={22} className="text-purple-400" />
            </div>
            <h1 className="text-xl font-bold">{_("auth.newPassword")}</h1>
            <p className="text-xs text-zinc-500">{_("auth.resetSubtitle")}</p>
          </div>

          {!ready ? (
            <p className="text-sm text-zinc-400 text-center py-4">
              {_("common.loading")}
            </p>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <Input
                label={_("auth.newPassword")}
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full" loading={saving} disabled={saving}>
                <KeyRound size={16} /> {_("auth.savePassword")}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}