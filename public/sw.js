// Zane Service Worker.
//
// Estrategias:
//  - Navegación (HTML): network-first con fallback a caché (offline seguro).
//  - Assets estáticos con hash (js/css/imágenes): cache-first + revalidación
//    en segundo plano (stale-while-revalidate): los chunks hasheados nuevos
//    siempre caen a la red, los sin hash se refrescan solos.
//  - Peticiones RSC/API/prefetch de Next.js: nunca se cachean.
//
// Los DATOS del usuario (IndexedDB "zane-db", localStorage, outbox de
// sincronización) NO se tocan: aquí solo se gestionan las CACHÉS de archivos
// estáticos cuyo nombre empieza por "zane-". Una actualización de versión
// NUNCA borra gastos, compras, ventas, workspaces ni configuraciones.
//
// Versionado: cada versión nueva (CACHE_VERSION) usa su propia caché; al
// activarse se eliminan únicamente las cachés antiguas "zane-*".

const CACHE_VERSION = "zane-v8";
const CACHE_NAME = `zane-${CACHE_VERSION}`;
const CACHE_PREFIX = "zane-";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

function isCacheableRequest(request) {
  try {
    const url = new URL(request.url);

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      request.method === "GET"
    );
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {
        // Un fallo de precache no debe bloquear la instalación de la nueva
        // versión; los assets se cachean igualmente bajo demanda.
      })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );

  event.waitUntil(self.clients.claim());

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) =>
        clients.forEach((client) =>
          client.postMessage({ type: "ZANE_VERSION", version: CACHE_VERSION })
        )
      )
  );
});

// Permite que la app fuerce la activación inmediata cuando el usuario pulsa
// "Actualizar" (por si en algún navegador el worker quedó en estado waiting).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Nunca interceptar solicitudes que no sean GET.
  if (request.method !== "GET") return;

  // No manejar API desde este Service Worker.
  if (request.url.includes("/api/")) return;

  // IMPORTANTE:
  // chrome-extension://, moz-extension://, file://, data:, blob:, etc.
  // no deben llegar nunca a cache.put().
  if (!isCacheableRequest(request)) return;

  // Solo se atienden peticiones del propio origen; el resto (Supabase,
  // fuentes externas, etc.) se deja pasar tal cual al navegador.
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isCacheableRequest(request)) {
            const clone = response.clone();

            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(request, clone)
              )
            );
          }

          return response;
        })
        .catch(() => {
          return caches.match("/").then((cached) => {
            if (cached) return cached;

            const headers = new Headers({
              "Content-Type": "text/html; charset=utf-8",
            });

            return new Response(
              "<!doctype html><html><body><h1>Sin conexión</h1></body></html>",
              {
                status: 503,
                headers,
              }
            );
          });
        })
    );

    return;
  }

  // Las peticiones internas del router de Next.js (RSC, prefetch) llevan
  // cabeceras/query propios. NUNCA deben pasar por la caché del SW porque el
  // router espera la respuesta "flight" sin transformar; interceptarlas rompe
  // la navegación (TypeError: Failed to fetch) y deja la pantalla en blanco.
  if (requestUrl.searchParams.has("_rsc")) return;
  if (
    request.headers.get("rsc") ||
    request.headers.get("next-router-state-tree") ||
    request.headers.get("next-router-prefetch") ||
    request.headers.get("next-router-segment-prefetch")
  ) {
    return;
  }

  // Solo se cachean assets estáticos locales; el resto se deja a la red.
  if (!/\.(js|css|json|svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|map)$/i.test(requestUrl.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      // stale-while-revalidate: se devuelve lo cacheado (offline seguro) y se
      // revalida contra la red en segundo plano para que las nuevas versiones
      // publicadas en Vercel reemplacen a las anteriores sin desinstalar la PWA.
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok && isCacheableRequest(request)) {
            const clone = response.clone();

            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(request, clone)
              )
            );
          }

          return response;
        })
        .catch(() => cached || Response.error());

      return cached || fetchPromise;
    })
  );
});