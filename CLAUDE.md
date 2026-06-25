# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

"Proyecto Focus" started as a **data architecture project for TÜV SÜD España** and is now a **working web application** that replaces the old Power BI report ([data/raw/CLIENTES v3.6 Essentials.pbix](data/raw/CLIENTES%20v3.6%20Essentials.pbix), 108 MB — not in git). The app lives in [app/](app/) (Next.js 16), the database is MySQL 8 local (`focus_dev`) managed by Prisma, and the repo is on git with remote `https://dev.azure.com/tuvsud01/Focus/_git/Focus` (branch `main`).

There is a **minimal Vitest unit-test suite** (`app/src/**/*.test.ts`, pure utils only — `sql`/`csv`/`username`/`spain`; `npm test` / `npm run test:coverage`, coverage published in CI); broader coverage is still pending. Source Excels in [data/raw/](data/raw/) may be locked by Excel/Office when running seeds — close them first.

**Working language is Spanish.** All documentation, table/column comments and identifiers in user-facing material are in Spanish. Match that language when editing existing docs; identifiers in SQL/Python/TypeScript stay in English where they already are.

## Current state (June 2026)

- **Stack (real, supersedes the May 2026 plan)**: Next.js 16.2.6 (App Router, TypeScript strict) + React 19 + Prisma 7.8 (`@prisma/adapter-mariadb`) on MySQL 8 + next-auth v4 (JWT). UI: **`@tuvsud/design-system` "Algorithm"** (corporate web components `ts-*` with React wrappers — there is a `tuvsud-algorithm` skill for this) + Tailwind 4 + recharts + TanStack Table. ~~shadcn/ui + Tremor~~ were dropped before scaffolding.
- **Pages** (all under `app/src/app/(dashboard)/`): `dashboard` (KPIs + facturación histórica), `clientes` (Buscador 360: filtros multi-selección server-side incl. CNAE incluir/excluir, export CSV, modo whitespot con toggle tabla/whitespot, filtro de años, agrupación Golden Record por CIF o registro SAP, **incompatibilidades legales de servicios** al filtrar por material — ver abajo), `clientes/[id]` (ficha 360: facturas agrupadas, desglose por BU, whitespots por empresa), `segmentacion` (buckets + breakdown por dimensión), `top-clientes` (top-N, máx 100), `catalogo` (solo requiere sesión iniciada — vista de solo lectura), `accesos` (admin IAM, requiere `IAM_MANAGE`; se llega por el menú del avatar, **no** por el sidebar — decisión deliberada), `auditoria` (**registro de actividad**: auditoría de logins/exports/admin IAM, solo `IAM_MANAGE`, también desde el menú del avatar — ver abajo), `login`.
- **Auth/RLS**: next-auth Credentials valida **usuario + contraseña contra Active Directory vía web service SOAP** (operación `LoginLDAP_AD` de `gestion.atisae.com/loginwebservice/login.asmx`; cliente en [app/src/lib/ad-soap.ts](app/src/lib/ad-soap.ts)). El parámetro `passport` se calcula por petición como `MD5(user + CLAVE_ENCRIPTACION_LDAP)` (replica la función `Encripta()` de las apps internas); la clave va en `.env` como `AD_SOAP_LDAP_KEY` (formato override con `AD_SOAP_PASSPORT_FMT`/`_ENC`, default hex/utf8 = correcto). Solo entran usuarios dados de alta y activos en `APP_USERS`; el alta en `/accesos` verifica el `user_id` contra AD (`ExisteUsuarioLDAP_AD`) y autorrellena el nombre (email editable, AD no siempre devuelve `mail`). Mock opt-in para dev offline (`AUTH_ALLOW_MOCK=true`, no valida password — ver [app/src/lib/auth.ts](app/src/lib/auth.ts)). El JWT embebe `permissions` + `buIds` + `allowedFilters` y se refresca desde BD cada 5 min. [app/src/proxy.ts](app/src/proxy.ts) (en Next 16 `middleware.ts` se llama `proxy.ts`) exige token en todo salvo `/login`, `/api/auth` y estáticos. El RLS por usuario está **desactivado de facto (todos ven todo, 2026-06-22)**: `loadUserScope` concede a cualquier usuario activo todas las BUs y `allowedFilters` vacío, así que las queries de `app/src/lib/queries/` reciben siempre el alcance global. La fontanería sigue ahí (`buIds`: `[]` = sin acceso, todas/`undefined` = global; `allowedFilters` + `applyAllowedFilters`) por si se reintroduce el scoping. Sesión one-tab + cookies de sesión sin `maxAge`.
- **Cache**: [app/src/lib/cache.ts](app/src/lib/cache.ts) envuelve agregaciones de solo lectura con `unstable_cache` (tag `billing`, TTL 5 min). `POST /api/revalidate` invalida el tag tras re-seedear. Regla: toda query cacheada con RLS **debe** recibir `buIds`/`allowedFilters` como argumento (forman parte de la clave de caché).
- **Cross-sell**: el motor automático se **desactivó** (commit `cfe413e`) — el análisis de whitespots es manual desde el buscador. `CROSS_SELL_OPPORTUNITIES` existe pero está vacía y sin wiring. Los antiguos `app/scripts/engine-*.ts` ya no existen.
- **IAM (modelo mínimo, app de BI de solo lectura — refactor 2026-06-22)**: RBAC reducido a lo que se usa de verdad — **1 permiso** (`IAM_MANAGE`, el único que se comprueba en código) y **2 roles**: `ADMINISTRADOR` (con `IAM_MANAGE`: gestiona accesos en `/accesos` y ve todos los datos) y `USUARIO` (sin permisos; solo visualiza). **Todos los usuarios ven TODO**: el alcance de datos es global y NO depende del usuario — `loadUserScope` ([app/src/lib/auth.ts](app/src/lib/auth.ts)) concede todas las BUs y sin `allowed_filters` a cualquier usuario activo; el rol solo decide si administra accesos. Tablas `APP_USERS`/`APP_ROLES`/`APP_PERMISSIONS`/`APP_USER_ROLES`/`APP_ROLE_PERMISSIONS`. El panel `/accesos` solo gestiona **usuarios y su rol** (se retiraron tanto la pestaña de permisos por rol como los filtros de alcance por usuario — BUs/geográficos/negocio). Los roles/permisos antiguos (`SUPER_ADMIN`/`DATA_ADMIN`/`COMERCIAL` y `DATA_VIEW`/`DATA_MANAGE`/`OPPORTUNITY_MANAGE`) se eliminaron por no comprobarse en ningún sitio; usuarios reales: `defru-li` + `uriza-jo` (ambos ADMINISTRADOR). Campañas y Exclusiones siguen pospuestas (v2).
- **Registro de actividad / auditoría** (2026-06-22): tabla append-only `AUDIT_EVENTS` (modelo `AuditEvent`, estilo IAM sin tripleta ETL; `user_id` nullable con FK `ON DELETE SET NULL` + snapshot `username`/`user_full_name` para que el log siga siendo legible si se borra el usuario). Se registran tres familias: **auth** (`LOGIN_SUCCESS` / `LOGIN_FAILED` con el motivo real de AD en `metadata` / `LOGOUT`, instrumentado en `authorize()` + `events.signOut` de [app/src/lib/auth.ts](app/src/lib/auth.ts); IP/UA capturadas del request — nunca la contraseña), **exportaciones** (`EXPORT_CLIENTES` / `EXPORT_OPORTUNIDADES` / `EXPORT_AUDITORIA`, vía `after()` en las rutas `/api/*/export`, con nº de filas + filtros aplicados; el preflight `?checkOnly` NO se audita) y **administración IAM** (`USER_CREATED` / `USER_ROLE_CHANGED` con `from`→`to`, en [accesos/actions.ts](app/src/app/(dashboard)/accesos/actions.ts)). Catálogo de tipos (string, ampliable sin migración) en [app/src/lib/audit-events.ts](app/src/lib/audit-events.ts); logger **seguro que nunca lanza** en [app/src/lib/audit.ts](app/src/lib/audit.ts). Consulta en `/auditoria` (solo `IAM_MANAGE`, menú del avatar): filtros server-side por usuario/categoría/tipo/resultado/rango de fechas/texto libre + paginación + export CSV ([app/src/lib/queries/audit.ts](app/src/lib/queries/audit.ts), panel [audit-log-panel.tsx](app/src/components/auditoria/audit-log-panel.tsx)). Desde el visor, los eventos de exportación se pueden **reexportar** (botón en el detalle del evento): reconstruye la URL del endpoint con los filtros guardados (`metadata.filters`) y descarga el CSV sobre los **datos actuales** (no es una copia histórica); la reexportación queda auditada a nombre del admin con `metadata.reexportOf` = id del evento original (mapa tipo de evento→endpoint `EXPORT_ENDPOINTS` en [audit-events.ts](app/src/lib/audit-events.ts); las rutas `/api/*/export` sacan `reexportOf` de los filtros y lo anotan aparte). **NO** se registra navegación/búsquedas ni apertura de fichas (descartado por volumen). Sin seed (nace vacía); el catálogo y el logger son extensibles para añadir más eventos.
- **Identidad de cliente** (refactor 2026-05-28, ver [docs/data-cleanup/REFACTOR_CUSTOMER_IDENTITY.md](docs/data-cleanup/REFACTOR_CUSTOMER_IDENTITY.md)): `sap_customer_code` ÚNICO es la identidad fuerte de `CUSTOMER_MASTER`; `tax_id` es atributo nullable (el literal SAP `"Not assigned"` se guarda como NULL). El **Golden Record real por CIF** es la tabla `ORGANIZATIONS` (N registros SAP → 1 organización): nació con el módulo de inspecciones y desde el seed 15 es **universal** — una organización por cada CIF válido de `CUSTOMER_MASTER` (~244k), con `ORGANIZATIONS.tax_id` normalizado SIN prefijo `ES` (convención `normCif`). Ojo: existen "gemelos T7" (mismo cliente con código `T75xxxx` de ZKSD y `5xxxx` de CUSTOMER_LIST, ~27,7k pares); el seed 15 les copia el `tax_id` para que agrupen, pero los registros duplicados siguen existiendo (fusionarlos es decisión de negocio pendiente).
- **Incompatibilidades legales de servicios** (2026-06-11, matriz de conflictos OC del Anexo 4 GG6): tabla `SERVICE_INCOMPATIBILITIES` (pares `material_code_a/b` + severidad `TOTAL`/`PARCIAL`, relación lógica con PRODUCT_CATALOG, seed 18 desde `data/raw/Matriz de conflictos TSA-TSI OC.xlsx` hoja "Cruces"). Semántica confirmada con negocio: **1=TOTAL, 2=PARCIAL**. En el Buscador 360, al filtrar por material (incluir), `resolveIncompatibilities` ([app/src/lib/queries/incompatibilities.ts](app/src/lib/queries/incompatibilities.ts)) deriva los materiales conflictivos: los TOTAL **excluyen la organización completa** (si cualquier registro SAP del CIF los factura — cláusula en `buildCustomerWhere`, heredada por whitespot y export), los PARCIAL marcan la fila con badge "⚠ Conflicto parcial" (+ columna en el CSV). Banner persistente con el nº de excluidos y los pares X⛔Y. Verificado: mat=S41-705-10 → 99 entidades excluidas (SQL manual = app). Pendientes de negocio: 2 cruces "REVISAR - NO APLICA" de la matriz (los lista el seed) y validar los mapeos G10-524→G10-524-10 / G10-530→G10-530-10 (descripciones divergentes).
- **Módulo de activos inspeccionables** (junio 2026, no descrito en los docs v2): `ORGANIZATIONS` (golden record por CIF; `CUSTOMER_MASTER.org_id` lo referencia), `ASSET_TYPES`, `ASSETS`, `INSPECTIONS`, `ORGANIZATION_CONTACTS`. **5 fuentes** (extractos locales `data/raw/Inspecciones_*.xlsx`, no en git, mismo formato de cabecera jerárquica): ascensores (`AS`), alta tensión (`AT`), baja tensión (`BT`) y equipos a presión GESAP (`GESAP_TSA` de ATISAE 0135 y `GESAP_TSI` de TÜV SÜD Iberia 0158 — sociedades confirmadas cruzando facturas). Tipos de activo: `ASCENSOR` (identidad RAE+provincia), `ALTA_TENSION`/`BAJA_TENSION`/`GESAP` (sin registro oficial → `reg_code` HASH sintético determinista de emplazamiento+instalación+dirección+CP, crudos en `attributes` JSON). El motor parametrizado vive en `seeds/lib/load-inspections.ts` (mapa de columnas, sociedad, unidad del plazo — OJO: GESAP mezcla meses y años en la misma columna, regla ≤10=años / ≥12=meses validada contra fechas). Carga híbrida: partes (titular/gestor) en crudo + FK a `ORGANIZATIONS` cuando el CIF resuelve. Enlace inspección↔factura por nº de documento (AS ~90% · AT 86% · BT 90% · GESAP 79-80%; multivalor: se guarda solo el primero en `order_number`).
- **Retención de facturación 2021-2026 + limpieza de índices** (2026-06-15): se retiró la facturación anterior a 2021 de `BILLING_RECORDS` (213.162 filas de 2018-2020; backup en `billing_records_bak_pre2021`). Es una operación **manual sobre `focus_dev`, NO reproducible vía seeds/migraciones** (el seed 04 carga 2024-2026 por defecto, así que el histórico pre-2021 no vuelve salvo que se le pasen esos años a propósito). Los selectores de año son data-driven (`SELECT DISTINCT YEAR(invoice_date)`) → pasan solos a 2021-2026; único valor hardcodeado actualizado: `MIN_BILLING_YEAR=2021` en [app/src/lib/queries/dashboard.ts](app/src/lib/queries/dashboard.ts). En la misma fecha se eliminaron 3 índices de `BILLING_RECORDS` — `customer_id` y `bu_id` (redundantes: son prefijo de `idx_br_cust_agg`/`idx_br_bu_agg`, que además cubren sus FKs) y `expiry_date` (columna 100% NULL) — vía migración `20260615000000_drop_redundant_billing_indexes`.

## Migraciones

10 migraciones (`20260522065740_init` … `20260622000000_add_audit_events`). La `db_push_catchup` (10-jun-2026) formaliza lo aplicado con `prisma db push` sin migrar (módulo de inspecciones + `BILLING_RECORDS.sales_order_number`); fue verificada aplicando las migraciones sobre una BD vacía y registrada con `prisma migrate resolve --applied`. La `service_incompatibilities` (11-jun-2026) crea `SERVICE_INCOMPATIBILITIES` — también se aplicó a mano + `resolve --applied` (en esta BD **no** se puede usar `prisma migrate dev`: detectaría la tabla de backup ajena como drift y propondría reset). La `drop_redundant_billing_indexes` (15-jun-2026) elimina 3 índices de `BILLING_RECORDS` (`customer_id`/`bu_id` redundantes + `expiry_date` 100% NULL) — aplicada a mano + `resolve --applied`. La `add_audit_events` (22-jun-2026) crea `AUDIT_EVENTS` (registro de auditoría, FK a `APP_USERS` con `ON DELETE SET NULL`) — aplicada igual: DDL a mano vía MCP MySQL + `resolve --applied`. `npx prisma migrate status` queda limpio.

Nota: `focus_dev` conserva tablas de backup manuales ajenas al esquema — `customer_master_bak_20260603` y `billing_records_bak_pre2021` (las 213.162 filas de facturación 2018-2020 retiradas el 15-jun-2026; restaurable con `INSERT INTO billing_records SELECT * FROM billing_records_bak_pre2021`). Un `migrate diff` las marca como sobrantes. No las incluyas en migraciones ni las borres sin confirmar con el usuario.

## Repository layout

```
focus/
├── CLAUDE.md
├── .gitignore
│
├── app/                              # Next.js 16 application (REAL, en desarrollo activo)
│   ├── prisma/
│   │   ├── schema.prisma             # ⭐ ESQUEMA CANÓNICO (25 tablas)
│   │   ├── migrations/               # 10 migraciones (init … add_audit_events)
│   │   └── seeds/                    # Seeds 01-18 + lib/ (utilidades + scripts debug)
│   ├── src/
│   │   ├── app/(dashboard)/          # Páginas (dashboard, clientes, segmentacion, top-clientes, catalogo, accesos, login)
│   │   ├── app/api/                  # auth/[...nextauth], clientes/export (CSV), revalidate
│   │   ├── components/               # Por feature: buscador/, cliente/, segmentacion/, accesos/, layout/, ui/
│   │   ├── lib/                      # auth.ts, cache.ts, prisma.ts, spain.ts, queries/
│   │   └── proxy.ts                  # Middleware de auth (Next 16)
│   ├── docs/MIGRACION_IAM_FILTROS_SESION.md
│   └── package.json                  # scripts seed:* (ver tabla de seeds abajo)
│
├── docs/
│   ├── OnBoarding/                   # Overview técnico-funcional para nuevos miembros
│   ├── data-cleanup/                 # REFACTOR_CUSTOMER_IDENTITY.md (refactor 2026-05-28)
│   ├── v2-standardized/              # Diseño del modelo 19 tablas (abril 2026) — HISTÓRICO, ver nota de vigencia
│   ├── v1-legacy/                    # Modelo 10 tablas — archivado
│   ├── executive/                    # PPTX, DOCX (parcialmente fuera de git)
│   └── diagrams/                     # PNGs de ERDs y mapas mentales
│
├── db/
│   ├── setup/                        # Bootstrap MySQL local (create database/user, diagnóstico)
│   ├── legacy-oracle/                # DDL Oracle de referencia (NO ejecutar contra MySQL)
│   └── dbml/                         # Fuentes dbdiagram.io
│
└── data/                             # Datasets y ETL — la mayoría NO en git (.gitignore)
    ├── raw/
    │   ├── CUSTOMER_LIST/            # Maestro de clientes por sociedad (7 ficheros)
    │   ├── DATOS_FACTURACION/        # SAP ZKSD_SD14 2019-2026 (uno por año)
    │   ├── CONTACTOS CRM/            # Exports CRM + CONTACTOS_CRM.xlsx consolidado
    │   ├── Inspecciones_AS.xlsx      # Extracto de inspecciones de ascensores (módulo activos)
    │   ├── Inspecciones_{AT,BT,GESAP_TSA,GESAP_TSI}.xlsx  # Resto de aplicaciones técnicas (seed 17)
    │   ├── Profit centers.xls        # ⭐ Jerarquía SAP (MHTML, no .xls real)
    │   ├── Table_MATERIALS.xlsx      # ⭐ Catálogo de servicios limpio
    │   └── CLIENTES v3.6 Essentials.pbix
    ├── logos/                        # Logos corporativos TÜV SÜD (print + screen)
    └── scripts-legacy/               # Python ETL original (retirado, solo referencia)
```

## Source-of-truth files

- **Esquema de datos (canónico)**: [app/prisma/schema.prisma](app/prisma/schema.prisma) — 25 tablas en 7 módulos (org, golden record, CNAE, inteligencia comercial incl. incompatibilidades, activos inspeccionables, estados, IAM + auditoría).
- **Onboarding técnico-funcional**: [docs/OnBoarding/Focus_Technical_and_Functional_Overview.md](docs/OnBoarding/Focus_Technical_and_Functional_Overview.md).
- **Diseño histórico del modelo (abril 2026)**: [docs/v2-standardized/](docs/v2-standardized/) — útil por el diccionario de datos y los ERD, pero describe 19 tablas e incluye módulos aún no implementados (Exclusiones, Campañas); lleva nota de vigencia en cabecera. El Oracle SQL de [db/legacy-oracle/](db/legacy-oracle/) es solo referencia de porting — **no** ejecutarlo contra MySQL.

## Real legal-entity / division / BU hierarchy

The original `BUSINESS_UNITS.sap_code='0135'` model is conceptually wrong. **0135/0136/0158/0359/0380/0442 are legal entities (group companies), not BUs.** Confirmed by parsing [data/raw/Profit centers.xls](data/raw/Profit%20centers.xls) (which is actually an MHTML export, not a real .xls — needs `quopri` + regex on `<table>`, pandas fails on it).

Real SAP hierarchy:

```
LEGAL_ENTITY (7 companies; K999 "Konsolidierung" is an accounting consolidation entity — exclude)
  └── DIVISION (5: II, MO, NGB, BA, PS)
       └── BUSINESS UNIT functional (15 distinct, e.g. "II - Building Lifecycle Services")
            └── BUSINESS LINE (sub-BU)
                 └── PROFIT CENTER (206 operational units / geographic offices)
```

Implemented model (v1):

```
LEGAL_ENTITIES (entity_id PK, sap_code UK, legal_name, country_code)   -- 4 rows operativas
DIVISIONS (division_id PK, division_code UK, division_name)             -- 5 rows
BUSINESS_UNITS (bu_id PK, entity_id FK, division_id FK, bu_name, bu_code, UK(entity_id,bu_code))
                                                                        -- ~31 rows (one per company×BU instance)
```

**Sociedades excluidas (2026-06-10)**: además de K999, el seed 01 descarta **0359 Swissi España** y **0442 CTVA Ingeniería** — solo existen por histórico de facturación en SAP que NO está cargado en Focus (0 facturas aquí); se quitaron de BD para que no aparezcan como whitespots ni en los filtros. Si algún día se carga su histórico, quitar la exclusión (`EXCLUDED_COMPANIES` en `01-org-structure.ts`) y re-seedear.

A given functional BU can appear in several legal entities → BUSINESS_UNITS is the **instance** (company×BU), not the catalog. PROFIT_CENTERS is *not* a table in v1; profit-center code stays as a VARCHAR column on BILLING_RECORDS. Promote later if geographic reporting demands it.

## Schema-wide conventions (implemented in Prisma)

Every operational table follows the same pattern:

- **Dual identifiers**: numeric PK (`<entity>_id`, `Int @id @default(autoincrement())`) + `external_guid VARCHAR(36)` UUID generated app-side (`@default(uuid())`).
- **Audit trio**: `created_at TIMESTAMP DEFAULT NOW()`, `source_system VARCHAR(64) NOT NULL`, `etl_run_id BIGINT NOT NULL`.
- **Estados**: enums nativos de Prisma/MySQL (`CustomerStatus`, `OpportunityStatus`).
- Modelos en PascalCase mapeados a tablas `MAYUSCULAS_SNAKE_CASE` vía `@@map`.

`BUSINESS_UNITS` remains the most-referenced table. Any new module that needs RGPD ownership / scoping / origin tracking FKs to `BUSINESS_UNITS.bu_id`.

## STATUS_CATALOG: logical relation, not physical

`status` columns on operational tables are native MySQL enums. `STATUS_CATALOG` mirrors those codes with UI metadata (display name, order, active flag) keyed by `(entity_name, status_code)` but there is **no FK** between the operational tables and it. The seed precharges **23 rows** (4 CUSTOMER + 8 OPPORTUNITY + 4 CAMPAIGN + 4 TARGET + 3 EXCLUSION — the last three groups are v2 placeholders). When adding a new state value you must update **both** the Prisma enum **and** insert a matching row into `STATUS_CATALOG` — they're kept in sync manually.

## Seeds (app/prisma/seeds/)

Run from `app/`. `npm run seed` only loads the light catalogs (01, 02, 03, 08); the heavy loads run individually, in this dependency order:

| # | Fichero | Carga | Fuente | npm script |
|---|---|---|---|---|
| 01 | `01-org-structure.ts` | LEGAL_ENTITIES, DIVISIONS, BUSINESS_UNITS (excluye K999 + históricas 0359/0442) | `Profit centers.xls` (MHTML) | `seed:org` |
| 02 | `02-product-catalog.ts` | PRODUCT_CATALOG (~492 servicios) | `Table_MATERIALS.xlsx` | `seed:catalog` |
| 03 | `03-status-catalog.ts` | STATUS_CATALOG (23 filas) | hardcoded | `seed:status` |
| 04 | `04-billing.ts` | CUSTOMER_MASTER + BILLING_RECORDS | `DATOS_FACTURACION/ZKSD_SD14_YYYY.xlsx` — **por defecto solo 2024-2026**, pasa años como args para más (la BD viva arranca en **2021**: la facturación pre-2021 se retiró el 15-jun-2026) | `seed:billing` |
| 05 | `05-customer-enrichment.ts` | CUSTOMER_MASTER (enriquece) + ADDRESSES | `CUSTOMER_LIST/*.XLSX` (7 ficheros; match por sap_code, secundario tax_id) | `seed:customers` |
| 06 | `06-contacts.ts` | CONTACTS | `CONTACTOS CRM/CONTACTOS_CRM.xlsx` | `seed:contacts` |
| 07 | `07-normalize-existing.ts` | normaliza city/province/CP/phone ya cargados | (BD) | `seed:normalize` |
| 08 | `08-cnae-catalog.ts` | CNAE_CATALOG (88 divisiones CNAE-2009 + `999` sin clasificar) | hardcoded (INE) | `seed:cnae` |
| 09 | `09-iam-setup.ts` | APP_* (roles ADMINISTRADOR/USUARIO, permiso IAM_MANAGE, usuarios admin defru-li + uriza-jo) | hardcoded | `seed:iam` |
| 10 | `10-inspections.ts` | ORGANIZATIONS, ASSET_TYPES, ASSETS, INSPECTIONS — **ascensores** (motor compartido en `lib/load-inspections.ts`) | `Inspecciones_AS.xlsx` | `seed:inspections` |
| 11 | `11-billing-salesorder-backfill.ts` | backfill `sales_order_number` en BILLING_RECORDS (2019-2026) | ZKSD | `backfill:salesorder` |
| 12 | `12-org-contacts.ts` | ORGANIZATION_CONTACTS — recarga por fuente (borra+reinserta los source_system seleccionados). **Re-ejecutar 16 después** | bloques CONTACTO de los 5 extractos `Inspecciones_*.xlsx` | `seed:org-contacts` |
| 13 | `13-customer-cnae.ts` | CUSTOMER_CNAE (CNAE principal por cliente) | `CUSTOMER_MASTER.industry_code` (depende de 05 + 08) | `seed:customer-cnae` |
| 14 | `14-add-uriza.ts` | usuario admin puntual (uriza-jo ADMINISTRADOR) | hardcoded | `seed:add-uriza` |
| 15 | `15-organizations-backfill.ts` | golden record UNIVERSAL: cura gemelos T7 (tax_id), crea ORGANIZATIONS para todo CIF de CUSTOMER_MASTER y enlaza `org_id` | (BD; tras 04+05) | `seed:org-backfill` |
| 16 | `16-dedupe-contacts.ts` | BORRA contactos duplicados (CRM y gestor/titular) por organización: mismo email / mismo nombre / errata dist≤1; el superviviente hereda los huecos. Soporta `--dry`. **Re-ejecutar tras 06 o 12** | (BD; tras 06+12+15) | `seed:dedupe-contacts` |
| 17 | `17-inspections-apps.ts` | inspecciones del resto de aplicaciones técnicas: AT, BT, GESAP_TSA, GESAP_TSI (tipos ALTA_TENSION/BAJA_TENSION/GESAP). CLI: fuentes y/o límite. Tras cargar: re-ejecutar 15, 12 y 16 | `Inspecciones_AT/BT/GESAP_TSA/GESAP_TSI.xlsx` | `seed:inspections-apps` |
| 18 | `18-service-incompatibilities.ts` | SERVICE_INCOMPATIBILITIES (88 pares: 19 TOTAL + 69 PARCIAL; normaliza códigos y resuelve contradicciones a TOTAL). Recarga completa. Soporta `--dry` | `Matriz de conflictos TSA-TSI OC.xlsx` (hoja Cruces) | `seed:incompatibilities` |

`seeds/lib/` mixes real utilities (`normalize.ts`, `parse-profit-centers.ts`, `prisma.ts`) with one-shot debug/inspect scripts (`debug-*`, `inspect-*`, `test-*`) kept for reference.

CORPORATE_HOLDINGS remains empty (pending TÜV internal sources). `CUSTOMER_CNAE` is populated by seed 13 from `industry_code` (≈60,7k clientes → división CNAE; subdivisiones tipo `45.2` se truncan a `45`, lo no resoluble cae a `999`).

## Python ETL scripts (legacy reference)

Located in [data/scripts-legacy/](data/scripts-legacy/) (pandas + openpyxl). Retired — their logic was ported to the Node/TS seeds. `validacionEmail.py` added the `Email-Validacion` column (blocks free email providers on purpose — B2B contacts only); `Concatenacion135-138-CRM.py` produced the canonical `CONTACTOS_CRM.xlsx`.

## Running the legacy Oracle scripts (not recommended)

The scripts in [db/legacy-oracle/](db/legacy-oracle/) are kept as **design reference** for the data model and won't be executed against MySQL. If for some reason you need to run them against an Oracle test instance, the standardized one is idempotent (it cleans existing objects before recreating) — never run against production without a backup.
