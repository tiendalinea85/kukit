import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientLayout } from "@/components/layout/ClientLayout";

export const metadata: Metadata = {
  title: "Zane - Control de Gastos",
  description: "Aplicación moderna para registro y control de gastos",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Zane" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f0f0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-512.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
