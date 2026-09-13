import type { NextConfig } from "next";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const isDev = process.env.NODE_ENV === "development";
// En previews de Vercel con protección (SSO), los recursos se sirven a través
// de vercel.com/sso-api; se permite solo en preview, no en producción.
const isVercelPreview = process.env.VERCEL_ENV === "preview";
const ssoHost = isVercelPreview ? "https://vercel.com" : "";

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
    return [{ source: "/(.*)", headers: securityHeaders() }];
  },
};

export default nextConfig;
