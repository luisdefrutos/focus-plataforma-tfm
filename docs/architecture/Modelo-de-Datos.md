# Modelo de Datos

La base de datos (`focus_dev` en local) consta de **25 tablas** organizadas en **7 módulos**. El esquema canónico es **[`app/prisma/schema.prisma`](/app/prisma/schema.prisma)** — esa es la única fuente de verdad; esta página lo explica.

> **Ver Diagrama Completo**: Puedes consultar el [Diagrama Entidad-Relación Completo (Mermaid)](../diagrams/DIAGRAMA_ER_COMPLETO.md) con las 25 tablas exactas tal y como están definidas en Prisma.

> Diagramas adicionales en `docs/diagrams/`: `Mapa Mental Proyecto Focus.png`.

## Convenciones de esquema (todas las tablas operativas)

- **Identidad dual**: PK numérica autoincremental (`<entidad>_id`, `Int @id @default(autoincrement())`) **+** `external_guid VARCHAR(36)` (UUID generado en app, `@default(uuid())`) para integración externa.
- **Tripleta de auditoría**: `created_at TIMESTAMP DEFAULT NOW()`, `source_system VARCHAR(64)`, `etl_run_id BIGINT`.
- **Estados**: enums nativos de Prisma/MySQL (`CustomerStatus`, `OpportunityStatus`).
- **Nombres**: modelos Prisma en `PascalCase` mapeados a tablas `MAYUSCULAS_SNAKE_CASE` con `@@map`.
- `BUSINESS_UNITS` es la tabla más referenciada: cualquier módulo nuevo que necesite propiedad RGPD / scoping / origen apunta con FK a `BUSINESS_UNITS.bu_id`.

## Los 7 módulos

### Módulo 0 — Estructura organizativa
`LEGAL_ENTITIES` · `DIVISIONS` · `BUSINESS_UNITS` · `CORPORATE_HOLDINGS` (vacía, pendiente de fuente)

Modela la **jerarquía real de SAP** (ver sección dedicada abajo).

### Módulo 1 — Golden Record (clientes)
`CUSTOMER_MASTER` · `ADDRESSES` · `CONTACTS`

El corazón del cliente. `CUSTOMER_MASTER` es cada registro SAP; la identidad de cliente se explica abajo.

### Módulo 2 — Clasificación sectorial (CNAE)
`CNAE_CATALOG` (88 divisiones CNAE-2009 + `999` sin clasificar) · `CUSTOMER_CNAE` (CNAE principal por cliente)

### Módulo 3 — Inteligencia comercial
`BILLING_RECORDS` · `PRODUCT_CATALOG` (~492 servicios) · `SERVICE_INCOMPATIBILITIES` · `CROSS_SELL_OPPORTUNITIES` (vacía — motor desactivado)

### Módulo 4 — Activos inspeccionables
`ORGANIZATIONS` · `ASSET_TYPES` · `ASSETS` · `INSPECTIONS` · `ORGANIZATION_CONTACTS`

### Módulo 5 — Control de acceso (IAM) + Auditoría
`APP_USERS` · `APP_ROLES` · `APP_PERMISSIONS` · `APP_USER_ROLES` · `APP_ROLE_PERMISSIONS` · `AUDIT_EVENTS`

Detalle en [IAM y Auditoría](/IAM-y-Auditoria).

### Módulo 6 — Referencia
`STATUS_CATALOG` (23 estados precargados)

---

## La jerarquía de sociedades (importante)

El modelo conceptual ingenuo —"`8888` es una BU"— **es incorrecto**. Los códigos `8888/0136/9999/0359/0380/0442` son **sociedades legales** (entidades del grupo), **no** BUs. Se confirmó parseando `data/raw/Profit centers.xls` (que en realidad es un MHTML, no un `.xls` de verdad).

Jerarquía real en SAP:

```
LEGAL_ENTITY   (sociedad del grupo; K999 "Konsolidierung" es contable → se excluye)
  └── DIVISION   (5: II, MO, NGB, BA, PS)
       └── BUSINESS UNIT funcional   (15 distintas, p. ej. "II - Building Lifecycle Services")
            └── BUSINESS LINE   (sub-BU)
                 └── PROFIT CENTER   (206 unidades operativas / oficinas geográficas)
```

Modelo implementado (v1):

```
LEGAL_ENTITIES (entity_id PK, sap_code UK, legal_name, country_code)
DIVISIONS      (division_id PK, division_code UK, division_name)
BUSINESS_UNITS (bu_id PK, entity_id FK, division_id FK, bu_name, bu_code, UK(entity_id,bu_code))
```

Una misma BU funcional puede existir en varias sociedades → **`BUSINESS_UNITS` es la *instancia* (sociedad × BU), no el catálogo.** `PROFIT_CENTERS` **no** es una tabla en v1: el código de profit center vive como columna `VARCHAR` en `BILLING_RECORDS`.

**Sociedades excluidas** (no aparecen en filtros ni whitespots):
- `K999` Konsolidierung — entidad contable de consolidación.
- `0359` Swissi España y `0442` CTVA Ingeniería — solo existen por histórico de facturación en SAP que **no** está cargado en Focus (0 facturas aquí). Si algún día se carga su histórico, quitar la exclusión (`EXCLUDED_COMPANIES` en `01-org-structure.ts`) y re-seedear.

---

## Identidad de cliente y Golden Record

*(Refactor 2026-05-28 — ver `docs/data-cleanup/REFACTOR_CUSTOMER_IDENTITY.md`.)*

Hay **dos niveles** de identidad:

### Nivel 1 — `CUSTOMER_MASTER` (registro SAP)
- `sap_customer_code` **ÚNICO** es la **identidad fuerte**.
- `tax_id` (CIF/NIF) es un **atributo nullable**. El literal SAP `"Not assigned"` se guarda como `NULL`.

### Nivel 2 — `ORGANIZATIONS` (Golden Record por CIF)
La tabla `ORGANIZATIONS` es el Golden Record real: agrupa **N registros SAP → 1 organización** por CIF. Nació con el módulo de inspecciones y desde el seed 15 es **universal**: una organización por cada CIF válido de `CUSTOMER_MASTER` (~244k). `ORGANIZATIONS.tax_id` se almacena **normalizado sin el prefijo `ES`** (convención `normCif`). `CUSTOMER_MASTER.org_id` referencia la organización.

### Los "gemelos T7"
Existen ~27,7k pares de "gemelos T7": el mismo cliente con un código `T75xxxx` (origen ZKSD) y otro `5xxxx` (origen CUSTOMER_LIST). El seed 15 les copia el `tax_id` para que agrupen bajo la misma organización, **pero los registros duplicados siguen existiendo** en `CUSTOMER_MASTER`. Fusionarlos físicamente es una decisión de negocio pendiente.

---

## Incompatibilidades legales de servicios

*(2026-06-11 — matriz de conflictos OC del Anexo 4 GG6.)*

La tabla `SERVICE_INCOMPATIBILITIES` guarda **pares de materiales incompatibles** (`material_code_a`/`material_code_b`) con una **severidad**:

- **`TOTAL`** (valor 1 en la matriz): si cualquier registro SAP de un CIF factura el material conflictivo, **se excluye la organización completa** del resultado al filtrar por el material incompatible.
- **`PARCIAL`** (valor 2): la fila se marca con un badge **"⚠ Conflicto parcial"** (y una columna en el CSV), pero no se excluye.

La lógica vive en `app/src/lib/queries/incompatibilities.ts` (`resolveIncompatibilities`) y se aplica en el Buscador 360 al filtrar por material (incluir). La cláusula de exclusión está en `buildCustomerWhere`, de modo que la heredan el modo whitespot y el export. Verificado: `mat=S41-705-10` → 99 entidades excluidas (SQL manual = app).

Carga: seed 18 desde `data/raw/Matriz de conflictos TSA-TSI OC.xlsx` (hoja "Cruces"). Pendientes de negocio: 2 cruces "REVISAR - NO APLICA" de la matriz y validar mapeos `G10-524→G10-524-10` / `G10-530→G10-530-10`.

---

## Módulo de activos inspeccionables

*(Junio 2026.)* Modela instalaciones reglamentarias y sus inspecciones con caducidad.

- **`ORGANIZATIONS`** — Golden record por CIF (ver arriba).
- **`ASSET_TYPES`** — tipos: `ASCENSOR`, `ALTA_TENSION`, `BAJA_TENSION`, `GESAP`.
- **`ASSETS`** — instalaciones. Identidad: `ASCENSOR` por RAE+provincia; el resto **sin registro oficial → `reg_code` es un HASH sintético determinista** de emplazamiento+instalación+dirección+CP. Los datos crudos van en `attributes` (JSON).
- **`INSPECTIONS`** — inspecciones; enlace inspección↔factura por nº de documento (AS ~90% · AT 86% · BT 90% · GESAP 79-80%).
- **`ORGANIZATION_CONTACTS`** — contactos (titular / gestor) de las organizaciones.

**5 fuentes** (extractos locales `data/raw/Inspecciones_*.xlsx`, no en git): ascensores (`AS`), alta tensión (`AT`), baja tensión (`BT`) y equipos a presión GESAP de dos sociedades — `GESAP_TSA` (INSPECCION_SA `8888`) y `GESAP_TSI` (TÜV LFD Iberia `9999`). El motor de carga parametrizado vive en `prisma/seeds/lib/load-inspections.ts`.

> ⚠️ Gotcha de GESAP: el plazo mezcla **años y meses en la misma columna** (regla validada: ≤10 = años, ≥12 = meses).

---

## STATUS_CATALOG: relación lógica, no física

Las columnas `status` de las tablas operativas son **enums nativos de MySQL**. `STATUS_CATALOG` replica esos códigos con metadatos de UI (nombre legible, orden, flag activo) por `(entity_name, status_code)`, **sin FK física** entre las tablas operativas y el catálogo.

El seed precarga **23 filas** (4 CUSTOMER + 8 OPPORTUNITY + 4 CAMPAIGN + 4 TARGET + 3 EXCLUSION — los tres últimos grupos son *placeholders* de v2).

> ⚠️ Al añadir un nuevo valor de estado hay que actualizar **ambos**: el enum de Prisma **y** una fila en `STATUS_CATALOG` (se mantienen sincronizados a mano).

---

## Retención de facturación

La facturación viva cubre **2021–2026**. En 2026-06-15 se retiraron 213.162 filas de 2018-2020 de `BILLING_RECORDS` (backup en `billing_records_bak_pre2021`). Fue una operación **manual sobre `focus_dev`, no reproducible vía seeds**. Los selectores de año son *data-driven* (`SELECT DISTINCT YEAR(invoice_date)`), así que se ajustan solos; el único valor hardcodeado es `MIN_BILLING_YEAR=2021` en `app/src/lib/queries/dashboard.ts`.

> **Siguiente**: [Pipeline de Datos](/Pipeline-de-Datos) — cómo se cargan estas tablas.
