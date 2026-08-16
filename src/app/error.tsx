"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error global de la aplicación", error);
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold">Algo salió mal</h1>
          <p className="text-sm text-zinc-400">
            Hubo un error inesperado. Tus datos locales no se perdieron.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm"
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
