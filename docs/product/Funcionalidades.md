# Funcionalidades

Todas las pantallas viven bajo `app/src/app/(dashboard)/` y requieren **sesión iniciada** (lo impone `proxy.ts`). Algunas requieren además el permiso `IAM_MANAGE`. La lógica de datos de cada una está en `app/src/lib/queries/`.

## Dashboard (`/dashboard`)

Panel ejecutivo: **KPIs** y **facturación histórica**. Es la página de atercaje tras el login.

- Agregaciones de solo lectura, **cacheadas** (tag `billing`, TTL 5 min — ver [Arquitectura](/Arquitectura)).
- Selector de años *data-driven* (`SELECT DISTINCT YEAR(invoice_date)`); el mínimo está fijado en `MIN_BILLING_YEAR=2021` (`lib/queries/dashboard.ts`).

## Buscador 360 — Clientes (`/clientes`)

La pantalla central de Focus. Un buscador de clientes con **filtros multi-selección server-side**:

- **Filtros**: sociedad, BU, geografía (CCAA/provincia), material/servicio, **CNAE con incluir/excluir**, año, etc.
- **Agrupación por Golden Record**: alterna entre agrupar por **CIF** (organización) o por **registro SAP** individual.
- **Export CSV**: exporta **todo el resultado de la búsqueda** (no solo la página visible), respetando los filtros aplicados. Vía `app/src/app/api/clientes/export`.
- **Modo whitespot**: un toggle cambia entre **tabla** (lo que se factura) y **whitespot** (dónde *no* se factura). El whitespot cruza la cartera filtrada contra todas las sociedades/BUs y revela huecos = oportunidades de venta cruzada (análisis **manual**).
- **Incompatibilidades legales de servicios**: al filtrar por un material (incluir), las incompatibilidades **TOTAL** excluyen la organización completa y las **PARCIAL** marcan la fila con un badge "⚠ Conflicto parcial" (+ columna en el CSV). Un banner persistente indica cuántas organizaciones se excluyeron y los pares en conflicto. Ver [Modelo de Datos](/Modelo-de-Datos#incompatibilidades-legales-de-servicios).

## Ficha 360 del cliente (`/clientes/[id]`)

Detalle de un cliente / organización:

- **Facturas agrupadas** y desglose **por BU**.
- **Whitespots por empresa** (dónde no hay facturación para esa entidad).
- Contactos y direcciones asociados.

## Segmentación (`/segmentacion`)

Segmentación de la cartera por **buckets** con *breakdown* por dimensión (sociedad, BU, geografía, sector…). Requiere sesión (guarda de sesión añadida en el endurecimiento de seguridad).

## Top Clientes (`/top-clientes`)

Ranking **top-N** de clientes por facturación (**máximo 100**). Requiere sesión.

## Catálogo de servicios (`/catalogo`)

Vista de **solo lectura** del catálogo de servicios (`PRODUCT_CATALOG`). Solo requiere **sesión iniciada** (no necesita `IAM_MANAGE`).

## Accesos — Administración IAM (`/accesos`)

Panel de **gestión de usuarios y su rol**. Requiere permiso **`IAM_MANAGE`**.

- Se llega por el **menú del avatar**, **no** por el sidebar (decisión deliberada).
- El alta de usuario verifica el `user_id` contra Active Directory (`ExisteUsuarioLDAP_AD`) y autorrellena el nombre (el email es editable porque AD no siempre lo devuelve).
- Detalle del modelo en [IAM y Auditoría](/IAM-y-Auditoria).

## Registro de actividad — Auditoría (`/auditoria`)

Visor del **registro de auditoría** (`AUDIT_EVENTS`). Requiere **`IAM_MANAGE`**; también desde el menú del avatar.

- Filtros server-side por usuario, categoría, tipo, resultado, rango de fechas y texto libre, con paginación y **export CSV**.
- Desde el detalle de un evento de exportación se puede **reexportar** (reconstruye la descarga con los filtros guardados, sobre los datos *actuales*).
- Detalle en [IAM y Auditoría](/IAM-y-Auditoria).

## Login (`/login`)

Única ruta pública (junto con `/api/auth` y los estáticos). Valida usuario + contraseña contra **Active Directory por SOAP**. Ver [Autenticación](/Autenticacion).

---

## Endpoints de API (`app/src/app/api/`)

| Endpoint | Para qué |
|---|---|
| `auth/[...nextauth]` | Login/logout (next-auth). |
| `clientes/export` y otros `*/export` | Generan los **CSV** (clientes, oportunidades, auditoría). Auditan la exportación vía `after()`. |
| `revalidate` | `POST` invalida la caché (tag `billing`) tras re-seedear. Protegido con `IAM_MANAGE` o `REVALIDATE_SECRET` (cabecera `x-revalidate-secret`). |

> **Siguiente**: [Autenticación](/Autenticacion) — cómo se entra y cómo se protege.
