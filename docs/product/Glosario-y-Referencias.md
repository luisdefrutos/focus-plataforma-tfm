# Glosario y Referencias

## Glosario del dominio

| Término | Significado |
|---|---|
| **Golden Record** | Identidad única de cliente. En Focus opera en dos niveles: registro SAP (`CUSTOMER_MASTER`) y organización por CIF (`ORGANIZATIONS`). |
| **CIF / NIF / `tax_id`** | Identificador fiscal de la empresa. En `ORGANIZATIONS` se guarda normalizado **sin** el prefijo `ES` (convención `normCif`). |
| **`sap_customer_code`** | Código de cliente en SAP. Identidad **fuerte** de `CUSTOMER_MASTER`. |
| **Sociedad / Legal Entity** | Empresa del grupo (códigos SAP `8888`, `0136`, `9999`…). **No** es una BU. |
| **División** | Nivel intermedio de la jerarquía SAP (II, MO, NGB, BA, PS). |
| **BU (Business Unit)** | Unidad de negocio funcional. En el modelo es la **instancia** sociedad × BU (`BUSINESS_UNITS`). |
| **Profit Center** | Unidad operativa / oficina geográfica. No es tabla en v1; vive como columna en `BILLING_RECORDS`. |
| **Whitespot** | Hueco de venta: combinación cliente × sociedad/BU/servicio donde **no** hay facturación = oportunidad de cross-sell. |
| **Gemelos T7** | ~27,7k pares de registros del mismo cliente con código `T75xxxx` (ZKSD) y `5xxxx` (CUSTOMER_LIST). |
| **CNAE** | Clasificación Nacional de Actividades Económicas (sector). 88 divisiones CNAE-2009 + `999` sin clasificar. |
| **Incompatibilidad TOTAL / PARCIAL** | Conflicto legal entre servicios. TOTAL excluye la organización; PARCIAL solo marca la fila. |
| **GESAP** | Equipos a presión. Dos fuentes: `GESAP_TSA` (INSPECCION_SA `8888`) y `GESAP_TSI` (TÜV LFD Iberia `9999`). |
| **RAE** | Registro oficial de ascensores; parte de la identidad del activo `ASCENSOR`. |
| **`reg_code` sintético** | HASH determinista usado como identidad de activos sin registro oficial (AT/BT/GESAP). |
| **RLS** | Row-Level Security (alcance por usuario). **Desactivado** de facto en Focus. |
| **`IAM_MANAGE`** | Único permiso comprobado en código (gestión de accesos + auditoría). |
| **ZKSD / `ZKSD_SD14`** | Transacción/extracto SAP de facturación, fuente del seed 04. |
| **`passport`** | Parámetro del web service de AD: `MD5(user + AD_SOAP_LDAP_KEY)`. |
| **Algorithm** | Nombre del design system corporativo (`@tuvsud/design-system`). |

## Códigos de sociedad SAP

| Código | Sociedad | Estado en Focus |
|---|---|---|
| `8888` | INSPECCION_SA | Activa |
| `0136` | — | Activa |
| `9999` | TÜV LFD Iberia | Activa |
| `0380` | — | Activa |
| `0359` | Swissi España | **Excluida** (sin facturación cargada) |
| `0442` | CTVA Ingeniería | **Excluida** (sin facturación cargada) |
| `K999` | Konsolidierung | **Excluida** (consolidación contable) |

## Documentos del repositorio

### Fuente de verdad
- **`app/prisma/schema.prisma`** — esquema canónico (25 tablas).
- **`CLAUDE.md`** (raíz) — guía operativa detallada del estado actual.
- **`README.md`** (raíz) — portada del repo.

### Onboarding y diseño
- `docs/OnBoarding/` — overview técnico-funcional y changelog *(documentos internos, no incluidos en este repositorio público)*.
- `docs/data-cleanup/REFACTOR_CUSTOMER_IDENTITY.md` — refactor de identidad de cliente *(interno)*.

### Seguridad
- `docs/security/AUDITORIA_SEGURIDAD_2026-06-22.md` — informe de auditoría completo *(interno, disponible bajo solicitud al autor)*.

### Diagramas (`docs/diagrams/`)
- `DIAGRAMA_ER_COMPLETO.md` — ERD Completo de 25 tablas (Mermaid).
- `Mapa Mental Proyecto Focus.png` — mapa mental del proyecto.

### Histórico (referencia, NO vigente)
- `docs/v2-standardized/` — diseño del modelo de 19 tablas (abril 2026). Útil por el diccionario de datos y los ERD, pero describe módulos no implementados (Exclusiones, Campañas). Lleva nota de vigencia en cabecera.
- `docs/v1-legacy/` — modelo v1 de 10 tablas, archivado.
- `db/legacy-oracle/` — DDL Oracle de referencia. **No** ejecutar contra MySQL.

### Material ejecutivo (`docs/executive/`)
- `Briefing Ejecutivo Proyecto Focus.docx`, `Focus_Strategic_Intelligence.pptx` — material de dirección (parcialmente fuera de git).

> ⚠️ `docs/executive/backfill_cif_recuperado.csv` contiene **PII** (CIF reales). Está gitignoreado; pendiente de borrar/mover (ver [Seguridad](../architecture/Seguridad.md)).

## Recursos externos

- **Repositorio GitHub (público):** `https://github.com/luisdefrutos/focus-plataforma-tfm`
- **Repositorio Azure DevOps (privado interno TÜV):** `https://dev.azure.com/tuvsud01/Focus/_git/Focus` — rama `main`.
- **Skill `tuvsud-algorithm`**: ayuda para construir UI con el design system corporativo.

---

*Esta wiki es la fuente de verdad consolidada del proyecto Focus. Mantenla actualizada cuando cambien el modelo, los seeds o el despliegue.*
