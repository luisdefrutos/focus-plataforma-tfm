# Pipeline de Datos (ETL y Seeds)

Focus **no** se conecta a SAP en vivo. Se alimenta de **extractos en Excel** que viven en `data/raw/` (no versionados — están en `.gitignore`) y se cargan con *seeds*: scripts TypeScript ejecutados con `tsx`. Los seeds portan la lógica del antiguo ETL en Python (`data/scripts-legacy/`, retirado).

> ⚠️ Los Excel de `data/raw/` pueden quedar **bloqueados por Excel/Office** al correr los seeds: ciérralos antes.

## Fuentes de datos (`data/raw/`)

| Fuente | Carpeta / fichero | Alimenta |
|---|---|---|
| Facturación SAP | `DATOS_FACTURACION/ZKSD_SD14_YYYY.xlsx` (uno por año) | `BILLING_RECORDS`, `CUSTOMER_MASTER` |
| Maestro de clientes | `CUSTOMER_LIST/*.XLSX` (7 ficheros, uno por sociedad) | `CUSTOMER_MASTER`, `ADDRESSES` |
| Jerarquía organizativa | `Profit centers.xls` (¡es MHTML, no `.xls`!) | `LEGAL_ENTITIES`, `DIVISIONS`, `BUSINESS_UNITS` |
| Catálogo de servicios | `Table_MATERIALS.xlsx` | `PRODUCT_CATALOG` |
| Contactos CRM | `CONTACTOS CRM/CONTACTOS_CRM.xlsx` | `CONTACTS` |
| Inspecciones (5 fuentes) | `Inspecciones_{AS,AT,BT,GESAP_TSA,GESAP_TSI}.xlsx` | `ORGANIZATIONS`, `ASSET_TYPES`, `ASSETS`, `INSPECTIONS`, `ORGANIZATION_CONTACTS` |
| Incompatibilidades | `Matriz de conflictos TSA-TSI OC.xlsx` (hoja "Cruces") | `SERVICE_INCOMPATIBILITIES` |
| CNAE | *hardcoded* (datos del INE) | `CNAE_CATALOG` |

## Cómo se ejecutan

Desde `app/`. El comando agregado solo carga los **catálogos ligeros**:

```bash
npm run seed          # ejecuta 01, 02, 03 y 08 (org, catálogo, estados, CNAE)
```

Las cargas pesadas se lanzan **individualmente y en orden de dependencia**:

```bash
npm run seed:billing       # 04 — facturación (por defecto 2024-2026)
npm run seed:customers     # 05 — enriquece CUSTOMER_MASTER + ADDRESSES
npm run seed:contacts      # 06 — CONTACTS
npm run seed:normalize     # 07 — normaliza ciudad/provincia/CP/teléfono
npm run seed:iam           # 09 — roles, permiso y usuarios admin
```

## Catálogo de seeds (01–18)

| # | Script | Carga | npm script |
|---|---|---|---|
| 01 | `01-org-structure.ts` | `LEGAL_ENTITIES`, `DIVISIONS`, `BUSINESS_UNITS` (excluye K999 + históricas 0359/0442) | `seed:org` |
| 02 | `02-product-catalog.ts` | `PRODUCT_CATALOG` (~492 servicios) | `seed:catalog` |
| 03 | `03-status-catalog.ts` | `STATUS_CATALOG` (23 filas) | `seed:status` |
| 04 | `04-billing.ts` | `CUSTOMER_MASTER` + `BILLING_RECORDS` — **por defecto solo 2024-2026**, pasa años como args para más | `seed:billing` |
| 05 | `05-customer-enrichment.ts` | Enriquece `CUSTOMER_MASTER` + `ADDRESSES` (match por `sap_code`, secundario `tax_id`) | `seed:customers` |
| 06 | `06-contacts.ts` | `CONTACTS` | `seed:contacts` |
| 07 | `07-normalize-existing.ts` | Normaliza city/province/CP/phone ya cargados | `seed:normalize` |
| 08 | `08-cnae-catalog.ts` | `CNAE_CATALOG` (88 divisiones CNAE-2009 + `999`) | `seed:cnae` |
| 09 | `09-iam-setup.ts` | `APP_*` (roles ADMINISTRADOR/USUARIO, permiso `IAM_MANAGE`, usuarios admin) | `seed:iam` |
| 10 | `10-inspections.ts` | `ORGANIZATIONS`, `ASSET_TYPES`, `ASSETS`, `INSPECTIONS` — **ascensores** | `seed:inspections` |
| 11 | `11-billing-salesorder-backfill.ts` | Backfill `sales_order_number` en `BILLING_RECORDS` (2019-2026) | `backfill:salesorder` |
| 12 | `12-org-contacts.ts` | `ORGANIZATION_CONTACTS` (recarga por fuente). **Re-ejecutar 16 después** | `seed:org-contacts` |
| 13 | `13-customer-cnae.ts` | `CUSTOMER_CNAE` (CNAE principal por cliente; depende de 05 + 08) | `seed:customer-cnae` |
| 14 | `14-add-uriza.ts` | Usuario admin puntual (`uriza-jo` ADMINISTRADOR) | `seed:add-uriza` |
| 15 | `15-organizations-backfill.ts` | Golden record **universal**: cura gemelos T7, crea `ORGANIZATIONS` para todo CIF y enlaza `org_id` | `seed:org-backfill` |
| 16 | `16-dedupe-contacts.ts` | **Borra** contactos duplicados por organización (email / nombre / errata dist≤1). Soporta `--dry`. **Re-ejecutar tras 06 o 12** | `seed:dedupe-contacts` |
| 17 | `17-inspections-apps.ts` | Inspecciones AT, BT, GESAP_TSA, GESAP_TSI. Tras cargar: re-ejecutar 15, 12 y 16 | `seed:inspections-apps` |
| 18 | `18-service-incompatibilities.ts` | `SERVICE_INCOMPATIBILITIES` (88 pares: 19 TOTAL + 69 PARCIAL). Recarga completa. Soporta `--dry` | `seed:incompatibilities` |
| 19 | `19-add-moure-dev.ts` | Alta de usuario `moure-dev` para evaluación académica TFM | `seed:add-moure` |

## Dependencias y re-ejecuciones (gotchas)

El orden importa. Reglas a recordar:

- **04 antes que 05**: la facturación crea los `CUSTOMER_MASTER`; el enriquecimiento los completa.
- **05 + 08 antes que 13**: `CUSTOMER_CNAE` deriva del `industry_code` ya cargado.
- **15 (org-backfill) tras 04 + 05**: necesita los CIF de `CUSTOMER_MASTER` para crear todas las organizaciones.
- **16 (dedupe-contacts) tras 06 + 12 + 15**, y **re-ejecutar tras cualquier recarga de contactos** (06 o 12).
- **17 (más inspecciones) → luego 15, 12 y 16** otra vez.

## `seeds/lib/`

Mezcla **utilidades reales** —`normalize.ts`, `parse-profit-centers.ts` (parsea el MHTML), `prisma.ts`, `load-inspections.ts` (motor de inspecciones)— con **scripts de depuración** de un solo uso (`debug-*`, `inspect-*`, `test-*`, `probe-ad-passport.ts`) que se conservan como referencia.

## Tablas que nacen vacías

- `CORPORATE_HOLDINGS` — pendiente de fuentes internas TÜV.
- `CROSS_SELL_OPPORTUNITIES` — el motor automático se desactivó (ver [Decisiones de Diseño](/Decisiones-de-Diseno)).
- `AUDIT_EVENTS` — nace vacía; se llena en runtime (ver [IAM y Auditoría](/IAM-y-Auditoria)).

## Refresco de caché tras re-seedear

Tras recargar datos, la caché de agregaciones (tag `billing`, TTL 5 min) puede quedar obsoleta. Invalídala con `POST /api/revalidate` (ver [Arquitectura](/Arquitectura) y [Funcionalidades](/Funcionalidades)).

> **Siguiente**: [Funcionalidades](/Funcionalidades) — qué hace cada pantalla con estos datos.
