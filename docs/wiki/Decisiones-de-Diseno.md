# Decisiones de Diseño (ADR)

Registro del *por qué* de las decisiones técnicas y de producto más importantes. Sirve para entender por qué Focus es como es y para no "deshacer" decisiones deliberadas por error.

---

## D-1 · Stack: Next.js 16 + Prisma 7 + MySQL, con design system corporativo

**Contexto.** El planteamiento inicial (documentado en `docs/v2-standardized/`) contemplaba **shadcn/ui + Tremor** y un modelo de 19 tablas.

**Decisión.** Antes de programar se cambió a **`@tuvsud/design-system` ("Algorithm")** —el design system corporativo oficial de TÜV LFD— sobre **Next.js 16 (App Router) + React 19 + Prisma 7 + MySQL 8**. shadcn/ui y Tremor se **descartaron**.

**Consecuencias.** La UI usa web components `ts-*` (con wrappers React); hay una skill `tuvsud-algorithm` para trabajar con ellos. El modelo creció a 25 tablas. Se gana coherencia con la identidad corporativa; se pierde algo de la agilidad de shadcn.

---

## D-2 · Prisma con adapter MariaDB (no el conector nativo)

**Decisión.** Prisma 7 con **`@prisma/adapter-mariadb`**.

**Consecuencias.** La conexión se configura en `prisma.config.ts` / `prisma.ts`, con TLS por entorno. Detalle de casing y `localhost`≠`127.0.0.1` relevante en [Despliegue](/Despliegue).

---

## D-3 · RLS (alcance por usuario) desactivado de facto

**Contexto.** El diseño original incluía Row-Level Security: cada usuario vería solo sus BUs y filtros permitidos.

**Decisión (2026-06-22).** **Todos los usuarios autenticados ven todos los datos.** `loadUserScope` concede alcance global a cualquier usuario activo. La fontanería (`buIds`, `allowedFilters`, `applyAllowedFilters`) **se conserva** por si se reintroduce.

**Por qué.** Focus es una herramienta interna de **BI de solo lectura**; el coste de mantener el scoping no compensaba. Es una decisión de **negocio**, no un fallo. Ver [Autenticación](/Autenticacion).

---

## D-4 · Motor de cross-sell automático desactivado

**Decisión (commit `cfe413e`).** El motor automático de oportunidades se **desactivó**. El análisis de whitespots es **manual** desde el Buscador 360.

**Consecuencias.** `CROSS_SELL_OPPORTUNITIES` existe pero está **vacía y sin wiring**. Los antiguos `app/scripts/engine-*.ts` ya no existen.

---

## D-5 · Identidad de cliente en dos niveles + Golden Record universal

**Decisión (refactor 2026-05-28).** `sap_customer_code` es la identidad fuerte de `CUSTOMER_MASTER`; `tax_id` es atributo nullable. El Golden Record real por CIF es **`ORGANIZATIONS`** (N registros SAP → 1 organización), universal desde el seed 15.

**Consecuencias.** Existen los "gemelos T7" (~27,7k pares con código duplicado); el seed les copia el `tax_id` para que agrupen, pero **no se fusionan** físicamente (decisión de negocio pendiente). Detalle en [Modelo de Datos](/Modelo-de-Datos) y `docs/data-cleanup/REFACTOR_CUSTOMER_IDENTITY.md`.

---

## D-6 · Retención de facturación 2021+

**Decisión (2026-06-15).** Se retiró la facturación anterior a 2021 (213.162 filas 2018-2020; backup en `billing_records_bak_pre2021`).

**Consecuencias.** Operación **manual sobre `focus_dev`, no reproducible vía seeds** (el seed 04 carga 2024-2026 por defecto). Los selectores de año son *data-driven*; único valor hardcodeado: `MIN_BILLING_YEAR=2021`. Se eliminaron además 3 índices redundantes/inútiles de `BILLING_RECORDS`.

---

## D-7 · Sociedades excluidas

**Decisión.** Se excluyen `K999` (consolidación contable) y, desde 2026-06-10, `0359` Swissi España y `0442` CTVA Ingeniería.

**Por qué.** `0359`/`0442` solo existen por histórico de facturación SAP que **no** está cargado en Focus (0 facturas aquí); aparecían como whitespots y en filtros sin sentido. Si se carga su histórico, quitar la exclusión (`EXCLUDED_COMPANIES` en `01-org-structure.ts`) y re-seedear.

---

## D-8 · IAM mínimo (1 permiso, 2 roles)

**Decisión (refactor 2026-06-22).** RBAC reducido a **1 permiso** (`IAM_MANAGE`) y **2 roles** (`ADMINISTRADOR`, `USUARIO`). Se eliminaron los roles/permisos antiguos por no comprobarse en código.

**Por qué.** Para una app de BI de solo lectura con alcance global, el RBAC complejo era deuda muerta. Ver [IAM y Auditoría](/IAM-y-Auditoria).

---

## D-9 · Auditoría append-only, sin auditar navegación

**Decisión (2026-06-22).** `AUDIT_EVENTS` registra **auth + exportaciones + administración IAM**. **No** se registra navegación, búsquedas ni apertura de fichas (descartado por volumen). Los tipos de evento son strings (ampliables sin migración).

---

## D-10 · Login contra AD por SOAP (deuda heredada asumida)

**Contexto.** El web service corporativo `LoginLDAP_AD` exige un `passport = MD5(user + clave)`.

**Decisión.** Se replica la función `Encripta()` interna. Se asume MD5 y la **dependencia de disponibilidad** del web service como limitaciones del contrato corporativo, no como decisiones nuevas.

---

## D-11 · STATUS_CATALOG: relación lógica, sin FK

**Decisión.** Los estados son enums nativos de MySQL; `STATUS_CATALOG` replica los códigos con metadatos de UI **sin FK física**. Al añadir un estado hay que tocar **ambos** (enum + fila en el catálogo).

---

## D-12 · Hallazgo A-1 (mock-mode) no corregido a propósito

**Decisión (del usuario).** `AUTH_ALLOW_MOCK` sin guarda de `NODE_ENV` **no** se corrige: ese código no estará en producción. Compensación: vigilar que la variable nunca llegue a un `.env` de prod. Ver [Seguridad](/Seguridad).

> **Siguiente**: [Glosario y Referencias](/Glosario-y-Referencias).
