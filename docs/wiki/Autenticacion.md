# Autenticación

Focus usa **next-auth v4** con estrategia **JWT**. El login valida **usuario + contraseña contra el Active Directory corporativo** mediante un **web service SOAP**, no contra una tabla de contraseñas local.

Ficheros clave: `app/src/lib/auth.ts` (configuración next-auth), `app/src/lib/ad-soap.ts` (cliente SOAP) y `app/src/proxy.ts` (middleware).

## Flujo de login

```
Usuario  ──(usuario + contraseña)──►  /login
                                        │
                                        ▼
                          authorize()  (lib/auth.ts)
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                     ▼
   loginLdapAd(user, pass)                              loadUserScope(user)
   (lib/ad-soap.ts → SOAP)                              (¿es fila activa en APP_USERS?)
   valida contra Active Directory                       carga rol/permisos/alcance
              │                                                     │
              └──────────────────────┬──────────────────────────────┘
                                     ▼
                        JWT firmado (NEXTAUTH_SECRET)
            embebe: permissions + buIds + allowedFilters
                  (se refresca desde BD cada 5 min)
```

Para entrar hacen falta **dos cosas**: (1) que AD valide las credenciales y (2) que el usuario exista **dado de alta y activo** en `APP_USERS`.

## El web service SOAP de AD

- Endpoint: operación `LoginLDAP_AD` de `gestion.atisae.com/loginwebservice/login.asmx` (`AD_SOAP_URL`).
- Cada petición lleva un parámetro **`passport`** que se calcula por petición como:

  ```
  passport = MD5(user + CLAVE_ENCRIPTACION_LDAP)
  ```

  Esto **replica la función `Encripta()`** de las apps internas. La clave va en `.env` como **`AD_SOAP_LDAP_KEY`** (la facilita IT; no se versiona). El formato por defecto (hex sobre UTF-8) es el correcto; se puede forzar con `AD_SOAP_PASSPORT_FMT` / `AD_SOAP_PASSPORT_ENC` si `Encripta()` usara otra codificación (lo determina el script `prisma/seeds/lib/probe-ad-passport.ts`).
- El **alta de usuarios** en `/accesos` usa la operación `ExisteUsuarioLDAP_AD` para verificar el `user_id` y autorrellenar el nombre (el email no siempre lo devuelve AD → editable).
- Timeout configurable con `AD_SOAP_TIMEOUT_MS` (por defecto 10 s).
- El cliente SOAP **escapa el XML** correctamente y **verifica TLS**. La contraseña **nunca** se registra en auditoría.

> 🕓 **Deuda heredada conocida**: el `passport` usa MD5 y el sistema depende de la disponibilidad del web service de AD. Son limitaciones del contrato con el servicio corporativo, no decisiones nuevas.

## Modo mock (solo desarrollo)

Para desarrollar **sin conectividad al web service de AD**, `AUTH_ALLOW_MOCK="true"` salta la validación de contraseña: cualquier username **dado de alta en `APP_USERS`** entra sin validar la clave.

> 🔴 **Nunca en producción.** Como los usuarios reales son ADMINISTRADOR, esta variable mal puesta en producción equivale a *login como admin sin contraseña*. Es el hallazgo **A-1** de la auditoría (ver [Seguridad](/Seguridad)). Déjala sin definir salvo que sepas exactamente lo que haces.

## El JWT y el refresco de alcance

El token de sesión embebe:

- `permissions` — códigos de permiso (en la práctica, `IAM_MANAGE`).
- `buIds` — qué Business Units puede ver el usuario.
- `allowedFilters` — listas blancas por dimensión (CCAA, provincias, materiales…).

El token se **refresca desde la BD cada 5 minutos**, de modo que los cambios hechos en `/accesos` se propagan sin re-login. La sesión es **one-tab** y usa cookies de sesión **sin `maxAge`** (caducan al cerrar el navegador).

## El middleware (`proxy.ts`)

En Next.js 16, lo que antes era `middleware.ts` se llama **`proxy.ts`**. Exige token válido para **toda** ruta salvo:

- `/login`
- `/api/auth`
- los recursos estáticos.

## RLS (Row-Level Security): desactivado de facto

El alcance por usuario (RLS) está **desactivado a propósito desde 2026-06-22**: **todos los usuarios autenticados ven todos los datos.**

- `loadUserScope` (`lib/auth.ts`) concede a cualquier usuario activo **todas las BUs** y un `allowedFilters` **vacío**, de modo que las queries de `lib/queries/` reciben siempre el alcance global.
- **La fontanería sigue ahí** por si se reintroduce el scoping: `buIds` (`[]` = sin acceso, todas/`undefined` = global), `allowedFilters` + la función `applyAllowedFilters`.
- El rol solo decide **si administras accesos** (`IAM_MANAGE`), no qué datos ves.

Esto es una **decisión de negocio** (Focus es una herramienta interna de BI de solo lectura), no un fallo de seguridad. Ver [Decisiones de Diseño](/Decisiones-de-Diseno) y [IAM y Auditoría](/IAM-y-Auditoria).

## Variables de entorno relacionadas

| Variable | Para qué |
|---|---|
| `NEXTAUTH_SECRET` | Firma del JWT (**obligatoria**). |
| `NEXTAUTH_URL` | URL base de la app. |
| `AD_SOAP_URL` | Endpoint del web service de AD. |
| `AD_SOAP_LDAP_KEY` | Clave para el `passport` (**obligatoria**, la da IT). |
| `AD_SOAP_PASSPORT_FMT` / `_ENC` | Override del formato del passport (normalmente innecesario). |
| `AD_SOAP_TIMEOUT_MS` | Timeout SOAP (default 10000). |
| `AUTH_ALLOW_MOCK` | Mock de login **solo dev**. |

La tabla completa de variables está en [Puesta en Marcha Local](/Puesta-en-Marcha-Local).

> **Siguiente**: [IAM y Auditoría](/IAM-y-Auditoria) — roles, permisos y trazabilidad.
