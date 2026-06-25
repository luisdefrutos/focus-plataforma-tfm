# Migraciones de Base de Datos

Las migraciones viven en `app/prisma/migrations/`. Hay **10 migraciones**, de `20260522065740_init` a `20260622000000_add_audit_events`.

## Las 10 migraciones

| Migración | Qué hace |
|---|---|
| `…_init` | Crea el esquema base. Crea `` `CONTACTS` `` en **mayúsculas** (coincide con `@@map`). |
| *(intermedias)* | Evolución del esquema (algunos `ALTER TABLE` en minúsculas — ver gotcha de casing abajo). |
| `db_push_catchup` (10-jun-2026) | Formaliza lo que se había aplicado con `prisma db push` sin migrar: el módulo de **inspecciones** + `BILLING_RECORDS.sales_order_number`. Verificada aplicando las migraciones sobre una BD vacía. |
| `service_incompatibilities` (11-jun-2026) | Crea `SERVICE_INCOMPATIBILITIES`. |
| `drop_redundant_billing_indexes` (15-jun-2026) | Elimina 3 índices de `BILLING_RECORDS`: `customer_id` y `bu_id` (redundantes — son prefijo de `idx_br_cust_agg` / `idx_br_bu_agg`) y `expiry_date` (columna 100% NULL). |
| `add_audit_events` (22-jun-2026) | Crea `AUDIT_EVENTS` (FK a `APP_USERS` con `ON DELETE SET NULL`). |

Un despliegue limpio con `prisma migrate deploy` reconstruye el esquema completo (25 tablas).

## Convención: aplicar a mano + `resolve --applied`

Varias migraciones recientes (`service_incompatibilities`, `drop_redundant_billing_indexes`, `add_audit_events`) se aplicaron **manualmente** (DDL a mano vía el MCP de MySQL) y luego se registraron con:

```bash
npx prisma migrate resolve --applied <nombre_migracion>
```

**¿Por qué a mano y no `migrate dev`?** Porque en `focus_dev` **no se puede usar `prisma migrate dev`**: detectaría las **tablas de backup ajenas** al esquema como *drift* y propondría un **reset** (que borraría datos). Tras aplicar y resolver, `npx prisma migrate status` queda limpio.

## Tablas de backup que NO van al esquema

`focus_dev` conserva tablas de backup manuales **ajenas al esquema de Prisma**:

- `customer_master_bak_20260603`
- `billing_records_bak_pre2021` — las 213.162 filas de facturación 2018-2020 retiradas el 15-jun-2026.

Restaurar el histórico pre-2021 (si hiciera falta):

```sql
INSERT INTO billing_records SELECT * FROM billing_records_bak_pre2021;
```

> ⚠️ Un `migrate diff` marca estas tablas como sobrantes. **No las incluyas en migraciones ni las borres** sin confirmarlo con el responsable del proyecto.

## Gotcha de case-sensitivity (Windows → Linux)

Las 10 migraciones **mezclan el casing** de los nombres de tabla: `init` crea `` `CONTACTS` `` (mayúsculas), pero migraciones posteriores hacen `` ALTER TABLE `contacts` `` (minúsculas).

- En **Windows** (MySQL con `lower_case_table_names=1`, **insensible** a mayúsculas) funciona sin problema.
- En **Linux** con `lower_case_table_names=0` (**sensible**), falla con `Table 'focus_db.contacts' doesn't exist` (error **P3018**).

La solución adoptada para producción es alinear el servidor Linux con dev (`lower_case_table_names=1`). El detalle está en [Despliegue](/Despliegue).

> **Siguiente**: [Despliegue](/Despliegue) — llevar esto a producción.
