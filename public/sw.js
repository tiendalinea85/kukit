const CACHE_NAME = "zane-cache-v5";

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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
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

  event.respondWith(
    caches.match(request).then((cached) => {
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
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});