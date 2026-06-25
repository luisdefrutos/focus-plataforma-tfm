# Visión General

## El problema de negocio

TÜV LFD España opera a través de **varias sociedades legales** (entidades del grupo) y **divisiones**. Cada sociedad factura en SAP de forma independiente, así que **un mismo cliente real podía aparecer duplicado** con distintos códigos de cliente SAP y, a veces, sin un CIF consistente.

El seguimiento comercial se hacía con un informe de **Power BI de 108 MB** (`CLIENTES v3.6 Essentials.pbix`): pesado de abrir, lento de filtrar y sin una identidad de cliente unificada. No permitía responder con agilidad preguntas como *"¿cuánto nos factura este grupo empresarial en total, sumando todas las sociedades?"* o *"¿a qué clientes de la BU X no les vendemos el servicio Y?"*.

## La solución: el Golden Record

Focus es una **aplicación web** que reconstruye esos datos sobre una base limpia. Su pieza central es el **Golden Record** — una identidad única por cliente — que funciona en **dos niveles**:

1. **`CUSTOMER_MASTER`** — cada registro de cliente SAP, con su identidad fuerte `sap_customer_code`. El CIF (`tax_id`) es un atributo que puede faltar.
2. **`ORGANIZATIONS`** — agrupa los N registros SAP de una misma entidad real **deduplicando por CIF/NIF normalizado**. Es el Golden Record "de verdad": una organización por cada CIF válido (~244k organizaciones).

Sobre esa base, Focus ofrece (ver [Funcionalidades](/Funcionalidades) para el detalle):

- **Visión 360º del cliente** — un buscador con filtros server-side, agrupación por Golden Record (por CIF o por registro SAP), export CSV y ficha de detalle con facturación histórica, contactos y direcciones.
- **Análisis de whitespots** — venta cruzada *manual*: cruza la cartera filtrada contra todas las sociedades/BUs del grupo y muestra **dónde no hay facturación** (oportunidad de cross-sell). *(El motor automático de oportunidades existió y se desactivó por decisión de producto.)*
- **Incompatibilidades legales de servicios** — al filtrar por un material, excluye o marca organizaciones que ya facturan servicios legalmente incompatibles (matriz de conflictos OC).
- **Módulos analíticos** — Dashboard ejecutivo, Segmentación por buckets, Top Clientes, Catálogo de servicios.
- **Activos inspeccionables** — instalaciones e inspecciones reglamentarias con caducidad (ascensores, alta/baja tensión, equipos a presión). De momento es capa de datos, sin pantalla propia.
- **Control de accesos (IAM)** y **registro de auditoría**.

## ¿A quién sirve Focus?

- **Equipos comerciales / de negocio**: visión unificada de clientes, cartera y oportunidades de venta cruzada.
- **Dirección**: KPIs y facturación histórica en el dashboard.
- **Administradores**: gestión de accesos y trazabilidad mediante el registro de auditoría.

## De dónde salen los datos

Focus **no** se conecta en vivo a SAP. Se alimenta de **extractos en Excel** que viven en `data/raw/` (no versionados) y se cargan mediante *seeds* (scripts de ETL). Las fuentes principales:

- **Facturación**: `DATOS_FACTURACION/ZKSD_SD14_YYYY.xlsx` (extracto SAP por año).
- **Maestro de clientes**: `CUSTOMER_LIST/*.XLSX` (uno por sociedad).
- **Jerarquía organizativa**: `Profit centers.xls` (en realidad un MHTML).
- **Catálogo de servicios**: `Table_MATERIALS.xlsx`.
- **Contactos**: `CONTACTOS CRM/CONTACTOS_CRM.xlsx`.
- **Inspecciones**: `Inspecciones_*.xlsx` (5 fuentes técnicas).
- **Incompatibilidades**: `Matriz de conflictos TSA-TSI OC.xlsx`.

El detalle de cada fuente y su carga está en [Pipeline de Datos](/Pipeline-de-Datos).

## Historia breve

- Nació como **proyecto de arquitectura de datos** para TÜV LFD España (modelo de datos, ETL en Python).
- Evolucionó a **aplicación web** (la lógica del ETL Python se portó a seeds Node/TypeScript).
- El planteamiento inicial (shadcn/ui + Tremor, modelo de 19 tablas) se reemplazó antes de programar por el stack actual (design system corporativo, 25 tablas). Ver [Decisiones de Diseño](/Decisiones-de-Diseno).

> **Siguiente**: [Arquitectura](/Arquitectura) — cómo está construido por dentro.
