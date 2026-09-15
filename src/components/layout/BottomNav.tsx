"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Wallet, BarChart3, Settings } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { t } from "@/lib/translations";

function useNavLabels() {
  const lang = useAppStore((s) => s.language);
  return {
    "/": t(lang, "nav.home"),
    "/expenses": t(lang, "nav.expenses"),
    "/reports": t(lang, "nav.reports"),
    "/settings": t(lang, "nav.settings"),
  } as Record<string, string>;
}

const links = [
  { href: "/", icon: Home },
  { href: "/expenses", icon: Wallet },
  { href: "/reports", icon: BarChart3 },
  { href: "/settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const labels = useNavLabels();

  return (
    <nav className="zane-mobile-bottomnav fixed bottom-0 left-0 right-0 z-30 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href}
              className={`flex flex-col items-center justify-center gap-0.5 relative px-4 py-1 rounded-xl transition-colors ${
                active ? "text-purple-400" : "text-zinc-500"
              }`}
            >
              {active && (
                <motion.div layoutId="navDot" className="absolute -top-0.5 w-8 h-0.5 bg-purple-500 rounded-full" />
              )}
              <link.icon size={22} />
              <span className="text-[10px] font-medium">{labels[link.href]}</span>
            </Link>
          );
        })}
        <Link href="/expenses/new"
          className="flex items-center justify-center w-12 h-12 -mt-4 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full shadow-lg shadow-purple-600/30 text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}
