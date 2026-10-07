# Fix: link de restablecer contraseña no abre el formulario

## Diagnóstico (por qué no funcionó)

Causa raíz: **desajuste de flujo OAuth entre Supabase y la app.**

1. `createClient` en `src/lib/supabase.ts:40` no declara `flowType`, así que usa el default
   de supabase-js: **`implicit`**. El link del correo llega a `/auth/reset#access_token=...&type=recovery`
   (tokens en el **hash**).
2. `/auth/reset` (`src/app/auth/reset/page.tsx:22`) solo lee `?code=` vía `getOAuthCode()`
   → no encuentra code → toast "enlace no válido" → `window.location.replace("/auth")`.
3. Mientras tanto, supabase-js con `detectSessionInUrl: true` **sí** procesa el hash,
   crea sesión y emite `PASSWORD_RECOVERY` (GoTrueClient `_initialize`).
4. `AuthProvider` (`src/components/auth/AuthProvider.tsx:57`) usa igualdad estricta
   `pathname === "/auth"`: en `/auth/reset` con sesión ya creada dispara
   `user && !isAuthPage`… no — pero al caer en `/auth` con `user` seteado dispara
   `router.replace("/")` (L60-61) → `WorkspaceGate` → **selector/creación de workspaces**.

Resultado exacto reportado: el link no abre el formulario y lleva a la app en workspaces.

### Fallo de seguridad asociado

La sesión de recovery (link de un solo uso) queda activa y **permite entrar al workspace
sin haber cambiado la contraseña**. No hay ninguna marca que retenga al usuario en
`/auth/reset` hasta completar el cambio.

---

## Plan (acordado con el usuario)

- Enfoque: **soportar flow implícito** (no cambiar a PKCE; no tocar Google OAuth).
- Cierre: **forzar cambio de contraseña** con flag `recovery-pending`.

### 1. `src/lib/supabase.ts`

- Ampliar `getOAuthCode()` (o añadir helper junto a él) para detectar también el
  **hash implícito**: `#access_token=...&type=recovery` → devolver señal
  `hasRecoveryTokens` (no extraer JWT, solo detectar `type=recovery` + `access_token`).
- Exponer el **evento** de auth a los listeners: `onAuthStateChange` pasa
  `(user, event)` para que AuthProvider reaccione a `PASSWORD_RECOVERY`.
  (Firma backward-compatible: el segundo arg es opcional.)

### 2. `src/app/auth/reset/page.tsx`

- Ruta de entrada:
  - Si hay `?code=` → `exchangeCodeForSession` (actual, se mantiene).
  - Si hay hash implícito `type=recovery` → **esperar** a que supabase-js cree la sesión
    (subscribirse a `onAuthStateChange` / `getSession()` con reintento corto) → `setReady(true)`.
  - Si no hay nada → "enlace no válido" → `/auth` (actual).
- Tras montar con recovery: **limpiar la URL** (`history.replaceState`) para que tokens
  del hash no queden visibles ni se re-procesen en recargas.
- Éxito: `updatePassword` → limpiar flag `recovery-pending` → `signOut` → `/auth` (actual).

### 3. `src/components/auth/AuthProvider.tsx` (navegación + cierre de seguridad)

- Guard de rutas: usar **prefijo** `pathname?.startsWith("/auth")` (consistente con
  `ClientLayout.tsx:75`) en vez de igualdad estricta, y **excluir**
  `/auth/reset` y `/auth/callback` de la redirección `user → "/"` (esas rutas
  manejan su propia navegación).
- Nuevo flag `zane-recovery-pending` en `localStorage`:
  - Se **marca** al recibir evento `PASSWORD_RECOVERY`.
  - Si el flag está activo y la ruta no es `/auth/reset` → `router.replace("/auth/reset")`
    (sobrevive recargas y navegación dentro de la app).
  - Se **borra** al: guardar la contraseña con éxito, o `signOut()` explícito.
- Añadir en `AuthProvider.signOut()` (L65-73): `localStorage.removeItem("zane-recovery-pending")`.

### 4. `src/app/auth/page.tsx` (menor)

- Si el usuario llega a `/auth` con el flag activo (p. ej. link inválido tras marcar),
  no tratarlo como login normal: mantener el flag hasta que se complete el reset o
  se pida salir (la rama `reset` ya existe; solo asegurar que no se limpia el flag
  en `switchMode`).

### 5. Traducciones

- `src/lib/translations.ts`: reutilizar claves existentes
  (`auth.resetInvalid`, `auth.newPassword`, `common.loading`). Solo añadir clave nueva
  si hace falta un texto tipo "Debes cambiar tu contraseña para continuar"
  (ej. `auth.recoveryRequired`, es/en).

### 6. Tests

- `src/__tests__/recovery.test.ts` (ya está en el glob de `npm test`):
  - detecta hash implícito `type=recovery`,
  - detecta `?code=` PKCE,
  - devuelve null sin parámetros,
  - lógica pura de "debe redirigir a reset" (flag + pathname) extraída a una función
    testeable (p. ej. `src/lib/recoveryGuard.ts`) para no testear React.

### 7. Verificación

```bash
npm run lint && npm run typecheck && npm test
```

Manual: pedir reset → abrir link → debe mostrar el formulario de nueva contraseña;
si se navega a `/` sin cambiarla → redirige a `/auth/reset`; tras guardar → signOut → login.

## Fuera de scope

- No cambiar `flowType` a PKCE.
- No tocar `/auth/callback` (Google) salvo el ajuste de prefijo del guard.
- No tocar la app móvil (no tiene flujo de reset).
