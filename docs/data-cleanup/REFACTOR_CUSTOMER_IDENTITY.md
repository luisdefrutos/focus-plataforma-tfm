# Refactor: identidad de cliente (CUSTOMER_MASTER) + limpieza BLOCKED

**Autor:** Juri + Claude · **Fecha:** 2026-05-28 · **Estado:** ✅ aplicado y validado

> **Actualización (10-06-2026):** las cifras de la tabla siguiente reflejan el estado al 28-05-2026. Desde entonces: las migraciones aplicadas son **7** (`20260604094913_iam_module`, `20260605100000_add_allowed_filters` y `20260610000000_db_push_catchup`, esta última formaliza el módulo de activos inspeccionables y `sales_order_number` que se habían aplicado con `db push`), `CNAE_CATALOG` está cargado (88 divisiones + sin clasificar) con `CUSTOMER_CNAE` ya mapeado por cliente, y `CUSTOMER_MASTER` ganó la FK opcional `org_id` hacia `ORGANIZATIONS` — el golden record real por CIF que complementa la identidad por `sap_customer_code` descrita aquí.

---

## 🟢 Estado actual de `focus_dev` (NO TOCAR salvo reproducir desde cero)

La BD local de Juri está en el estado final. Cualquier agente que retome esta tarea debe **primero** ejecutar las queries de la sección 3 para confirmar que coinciden con las cifras de abajo. Si coinciden, **no hay nada que hacer** salvo aprovechar el nuevo modelo en la app.

| Métrica | Valor esperado |
|---|---:|
| Migraciones Prisma aplicadas | **4** (la última: `20260528000000_customer_identity_refactor`) |
| `CUSTOMER_MASTER` filas | **271.342** |
| `BILLING_RECORDS` filas | **935.218** |
| `ADDRESSES` filas | **134.336** |
| `CONTACTS` filas | **69.156** |
| Filas con `tax_id = 'Not assigned'` | **0** |
| Filas con `legal_name LIKE '%BLOCKED%'` | **0** |
| Filas con `sap_customer_code IS NULL` | **0** |
| `customer_id = 762` | `C.P. BALANDRO, 30` (CIF `ESH79967832`) — **no** Panificadora de Alcalá |
| Top cliente por nº facturas | ARVAL SERVICE LEASE (~31k) — **no** Panificadora |
| Distribución `status` | ACTIVE 270.353 / BLOCKED_DUP 343 / BLOCKED_UNPAID 354 / BLOCKED_OTHER 292 |
| Con `superseded_by_sap_code` | 291 (de los cuales 123 referencian un cliente que existe en BD) |

Si una sola de estas cifras NO coincide → algo se ha desviado. Re-aplicar la sección 4.

---

## 1. Resumen del problema y la solución

### 1.1 El bug

En la revisión de Focus se detectó que `customer_id = 762` ("PANIFICADORA DE ALCALÁ, S.L.") concentraba **96.302 facturas / 45,77 M€** — el 10,3 % de toda la facturación. Imposible.

**Causa raíz:** SAP exporta la cadena literal `"Not assigned"` en *Sales Tax ID* cuando un cliente no tiene CIF. El seed `04-billing.ts` deduplicaba clientes por `taxId`, y como `CUSTOMER_MASTER.tax_id` era `UNIQUE`, todos los clientes sin CIF colapsaban en una sola fila — la primera que vio el seed: Panificadora.

**Causa secundaria:** 697 clientes con la cadena `"BLOCKED"` en `legal_name` (artefacto SAP — registros bloqueados pero conservados por histórico). 105 de ellos tenían un `OK <sap_code>` apuntando al cliente sucesor.

### 1.2 La solución (resumen)

1. Identidad fuerte de cliente pasa de `tax_id` (UNIQUE) → `sap_customer_code` (UNIQUE). `tax_id` queda como atributo nullable.
2. Nuevo enum `CustomerStatus` (ACTIVE / BLOCKED_DUP / BLOCKED_UNPAID / BLOCKED_OTHER) + columnas `block_reason` y `superseded_by_sap_code`.
3. Seeds `04-billing.ts` y `05-customer-enrichment.ts` reescritos:
   - 04 deduplica por `Customer` (SAP code), no por VAT.
   - 05 cruza primero por SAP code, parsea `legal_name` con regex para extraer `status / block_reason / superseded_by_sap_code` y deja `legal_name` limpio.
4. Reseed completo desde los 7 ficheros de `data/raw/CUSTOMER_LIST/` y los 8 de `data/raw/DATOS_FACTURACION/` (años 2019-2026).

Resultado: el 762 vuelve a ser un cliente normal, las 96k facturas se reparten entre los N clientes SAP reales, el `legal_name` queda limpio y los BLOCKED clasificados.

---

## 2. Cambios técnicos aplicados (referencia)

### 2.1 Schema (`app/prisma/schema.prisma`)

```diff
+enum CustomerStatus {
+  ACTIVE
+  BLOCKED_DUP
+  BLOCKED_UNPAID
+  BLOCKED_OTHER
+}
+
 model CustomerMaster {
   customerId          Int            @id @default(autoincrement()) @map("customer_id")
   externalGuid        String         @unique @default(uuid()) @map("external_guid") @db.VarChar(36)
   holdingId           Int?           @map("holding_id")
-  taxId               String         @unique @map("tax_id") @db.VarChar(64)
+  taxId               String?        @map("tax_id") @db.VarChar(64)
   legalName           String         @map("legal_name") @db.VarChar(255)
-  sapCustomerCode     String?        @map("sap_customer_code") @db.VarChar(32)
+  sapCustomerCode     String?        @unique @map("sap_customer_code") @db.VarChar(32)
   industryCode        String?        @map("industry_code") @db.VarChar(16)
   phone               String?        @db.VarChar(64)
+  status              CustomerStatus @default(ACTIVE)
+  blockReason         String?        @map("block_reason") @db.VarChar(500)
+  supersededBySapCode String?        @map("superseded_by_sap_code") @db.VarChar(32)
   …

+  @@index([taxId])
+  @@index([status])
   @@index([legalName])
   @@map("CUSTOMER_MASTER")
 }
```

Migración: [`app/prisma/migrations/20260528000000_customer_identity_refactor/migration.sql`](../../app/prisma/migrations/20260528000000_customer_identity_refactor/migration.sql).

### 2.2 STATUS_CATALOG

4 filas nuevas con `entity_name = 'CUSTOMER'` y los códigos del enum. Aplicadas en [`app/prisma/seeds/03-status-catalog.ts`](../../app/prisma/seeds/03-status-catalog.ts).

### 2.3 `04-billing.ts`

- Clave de deduplicación cambia de `Sales Tax ID` a `Customer` (SAP code).
- `taxId` solo se guarda si NO es vacío ni `"Not assigned"` (insensitive).
- Contador `noSapCode` reemplaza a `noTaxId` en `skipped`.
- Mapa interno pasa de `Map<taxId, name>` a `Map<sapCustomerCode, {name, taxId}>`.

### 2.4 `05-customer-enrichment.ts`

- Match primario por `Customer` (SAP code); fallback por VAT solo si VAT ≠ `"Not assigned"`.
- Nueva función `parseBlockedStatus(legalName)` que devuelve `{status, cleanName, blockReason, supersededBySapCode}` con un regex que cubre las variantes observadas: `BLOCKED - DUPLICADO, OK 5010xxxxxx` / `BLOCKED – ABSORBE Axxxxxxxx` / `BLOCKED IMPAGADOS dd.mm.yyyy` / `BLOCKED DIRECCION INCORRECTA` etc.
- `legal_name` se guarda limpio (sin sufijo BLOCKED).

---

## 3. Cómo verificar el estado actual

```bash
# Conectar con el usuario focus_app (password en .env o variable FOCUS_DB_PASSWORD)
mysql -u focus_app -h 127.0.0.1 focus_dev
```

```sql
-- 3.1 — Volumetría general
SELECT 'customer_master', COUNT(*) FROM CUSTOMER_MASTER         -- esperado: 271342
UNION ALL SELECT 'billing_records', COUNT(*) FROM BILLING_RECORDS  -- esperado: 935218
UNION ALL SELECT 'addresses', COUNT(*) FROM ADDRESSES              -- esperado: 134336
UNION ALL SELECT 'contacts', COUNT(*) FROM CONTACTS;               -- esperado: 69156

-- 3.2 — Integridad de identidad
SELECT COUNT(*) FROM CUSTOMER_MASTER WHERE tax_id = 'Not assigned';  -- esperado: 0
SELECT COUNT(*) FROM CUSTOMER_MASTER WHERE legal_name LIKE '%BLOCKED%'; -- esperado: 0
SELECT COUNT(*) FROM CUSTOMER_MASTER WHERE sap_customer_code IS NULL;  -- esperado: 0

-- 3.3 — El 762 ya no es Panificadora consolidada
SELECT customer_id, legal_name, tax_id, sap_customer_code
FROM CUSTOMER_MASTER WHERE customer_id = 762;
-- esperado: legal_name = 'C.P. BALANDRO, 30', tax_id = 'ESH79967832'

-- 3.4 — Top customers por nº facturas (Panificadora NO debe aparecer)
SELECT cm.customer_id, LEFT(cm.legal_name,45) AS legal, COUNT(br.billing_id) AS facturas
FROM CUSTOMER_MASTER cm JOIN BILLING_RECORDS br ON br.customer_id = cm.customer_id
GROUP BY cm.customer_id ORDER BY facturas DESC LIMIT 5;
-- esperado: 1º ARVAL ~31k · 2º AYVENS ~8.8k · 3º ATS ONLINE ~6.5k · 4º ALPHABET · 5º CARREFOUR

-- 3.5 — Distribución de status
SELECT status, COUNT(*) FROM CUSTOMER_MASTER GROUP BY status ORDER BY 2 DESC;
-- esperado:
--   ACTIVE          270353
--   BLOCKED_UNPAID    354
--   BLOCKED_DUP       343
--   BLOCKED_OTHER     292

-- 3.6 — Sucesores resueltos
SELECT COUNT(*) FROM CUSTOMER_MASTER WHERE superseded_by_sap_code IS NOT NULL;  -- esperado: 291
SELECT COUNT(*)
FROM CUSTOMER_MASTER a
JOIN CUSTOMER_MASTER b ON b.sap_customer_code = a.superseded_by_sap_code
WHERE a.superseded_by_sap_code IS NOT NULL;  -- esperado: 123 (resto referencian clientes no presentes)

-- 3.7 — Migraciones Prisma
SELECT migration_name, finished_at IS NOT NULL AS done
FROM _prisma_migrations ORDER BY started_at;
-- esperado: 4 filas, todas done=1, la última 20260528000000_customer_identity_refactor
```

**Si las 7 queries coinciden con lo esperado: nada que hacer. La BD está bien.**

---

## 4. Cómo reproducirlo desde cero (otra máquina o tras un reset)

### 4.1 Pre-requisitos

- MySQL 8.0+ corriendo, con schema `focus_dev` y usuario `focus_app` (`ALL PRIVILEGES`).
- Schema `focus_dev_shadow` también creado con grants a `focus_app` (lo usa Prisma).
- `Focus/app/.env` con `DATABASE_URL` y `SHADOW_DATABASE_URL` apuntando a esos schemas.
- Node.js v22 + `npm install` ya ejecutado en `Focus/app/`.
- Los Excel raw en sus carpetas:
  - `Focus/data/raw/DATOS_FACTURACION/ZKSD_SD14_{2019..2026}.xlsx` (8 ficheros)
  - `Focus/data/raw/CUSTOMER_LIST/*.XLSX` (7 ficheros: 8888_1..4, 0136, 9999, 0380)
  - `Focus/data/raw/CONTACTOS CRM/clientesTotales8888-validated.xlsx` y `clientesTotales9999.xlsx`
  - `Focus/data/raw/Profit centers.xls` y `Table_MATERIALS.xlsx`

### 4.2 Gotchas críticos (LÉELOS antes de ejecutar)

> ⚠️ **Prisma 7 vs agentes IA.** Estos comandos tienen un AI safeguard que rechaza cualquier acción destructiva si no hay consentimiento explícito reciente del humano:
> - `prisma migrate reset`
> - `prisma migrate deploy` (sobre BD con datos)
>
> Pasar la variable de entorno `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` con el texto literal del mensaje del humano en el que dio consentimiento, sin saltos de línea ni comillas. Ejemplo:
> ```bash
> export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Si procede"
> npx prisma migrate reset --force
> ```

> ⚠️ **Prisma 7 `migrate dev` es interactivo.** No se puede usar desde un agente. Si necesitas crear una migración NUEVA (no este refactor, que ya está en `migrations/`), el workaround es:
> ```bash
> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
>   > prisma/migrations/$(date +%Y%m%d%H%M%S)_<name>/migration.sql
> npx prisma migrate deploy
> ```

> ⚠️ **Año por defecto del seed 04.** El seed solo carga **2024-2026** por defecto (~341k facturas). Para igualar el dump v2 con 935k facturas hay que ejecutar también los 5 años antiguos manualmente, ver paso 4.3.4.

> ⚠️ **Seed 05 parece colgado pero no lo está.** Hace ~200k UPDATEs fila a fila (Prisma no tiene `updateMany` con datos distintos). Tarda 10-20 minutos sin escribir stdout intermedio. Comprobar progreso real con:
> ```sql
> SELECT COUNT(*) FROM CUSTOMER_MASTER;  -- sube desde ~169k hasta ~271k
> SELECT COUNT(*) FROM ADDRESSES;        -- sube desde 0 hasta ~134k
> ```

> ⚠️ **PowerShell 5.1 y UTF-8.** Si vas a pasar SQL al cliente de mysql via shell, NO uses pipe con `Get-Content` ni `>` para escribir output de un .exe — corrompe UTF-8 a UTF-16 con BOM. Usa redirect `<` desde **bash** (Git Bash) o `cmd /c "mysql ... < archivo.sql"`. Para `mysqldump`, siempre `--result-file=ruta.sql`.

> ⚠️ **El path correcto del dump de respaldo** es `Focus/data/dumps/mysqldump-focus-v2.sql` (no `final.sql` como dice algún sitio antiguo).

### 4.3 Procedimiento paso a paso

```bash
cd Focus/app

# 4.3.1 — Confirmar que la migración del refactor está en el árbol
ls prisma/migrations/20260528000000_customer_identity_refactor/
# Debe contener: migration.sql

# 4.3.2 — Reset completo (DESTRUCTIVO: borra focus_dev entera)
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="<texto literal del OK del humano>"
npx prisma migrate reset --force
# Aplica las 4 migraciones. Tras esto, BD vacía pero con esquema correcto.

# 4.3.3 — Regenerar Prisma Client (tipos TS actualizados)
npx prisma generate

# 4.3.4 — Seeds en orden
npm run seed                # 01 + 02 + 03 (org + catálogo + status) ~15s
npm run seed:billing        # 04 — solo 2024-2026 (~3 min, ~341k facturas)
npx tsx prisma/seeds/04-billing.ts 2019 2020 2021 2022 2023   # años antiguos (~5 min, ~594k facturas)
npm run seed:customers      # 05 — TARDA 10-20 MIN SIN STDOUT, ver gotcha arriba
npm run seed:contacts       # 06 — ~1 min
npm run seed:normalize      # 07 — ~5-10 min (también UPDATEs uno a uno)

# 4.3.5 — Validar con queries de sección 3
mysql -u focus_app -h 127.0.0.1 focus_dev < <(cat <<'EOF'
SELECT 'customer_master', COUNT(*) FROM CUSTOMER_MASTER;
SELECT 'billing_records', COUNT(*) FROM BILLING_RECORDS;
SELECT 'addresses', COUNT(*) FROM ADDRESSES;
SELECT 'contacts', COUNT(*) FROM CONTACTS;
SELECT COUNT(*) FROM CUSTOMER_MASTER WHERE tax_id = 'Not assigned';
SELECT COUNT(*) FROM CUSTOMER_MASTER WHERE legal_name LIKE '%BLOCKED%';
EOF
)
```

**Tiempo total esperado:** 25-40 min en hardware tipo portátil Juri.

---

## 5. Impacto en la app (Next.js)

- **Dashboards y rankings**: filtrar `WHERE status = 'ACTIVE'` por defecto. Los componentes que listan top customers van a cambiar de valores reales; revisarlos.
- **Buscador 360**: mostrar todos los estados con badge (`ACTIVE` verde, `BLOCKED_*` rojo/ámbar). Para `BLOCKED_DUP`, enlace al sucesor (`supersededBySapCode` → lookup → ficha del cliente OK).
- **Tipos TS**: tras el reseed, `CustomerMaster.taxId` ya es `string | null` en `node_modules/@prisma/client`. Los componentes que asumían `string` deben adaptarse.
- **Customers duplicados por SAP code legítimos**: en el top 5 aparecen DOS entradas de "FORD ESPAÑA, S.L." (`customer_id` 48 y 2290). No es un bug: SAP asigna varios `Customer` distintos al mismo CIF (cuentas internas por departamento). El modelo nuevo respeta esa multiplicidad. Si el negocio quiere consolidar para reporting, hacerlo en una vista agregada por `tax_id`.

---

## 6. Lo que sigue pendiente (futuro, fuera de este refactor)

- **Holdings** (`CORPORATE_HOLDINGS`): tabla vacía. Pendiente fuente TÜV.
- **CNAE** (`CNAE_CATALOG`, `CUSTOMER_CNAE`): sin datos. Necesita INE CNAE 2009.
- **Decisión de negocio sobre los 989 BLOCKED**: actualmente se conservan con `status` y `block_reason`. Si en algún momento el negocio quiere "ocultarlos del todo" para Buscador 360 o reporting, basta con un filtro en la capa de queries.
- **291 sucesores con `superseded_by_sap_code` pero sin cliente target en BD**: el código SAP del sucesor existe en SAP pero no se cargó en CUSTOMER_LIST (porque vive en una entidad legal no incluida en los 7 ficheros de raw, o porque se eliminó). Sin acción necesaria.

---

## 7. Referencias

- **Estado del proyecto y BD local:** memoria `project_mysql_local.md`.
- **Problema original documentado:** memoria `project_focus_data_quality.md`.
- **Schema canónico:** [`app/prisma/schema.prisma`](../../app/prisma/schema.prisma).
- **Migración SQL:** [`app/prisma/migrations/20260528000000_customer_identity_refactor/migration.sql`](../../app/prisma/migrations/20260528000000_customer_identity_refactor/migration.sql).
- **Seeds afectados:** [`03-status-catalog.ts`](../../app/prisma/seeds/03-status-catalog.ts), [`04-billing.ts`](../../app/prisma/seeds/04-billing.ts), [`05-customer-enrichment.ts`](../../app/prisma/seeds/05-customer-enrichment.ts).
- **Dump de respaldo del estado pre-refactor:** `Focus/data/dumps/mysqldump-focus-v2.sql` (243 MB, UTF-8 correcto).
