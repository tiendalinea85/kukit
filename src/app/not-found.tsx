import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-4xl">🔍</div>
        <h1 className="text-lg font-semibold">Página no encontrada</h1>
        <p className="text-sm text-zinc-400">
          La sección que buscas no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
