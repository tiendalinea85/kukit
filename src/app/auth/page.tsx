"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function AuthPage() {
  const { t: _ } = useTranslation();
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("123456");

  const handleEmailLogin = () => {
    if (email === "admin@test.com" && password === "123456") {
      localStorage.setItem("zane-auth", "true");
      localStorage.setItem("zane-user", JSON.stringify({ email: "admin@test.com" }));
      window.location.href = "/";
    } else {
      alert("Credenciales incorrectas");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Zane
          </h1>
          <p className="text-zinc-500 text-sm">{_("app.tagline")}</p>
        </div>

        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800/60 p-6 space-y-4">
          <Input label={_("auth.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label={_("auth.password")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <Button onClick={handleEmailLogin} className="w-full">
            <Mail size={16} /> {_("auth.login")}
          </Button>
        </div>

        <p className="text-xs text-zinc-600 text-center">
          {_("auth.terms")}
        </p>
      </motion.div>
    </div>
  );
}
