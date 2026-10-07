// Generación de IDs en el cliente.
//
// Motivo de existir: `crypto.randomUUID()` solo está disponible en *secure
// context* (HTTPS o localhost). Al instalar la PWA desde la IP de la LAN
// (http://192.168.x.x:3000) el iPhone abre un origen NO seguro y la propiedad
// viene `undefined`: cualquier escritura reventaba con "is not a function".
// La app es offline-first y debe degradar con elegancia, no romperse.
//
// `crypto.getRandomValues` NO está restringido a secure context, así que con él
// siempre podemos construir un UUID v4 válido. Importante: el fallback tiene que
// devolver un UUID RFC-4122 de verdad porque Supabase guarda estos ids en
// columnas `uuid`; un string arbitrario lo rechazaría la base de datos.

export function newId(): string {
  const c = globalThis.crypto;

  if (typeof c?.randomUUID === "function") return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    // Último recurso. Math.random no es criptográfico, pero es preferible a
    // devolver undefined y romper la app; los ids siguen siendo únicos.
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Marcadores de versión (4) y variante (10) para que sea un v4 canónico.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}