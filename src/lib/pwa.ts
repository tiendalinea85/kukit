// Gestión del Service Worker de Zane (registro + actualizaciones).
//
// Problema que resuelve: Safari en iPhone/iPad (PWA instalada "Añadir a
// pantalla de inicio") no comprueba actualizaciones del Service Worker en
// segundo plano como Chrome, por lo que una versión nueva en Vercel podía
// quedarse sin aplicar sin desinstalar/reinstalar la app.
//
// Solución:
//  - Se registra /sw.js una única vez (guard contra renders repetidos) con
//    updateViaCache:"none" para que el navegador revalide siempre el archivo
//    del worker contra la red.
//  - Se llama reg.update() explícitamente al cargar, al enfocar y al volver la
//    pestaña a visible (con intervalo mínimo para no generar loops).
//  - Cuando un SW nuevo queda instalado mientras una versión anterior sigue
//    controlando la app, se avisa al usuario ("Nueva versión disponible" con
//    botón "Actualizar") en lugar de recargar la app de forma sorpresiva.
//  - Al pulsar "Actualizar" se fuerza la activación (SKIP_WAITING) y se recarga
//    una única vez. Si la pestaña está en segundo plano, se actualiza y recarga
//    sola, sin interacción y sin riesgo de perder datos.
//
// NOTA: solo se gestiona la caché de archivos estáticos. Los datos offline
// (IndexedDB, outbox de sincronización, workspaces) no se tocan.

let registered = false;
let reloadDone = false;
let lastCheck = 0;

const MIN_CHECK_INTERVAL = 60_000; // evita actualizaciones/loops infinitos

export function registerPWA(onNewVersion: (apply: () => void) => void): void {
  if (registered) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  registered = true;

  let acceptedUpdate = false;

  const sw = navigator.serviceWorker;

  const reloadOnce = () => {
    if (reloadDone) return;
    reloadDone = true;
    window.location.reload();
  };

  sw.addEventListener("controllerchange", () => {
    // Una versión nueva tomó el control. Solo se recarga si el usuario aceptó
    // la actualización o si la pestaña está oculta (nadie está escribiendo).
    if (acceptedUpdate || document.visibilityState === "hidden") {
      reloadOnce();
    }
  });

  const checkForUpdate = (reg: ServiceWorkerRegistration) => {
    const now = Date.now();
    if (now - lastCheck < MIN_CHECK_INTERVAL) return;
    lastCheck = now;
    reg.update().catch(() => {
      /* sin red no hay actualización que comprobar */
    });
  };

  navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" } as RegistrationOptions)
    .then((reg) => {
      // Comprobación explícita al cargar (clave en Safari/iOS).
      checkForUpdate(reg);

      window.addEventListener("focus", () => checkForUpdate(reg));
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate(reg);
      });

      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;

        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed") return;
          // Primera instalación (sin controlador previo): no hay nada que
          // avisar; a partir de ahí, un nuevo SW instalado = nueva versión.
          if (!sw.controller) return;

          onNewVersion(() => {
            acceptedUpdate = true;
            const target = reg.waiting ?? reg.installing;
            if (target) target.postMessage({ type: "SKIP_WAITING" });
            window.setTimeout(reloadOnce, 300);
          });
        });
      });
    })
    .catch(() => {
      /* sin SW el offline parcial sigue funcionando vía cache HTTP */
    });
}