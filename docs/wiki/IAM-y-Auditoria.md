# IAM y Auditoría

## Modelo IAM mínimo

*(Refactor 2026-06-22.)* Focus es una herramienta interna de BI de **solo lectura**, así que el RBAC se redujo a lo que realmente se usa:

- **1 permiso**: `IAM_MANAGE` — el único que se comprueba en código.
- **2 roles**:
  - **`ADMINISTRADOR`** (tiene `IAM_MANAGE`): gestiona accesos en `/accesos`, consulta la auditoría en `/auditoria` y ve todos los datos.
  - **`USUARIO`** (sin permisos): solo visualiza.

> **Todos los usuarios ven TODO.** El alcance de datos es **global y no depende del usuario** (`loadUserScope` concede todas las BUs y sin `allowed_filters` a cualquier usuario activo — ver [Autenticación](/Autenticacion)). El rol **solo** decide si administras accesos.

### Tablas IAM

`APP_USERS` · `APP_ROLES` · `APP_PERMISSIONS` · `APP_USER_ROLES` · `APP_ROLE_PERMISSIONS`

El panel `/accesos` gestiona **usuarios y su rol**. Se retiraron tanto la pestaña de permisos por rol como los filtros de alcance por usuario (BUs / geográficos / negocio), porque no se comprobaban en ningún sitio.

### Historia del modelo

Los roles y permisos antiguos (`SUPER_ADMIN` / `DATA_ADMIN` / `COMERCIAL` y `DATA_VIEW` / `DATA_MANAGE` / `OPPORTUNITY_MANAGE`) **se eliminaron** por no comprobarse en código. Usuarios reales actuales: `defru-li` y `uriza-jo` (ambos ADMINISTRADOR). Los módulos de **Campañas** y **Exclusiones** siguen pospuestos (v2).

### Alta de usuarios

El alta en `/accesos`:
1. Verifica el `user_id` contra Active Directory (`ExisteUsuarioLDAP_AD`).
2. Autorrellena el nombre desde AD (el email es editable, porque AD no siempre devuelve `mail`).
3. Crea la fila en `APP_USERS` y le asigna rol.

Cada alta o cambio de rol queda **auditado** (ver abajo).

---

## Registro de actividad / Auditoría

*(2026-06-22.)* Tabla **append-only** `AUDIT_EVENTS` (modelo `AuditEvent`). Diseño:

- `user_id` **nullable** con FK `ON DELETE SET NULL`, **+ snapshot** `username` / `user_full_name`, para que el log siga siendo legible aunque se borre el usuario.
- Sin tripleta ETL (estilo IAM, no es dato cargado).
- **Nace vacía**; se llena en runtime.

### Qué se registra (tres familias)

| Familia | Eventos | Dónde se instrumenta |
|---|---|---|
| **Auth** | `LOGIN_SUCCESS`, `LOGIN_FAILED` (con el motivo real de AD en `metadata`), `LOGOUT` | `authorize()` + `events.signOut` de `lib/auth.ts`. IP/UA del request; **nunca** la contraseña. |
| **Exportaciones** | `EXPORT_CLIENTES`, `EXPORT_OPORTUNIDADES`, `EXPORT_AUDITORIA` | Vía `after()` en las rutas `/api/*/export`, con nº de filas + filtros aplicados. El preflight `?checkOnly` **no** se audita. |
| **Administración IAM** | `USER_CREATED`, `USER_ROLE_CHANGED` (con `from`→`to`) | `accesos/actions.ts`. |

> **No** se registra navegación, búsquedas ni apertura de fichas (descartado por volumen).

### Componentes

| Pieza | Fichero |
|---|---|
| Catálogo de tipos de evento (string, ampliable sin migración) | `lib/audit-events.ts` |
| Logger **seguro que nunca lanza** | `lib/audit.ts` |
| Consulta server-side (filtros + paginación + export) | `lib/queries/audit.ts` |
| Panel del visor | `components/auditoria/audit-log-panel.tsx` |
| Pantalla | `/auditoria` (solo `IAM_MANAGE`, menú del avatar) |

El catálogo y el logger son **extensibles**: añadir un nuevo tipo de evento no requiere migración (los tipos son strings).

### Reexportación desde el visor

Desde el detalle de un evento de exportación, un admin puede **reexportar**: se reconstruye la URL del endpoint con los filtros guardados (`metadata.filters`) y se descarga el CSV sobre los **datos actuales** (no es una copia histórica). La reexportación **queda auditada** a nombre del admin, con `metadata.reexportOf` = id del evento original. El mapa tipo→endpoint (`EXPORT_ENDPOINTS`) está en `lib/audit-events.ts`.

> **Siguiente**: [Seguridad](/Seguridad) — postura global y acciones pendientes.
