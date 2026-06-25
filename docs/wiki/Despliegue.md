# Despliegue a Producción

> Documentación del despliegue inicial a producción (≈24-jun-2026). Datos de infraestructura para uso **interno**.

## Servidor de producción

| Recurso | Valor |
|---|---|
| Host | `sesmade77033.tuv-sud.es` (`10.108.0.32`) |
| Base de datos | `focus_db` |
| Motor | **MySQL 8.4.9 sobre Linux** |
| Usuarios admin | `uriza-jo@%`, `defru-li@%` (`GRANT ALL ON focus_db.*`) |
| Usuario de la app | `focus-fu@localhost` (solo DML: SELECT/INSERT/UPDATE/DELETE) |

> ⚠️ Como `focus-fu` está restringido a **`localhost`**, **la app tiene que correr en el propio servidor**. Ojo: con el adapter MariaDB, `localhost` ≠ `127.0.0.1`.

## ⚠️ Gotcha crítico: casing Windows → Linux

Producción (Linux) arrancó con `lower_case_table_names=0` (**case-sensitive**), pero todo el toolchain se construyó en Windows (`=1`, **insensible**). Las migraciones mezclan casing (`CONTACTS` vs `contacts`) → en Linux fallan con **P3018** (`Table 'focus_db.contacts' doesn't exist`). El `mysqldump` de dev también saldría en minúsculas y fallaría igual.

**Decisión**: pedir a infra **`lower_case_table_names=1` + reinicializar** el servidor (este parámetro solo se fija en el *init* de MySQL 8; reinit borra los usuarios → hay que recrearlos). Así prod = dev y migraciones + dump funcionan tal cual, **sin tocar código**.

## Método de migración dev → prod

Se hace una **copia exacta, NO un re-seed**, porque dev tiene operaciones manuales **no reproducibles** (borrado pre-2021, backfill de `tax_id`, curado de gemelos T7).

### 1. Esquema

```bash
npx prisma migrate deploy        # NO migrate dev: focus_db ya existe y no hay shadow
```

Se ejecuta con **`uriza-jo`** (DDL/admin), **no** con `focus-fu`.

### 2. Datos

`mysqldump` de dev con estas opciones, **excluyendo** `_prisma_migrations` y las 2 tablas de backup (`billing_records_bak_pre2021`, `customer_master_bak_20260603`). **Incluir** `audit_events`:

```bash
mysqldump --single-transaction --no-create-info --complete-insert --no-tablespaces \
  focus_dev <tablas...> > focus_data.sql
```

La carga también con `uriza-jo`. Binarios `mysql`/`mysqldump` en `C:\Program Files\MySQL\MySQL Server 8.0\bin\` (no están en el PATH).

### 3. Verificación (conteos exactos de dev)

| Tabla | Filas |
|---|---|
| `billing_records` | 722.056 |
| `customer_master` | 271.342 |
| `organizations` | 210.789 |
| `inspections` | 185.680 |
| `assets` | 170.708 |
| `addresses` | 134.336 |
| `contacts` | 67.502 |

(25 tablas reales en total.)

## Checklist de operaciones (seguridad)

Antes de dar por bueno el despliegue, completa las **acciones operativas** de [Seguridad](/Seguridad):

- [ ] `lower_case_table_names=1` en el servidor MySQL de prod (reinit + recrear usuarios).
- [ ] `DATABASE_SSL=true` (si no, `prisma.ts` lanza para hosts remotos).
- [ ] `TRUSTED_PROXY_HOPS=<nº proxies>` (IP fiable en auditoría).
- [ ] `NEXTAUTH_SECRET` y `AD_SOAP_LDAP_KEY` configuradas en el entorno de prod.
- [ ] **NO** definir `AUTH_ALLOW_MOCK` en prod (riesgo A-1).
- [ ] **Reiniciar** el servidor para cargar las cabeceras de seguridad (`next.config.ts` no se recarga en caliente; verificar con `curl -I /login`).
- [ ] Rotar la contraseña de `focus_app` y purgar el historial git (ver [Seguridad](/Seguridad)).

## Acceso de solo lectura a prod (MCP)

Para consultar prod en modo **solo lectura** hay un servidor MCP `mysql-focus-prod` (en `.mcp.json`, gitignored) vía **DBHub** con `--config=dbhub.prod.toml` (también gitignored; lleva hostname + usuario). El modo readonly de DBHub se activa **solo** por TOML (`[[tools]] name="execute_sql" readonly=true`). La contraseña se interpola desde la variable de usuario `FOCUS_PROD_DB_PASSWORD` (nunca se imprime).

> **Siguiente**: [Decisiones de Diseño](/Decisiones-de-Diseno) — el porqué de todo esto.
