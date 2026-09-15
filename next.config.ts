import type { NextConfig } from "next";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const isDev = process.env.NODE_ENV === "development";
// En cualquier deploy de Vercel que tenga Deployment Protection (SSO) activa,
// los recursos se reenvían a través de vercel.com/sso-api. Se permite ese host
// fijo únicamente cuando la app corre en Vercel; nunca en desarrollo local.
const onVercel = !!process.env.VERCEL_ENV;
const ssoHost = onVercel ? "https://vercel.com" : "";

function securityHeaders() {
  const connectSrc = ["'self'"];
  if (supabaseUrl) {
    connectSrc.push(supabaseUrl);
    try {
      const { hostname } = new URL(supabaseUrl);
      if (hostname) connectSrc.push(`wss://${hostname}`);
    } catch {
      /* URL no válida: se ignora */
    }
  }
  if (ssoHost) connectSrc.push(ssoHost);

  return [
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "no-referrer",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        `manifest-src 'self'${ssoHost ? " " + ssoHost : ""}`,
        `connect-src ${connectSrc.join(" ")}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    },
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  output: "standalone",
  poweredByHeader: false,
async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders() },
      {
        // El Service Worker debe revalidarse SIEMPRE contra la red (es un
        // fichero sin hash cuyo cambio dispara la actualización de la PWA).
        // "no-cache" permite guardarlo pero obliga a revalidarlo: sin esto,
        // Safari/iOS puede servir una versión vieja de sw.js y la app nunca
        // detecta las nuevas versiones publicadas.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;

