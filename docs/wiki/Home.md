# Wiki del Proyecto Focus

Bienvenido/a a la documentación de **Focus**, la Plataforma de Inteligencia Estratégica de TÜV LFD España. Esta wiki está pensada para que **cualquier persona que llegue nueva** entienda *qué es* Focus, *cómo está construido* y *cómo operarlo* — desde cero.

> **En una frase:** Focus sustituye un informe de Power BI de 108 MB por una aplicación web (Next.js + MySQL) con un **Golden Record** de clientes, análisis de cartera y venta cruzada, y un módulo de activos e inspecciones reglamentarias.

---

## ¿Por dónde empiezo?

| Si eres... | Empieza por |
|---|---|
| **Nuevo en el proyecto** | [Visión General](/Vision-General) → [Arquitectura](/Arquitectura) |
| **Desarrollador/a** que va a tocar código | [Arquitectura](/Arquitectura) → [Puesta en Marcha Local](/Puesta-en-Marcha-Local) → [Modelo de Datos](/Modelo-de-Datos) |
| **Encargado/a de datos / ETL** | [Modelo de Datos](/Modelo-de-Datos) → [Pipeline de Datos](/Pipeline-de-Datos) |
| **Responsable de despliegue / infra** | [Despliegue](/Despliegue) → [CI/CD](/CI-CD) → [Migraciones de Base de Datos](/Migraciones-de-Base-de-Datos) → [Seguridad](/Seguridad) |
| **Dirección / negocio** | [Visión General](/Vision-General) → [Funcionalidades](/Funcionalidades) |

---

## Mapa de la wiki

1. **[Visión General](/Vision-General)** — Qué es Focus, el problema de negocio, la solución (Golden Record), a quién sirve.
2. **[Arquitectura](/Arquitectura)** — Stack tecnológico, capas, estructura de carpetas, caché y decisiones clave.
3. **[Modelo de Datos](/Modelo-de-Datos)** — Las 25 tablas en 7 módulos, convenciones de esquema, jerarquía de sociedades, identidad de cliente e incompatibilidades.
4. **[Pipeline de Datos](/Pipeline-de-Datos)** — Fuentes en `data/raw/`, los seeds 01–18, orden de carga y ETL.
5. **[Funcionalidades](/Funcionalidades)** — Cada pantalla de la aplicación en detalle.
6. **[Autenticación](/Autenticacion)** — Login contra Active Directory por SOAP, JWT, middleware y RLS.
7. **[IAM y Auditoría](/IAM-y-Auditoria)** — Roles, permisos, gestión de accesos y registro de actividad.
8. **[Seguridad](/Seguridad)** — Postura de seguridad, auditoría y acciones operativas pendientes.
9. **[Puesta en Marcha Local](/Puesta-en-Marcha-Local)** — Requisitos, `.env`, instalación, base de datos y arranque.
10. **[Migraciones de Base de Datos](/Migraciones-de-Base-de-Datos)** — Las 10 migraciones y cómo se gestionan.
11. **[Despliegue](/Despliegue)** — Servidor de producción, método dev→prod y checklist de operaciones.
12. **[CI/CD](/CI-CD)** — Pipelines de Azure DevOps: validación de código (test) y roadmap de despliegue.
13. **[Decisiones de Diseño](/Decisiones-de-Diseno)** — El *por qué* de las decisiones técnicas (ADR).
14. **[Glosario y Referencias](/Glosario-y-Referencias)** — Términos del dominio y enlaces a documentos históricos.

---

## Datos rápidos del proyecto

| Dato | Valor |
|---|---|
| Aplicación | `app/` — Next.js 16.2.6 (App Router, TypeScript strict) |
| Base de datos | MySQL 8 · esquema canónico en `app/prisma/schema.prisma` (25 tablas) |
| ORM | Prisma 7.8 con adapter `@prisma/adapter-mariadb` |
| Autenticación | next-auth v4 (JWT) contra Active Directory por SOAP |
| Design system | `@tuvsud/design-system` "Algorithm" (web components `ts-*`) |
| Repositorio | Azure DevOps `dev.azure.com/tuvsud01/Focus`, rama `main` |
| Facturación cargada | 2021–2026 |
| Tests | Sin suite todavía |

---

## Convenciones de esta wiki

- **Idioma**: español. Es el idioma de trabajo del proyecto.
- Los nombres de fichero usan guiones (Azure DevOps los muestra como espacios en el árbol). Los títulos con tildes están en el encabezado `#` de cada página.
- Las rutas de código se citan como `app/src/lib/auth.ts` para que puedas localizarlas en el repo.
- Esta wiki es la **fuente de verdad consolidada**. Los documentos en `docs/v1-legacy/` y `docs/v2-standardized/` se conservan como **histórico** (ver [Glosario y Referencias](/Glosario-y-Referencias)).
