# Focus — Cambios recientes (11–15 junio 2026)

**Documento de puesta al día para retomar el desarrollo.**
*Generado: 18-06-2026 · Cubre el bloque de trabajo posterior al onboarding (fechado 10-06-2026).*

> **Para qué sirve este documento.** El [overview de onboarding](Focus_Technical_and_Functional_Overview.md) está congelado a 10-jun. Entre el 11 y el 15 de junio entró una tanda grande de cambios (incompatibilidades de servicios, nueva página de Oportunidades, dashboard reescrito, optimización de carga y retirada de facturación pre-2021). Este `.md` resume **qué cambió, en qué estado quedó y qué falta**, para poder continuar sin releer todo el historial de git.
>
> **Fuentes canónicas** (leer siempre antes de tocar): [`CLAUDE.md`](../../CLAUDE.md) en la raíz (estado del proyecto, esquema, seeds, convenciones) y el [overview de onboarding](Focus_Technical_and_Functional_Overview.md). Este documento **complementa**, no sustituye.

---

## 1. TL;DR (lo imprescindible)

1. **Nueva página `/oportunidades`** — matriz cliente × servicio (Material Codes), con los mismos filtros que el Buscador 360 y export CSV. Ya está enlazada en el sidebar. *(Ojo: aún no aparece en la lista de páginas del `CLAUDE.md` raíz.)*
2. **Dashboard reescrito** — pasó de "facturación histórica" a **KPIs de ciclo de vida de la cartera** (fieles / nuevos / recuperados / perdidos TSI·MOI·TSA) + **Pareto por división**. ⚠️ **Está mostrando un mock-up de presentación**, no datos reales (flag `PRESENTATION_MOCKUP = true`). El dashboard real con datos ya está implementado detrás del flag.
3. **Incompatibilidades legales de servicios** — matriz de conflictos OC (Anexo 4 GG6) integrada en Buscador 360 y Catálogo. TOTAL excluye la organización; PARCIAL la marca con badge.
4. **Optimización de carga** — índices, queries reescritas (window functions, agrupación numérica), filtros pesados cargados *lazy*, build con validación de tipos restaurada (33 errores corregidos).
5. **Retirada de facturación pre-2021** — `BILLING_RECORDS` ahora arranca en **2021** (se quitaron 213.162 filas de 2018-2020). Operación **manual, no reproducible vía seeds**; backup en `billing_records_bak_pre2021`.
6. Varios fixes (whitespot COUNT, logo de login, tipos del export de oportunidades) y `sidebar` a **v0.8 MVP**.

---

## 2. Cambios por área (con estado)

### 2.1 Nueva página: Matriz de Oportunidades — `/oportunidades` ✅ funcional
- **Qué es**: una vista **matricial** de la cartera. Filas = clientes (agrupables por organización/CIF o por registro SAP), columnas = Material Codes (servicios). Cada celda muestra la facturación de ese cliente en ese servicio; las columnas se generan **dinámicamente** y solo aparecen los materiales con facturación > 0 € para los clientes de la página.
- **Reutiliza** el `FilterBar` y los catálogos del Buscador 360 (mismos filtros, mismo RLS por `buIds`/`allowedFilters`). Paginación a 100 filas.
- **Export CSV** con streaming: `GET /api/oportunidades/export`.
- **Archivos**: [`app/src/app/(dashboard)/oportunidades/page.tsx`](../../app/src/app/(dashboard)/oportunidades/page.tsx), `components/oportunidades/opportunities-matrix.tsx`, `getOpportunitiesMatrix()` en [`lib/queries/customers.ts`](../../app/src/lib/queries/customers.ts), `app/src/app/api/oportunidades/export/route.ts`.
- **Commits**: `489b00c`, `bfd3575`, `498f198`.

### 2.2 Dashboard ejecutivo reescrito — ⚠️ en modo mock-up
- **Qué cambió**: el dashboard dejó de ser "KPIs + facturación histórica" y pasó a medir el **ciclo de vida de la cartera a nivel de organización (CIF)**, calculado como **foto a cierre del último año completo** (`refYear`; el año en curso es parcial y no computa):
  - **Fieles**: facturan todos los años de la ventana móvil `[refYear-3 .. refYear]`.
  - **Nuevos**: primera factura de su historia en `refYear`.
  - **Recuperados**: compraron en el pasado, fallaron `refYear-1`, volvieron en `refYear`.
  - **Perdidos TSI / MOI / TSA**: facturaron en TÜV LFD Iberia (9999) / división Mobility / INSPECCION_SA-inspección vencida, y no en `refYear`.
  - **Pareto por división**: cuántos clientes concentran el 80% de la facturación del último año cerrado (donut Recharts).
- **⚠️ ESTADO IMPORTANTE**: la página tiene `const PRESENTATION_MOCKUP = true` en [`dashboard/page.tsx`](../../app/src/app/(dashboard)/dashboard/page.tsx). Mientras esté en `true`, **se renderiza un mock-up sin cifras** (`DashboardMockup`, pensado para presentación a alta dirección) y **no se ejecuta ninguna query**. Para activar el dashboard real con datos: **poner el flag a `false`**.
- **Archivos**: [`dashboard/page.tsx`](../../app/src/app/(dashboard)/dashboard/page.tsx), `components/dashboard/dashboard-mockup.tsx`, `components/charts/pareto-division-donut.tsx`, [`lib/queries/dashboard.ts`](../../app/src/lib/queries/dashboard.ts). Se eliminaron `billing-by-year-chart.tsx` y `top-customers-list.tsx` del dashboard.
- **Commit**: `868127e` (incluye la reescritura previa que ya estaba en el árbol de trabajo).

### 2.3 Incompatibilidades legales de servicios ✅
- **Qué es**: matriz de conflictos OC (Anexo 4 GG6) entre servicios que no pueden coexistir en el mismo cliente. Tabla `SERVICE_INCOMPATIBILITIES` (pares `material_code_a/b` + severidad). **Semántica de negocio confirmada: 1 = TOTAL, 2 = PARCIAL.** 88 pares (19 TOTAL + 69 PARCIAL).
- **En el Buscador 360**: al filtrar por material (incluir), `resolveIncompatibilities` deriva los materiales conflictivos. Los **TOTAL excluyen la organización completa** (si cualquier registro SAP del CIF los factura); los **PARCIAL** marcan la fila con badge "⚠ Conflicto parcial" (+ columna en el CSV). Banner persistente con el nº de excluidos.
- **En el Catálogo**: nueva columna **Incompatibilidades** con chips por material conflictivo (rojo = TOTAL, ámbar = PARCIAL; máx 3 visibles + tooltip). Se quitaron las columnas "Servicio TUV" y "Usos".
- **Carga**: `seed:incompatibilities` (seed 18) desde `data/raw/Matriz de conflictos TSA-TSI OC.xlsx` (hoja "Cruces"). Migración `service_incompatibilities` (aplicada a mano + `migrate resolve`).
- **Archivos**: [`lib/queries/incompatibilities.ts`](../../app/src/lib/queries/incompatibilities.ts), `buildCustomerWhere` en `lib/queries/customers.ts`, `prisma/seeds/18-service-incompatibilities.ts`.
- **Commits**: `e8162e1`, `689dc34`, `a1227e8`.

### 2.4 Ficha de cliente (`/clientes/[id]`) ✅
- Sección **Whitespots colapsable** (nuevo `CollapsibleSection`, abierta por defecto); cada empresa del mapa se pliega de forma independiente.
- **Contactos** ordenados: titular primero, gestor (mantenedor) después, resto alfabético. Se quitó la columna RGPD de la tabla.
- **Fix**: el whitespot usaba `COUNT(*)` en el LEFT JOIN de la cartera y contaba 1 línea en BUs sin facturas → corregido a `COUNT(br.billing_id)`.
- **Archivos**: `components/cliente/collapsible-section.tsx`, `components/cliente/whitespots-map.tsx`, `components/cliente/contacts-table.tsx`.
- **Commits**: `d84f2d3`, `486f805`.

### 2.5 Optimización de carga / rendimiento ✅
- **Índices**: se eliminaron 3 índices de `BILLING_RECORDS` — `customer_id` y `bu_id` (redundantes: prefijo de los índices de cobertura `idx_br_cust_agg`/`idx_br_bu_agg`) y `expiry_date` (100% NULL). Migración `20260615000000_drop_redundant_billing_indexes`.
- **Queries**: `segmentacion` y `top-clientes` agrupan por clave **numérica** (sin hashing de strings); `top-clientes` en una sola agregación con `OVER()`. Buscador: catálogos + búsqueda **en paralelo** (se eliminó el waterfall).
- **Payload**: los filtros pesados (materiales, centros de coste) se cargan **lazy** vía `GET /api/filter-options` (reutiliza `getFilterCatalogs` → mismo RLS y caché).
- **Cache**: `nativeCached` con cota LRU + purga de expiradas (evita fuga de memoria). `revalidateTag(tag, 'max')` por el cambio de firma en Next 16.
- **Build/tipos**: se corrigieron **33 errores de tipos** y se retiró `typescript.ignoreBuildErrors` → el build vuelve a validar tipos. Se quitó `dark.css` sin uso y la dependencia `@material-symbols/svg-400` (iconos por CDN).
- **Commit**: `868127e`.

### 2.6 Datos: retirada de facturación pre-2021 ⚠️ operación manual
- Se retiraron **213.162 filas** de facturación 2018-2020 de `BILLING_RECORDS`. La BD viva arranca ahora en **2021**.
- **No es reproducible vía seeds ni migraciones**: el seed 04 carga 2024-2026 por defecto, así que el histórico pre-2021 no vuelve salvo que se le pasen esos años a propósito. Backup en la tabla `billing_records_bak_pre2021` (restaurable con `INSERT INTO billing_records SELECT * FROM billing_records_bak_pre2021`).
- Los selectores de año son *data-driven* (`SELECT DISTINCT YEAR(...)`) → pasan solos a 2021-2026. Único valor hardcodeado actualizado: `MIN_BILLING_YEAR = 2021` en [`lib/queries/dashboard.ts`](../../app/src/lib/queries/dashboard.ts).
- **Commits**: `868127e`, `86a2532` (docs).

### 2.7 Fixes menores / layout
- **Login**: el middleware (`proxy.ts`) solo eximía `tuvsud-logo.svg`; el nuevo logo del login (`focus-logo.svg`) se interceptaba y salía roto sin sesión. Corregido en la lista de rutas públicas. Commit `67347e0`.
- **Sidebar** a **v0.8 · MVP**. Commit `6563b4c`.

---

## 3. Estado actual del proyecto (junio 2026)

- **Stack**: Next.js 16.2.6 (App Router, TS strict) + React 19 + Prisma 7.8 (`@prisma/adapter-mariadb`) sobre MySQL 8 (`focus_dev`) + next-auth v4 (JWT). UI: `@tuvsud/design-system` "Algorithm" + Tailwind 4 + recharts + TanStack Table.
- **Páginas** (`app/src/app/(dashboard)/`): `dashboard`, `clientes` (Buscador 360), **`oportunidades`** (matriz, nueva), `clientes/[id]` (ficha 360), `segmentacion`, `top-clientes`, `catalogo` (perm. `DATA_MANAGE`), `accesos` (IAM, perm. `IAM_MANAGE`, se llega por el menú del avatar), `login`.
- **Auth/RLS**: login es un **mock de AD** (valida que el usuario exista en `APP_USERS`, no comprueba contraseña; bloqueado en producción salvo `AUTH_ALLOW_MOCK=true`). El RLS es **app-side**: las queries reciben `buIds` y `allowedFilters`. Toda query cacheada con RLS **debe** recibir esos dos argumentos (forman parte de la clave de caché).
- **Migraciones**: 9 (`init` … `drop_redundant_billing_indexes`). `npx prisma migrate status` queda limpio. **No se puede usar `prisma migrate dev`** en esta BD: detectaría las tablas de backup ajenas como drift y propondría reset.
- **Módulo de activos inspeccionables**: capa de datos cargada (5 fuentes: ascensores AS, alta tensión AT, baja tensión BT, GESAP TSA/TSI). **Sin pantalla propia todavía.**

---

## 4. Pendientes / próximos pasos

### Técnicos
- [ ] **Dashboard real**: decidir cuándo desactivar el mock-up (`PRESENTATION_MOCKUP = false` en [`dashboard/page.tsx`](../../app/src/app/(dashboard)/dashboard/page.tsx)) para servir KPIs con datos. Mientras esté en `true`, el dashboard no ejecuta queries.
- [ ] **Actualizar `CLAUDE.md` raíz**: la lista de páginas no incluye `/oportunidades` (se añadió después de la última edición del doc).
- [ ] **Activos inspeccionables sin UI**: el modelo de datos existe pero no hay pantalla. Pendiente diseñar la vista (instalaciones/inspecciones, caducidades, cruce con facturación).
- [x] **Login AD real (SOAP)**: implementado (22-jun-2026) — valida usuario+contraseña contra AD vía `LoginLDAP_AD` (passport = `MD5(user + clave)`, `AD_SOAP_LDAP_KEY` en `.env`). El alta en `/accesos` verifica el `user_id` en AD (`ExisteUsuarioLDAP_AD`) y autorrellena el nombre. El mock queda como escape offline (`AUTH_ALLOW_MOCK=true`).
- [ ] `CORPORATE_HOLDINGS` y `CROSS_SELL_OPPORTUNITIES` siguen **vacías** (la segunda por decisión de producto: el motor automático se desactivó; el análisis de whitespots es manual desde el buscador).

### De negocio (incompatibilidades de servicios)
- [ ] Resolver los **2 cruces "REVISAR - NO APLICA"** de la matriz (el seed 18 los lista).
- [ ] Validar los mapeos **G10-524 → G10-524-10** y **G10-530 → G10-530-10** (descripciones divergentes).
- [ ] **Gemelos T7**: ~27,7k pares de un mismo cliente con código `T75xxxx` (ZKSD) y `5xxxx` (CUSTOMER_LIST). El seed 15 les copia el `tax_id` para que agrupen en el Golden Record, pero los registros duplicados siguen existiendo. **Fusionarlos es decisión de negocio pendiente.**

---

## 5. Cómo retomar el trabajo (arranque rápido)

1. **Leer primero**: [`CLAUDE.md`](../../CLAUDE.md) (raíz) y [`app/AGENTS.md`](../../app/AGENTS.md) (⚠️ esta versión de Next 16 tiene breaking changes; consultar `node_modules/next/dist/docs/` antes de escribir código).
2. **App**: `cd app && npm run dev`. BD MySQL local `focus_dev`.
3. **Seeds** (desde `app/`): `npm run seed` carga catálogos ligeros (01, 02, 03, 08); los cargas pesadas van individuales y **en orden de dependencia** (ver la tabla de seeds en `CLAUDE.md`). Tras re-seedear agregaciones, invalidar la caché con `POST /api/revalidate`.
4. **Excels fuente** en `data/raw/` (no en git): **ciérralos en Excel/Office** antes de correr seeds o quedan bloqueados.

### Gotchas que conviene no pisar
- **No usar `prisma migrate dev`** (drift por tablas de backup → propone reset). Las migraciones de junio se aplicaron a mano + `prisma migrate resolve --applied`.
- **Tablas de backup manuales** en `focus_dev` ajenas al esquema: `customer_master_bak_20260603` y `billing_records_bak_pre2021`. **No incluirlas en migraciones ni borrarlas sin confirmar.**
- **El histórico pre-2021 no vuelve solo**: el seed 04 carga 2024-2026 por defecto.
- **Dashboard en mock-up**: si "no salen datos en el dashboard", es el flag `PRESENTATION_MOCKUP`, no un bug de datos.

---

## 6. Índice de commits cubiertos (11–15 jun 2026)

| Commit | Fecha | Resumen |
|---|---|---|
| `67347e0` | 15-jun | fix(login): sirve `focus-logo.svg` sin autenticación en el middleware |
| `86a2532` | 15-jun | docs(claude): facturación arranca en 2021 + limpieza de índices |
| `868127e` | 15-jun | perf: optimización de carga (índices, queries, filtros) + retirada facturación pre-2021 + dashboard reescrito |
| `6563b4c` | 15-jun | chore(layout): sidebar a v0.8 MVP |
| `a1227e8` | 12-jun | feat(catalogo): columna de incompatibilidades |
| `498f198` | 12-jun | feat: export CSV de la matriz de oportunidades (streaming) |
| `689dc34` | 12-jun | feat: seed de incompatibilidades + limpieza de scratch files |
| `d84f2d3` | 12-jun | feat(cliente): whitespots plegables + mejoras de contactos |
| `486f805` | 11-jun | fix(whitespot): `COUNT(br.billing_id)` en el LEFT JOIN |
| `bfd3575` | 11-jun | fix(oportunidades): tipos del export CSV y taxId de organización |
| `489b00c` | 11-jun | feat: página de matriz de oportunidades + endpoints de export |
| `e8162e1` | 11-jun | feat(buscador): incompatibilidades legales entre servicios |
