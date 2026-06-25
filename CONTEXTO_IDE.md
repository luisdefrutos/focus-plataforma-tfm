# CONTEXTO DEL PROYECTO — Para el IDE / Agente de IA
## Proyecto FOCUS · PC Personal · Curso

> **Léeme primero.** Este documento da contexto completo al IDE/agente de IA que uses en tu PC personal para que entienda el estado del proyecto, qué se puede hacer, qué no, y cuál es el plan a seguir.

---

## 🎯 QUÉ ES ESTE PROYECTO

**FOCUS** es una plataforma web de inteligencia comercial desarrollada en Next.js 16 + MySQL. Centraliza y cruza datos de clientes de una empresa del sector de inspección técnica para:

- Buscar clientes con filtros avanzados (Buscador 360)
- Detectar oportunidades de venta cruzada (Matriz de Oportunidades)
- Analizar el ciclo de vida de la cartera (Dashboard ejecutivo)
- Gestionar usuarios y permisos (IAM)
- Registrar toda la actividad (Auditoría)

El proyecto se usa como **Trabajo Final de Máster (TFM)** en un curso de IA/Desarrollo. El alumno es **Luis de Frutos**.

---

## 📂 ESTADO DEL REPOSITORIO (exportado el 25-jun-2026)

### Stack técnico
- **Frontend:** Next.js 16.2.6 (App Router), React 19, TypeScript strict
- **ORM:** Prisma 7.8 con adapter MariaDB → MySQL 8
- **Auth:** NextAuth v4 (JWT), login contra AD vía SOAP (mock activado en local)
- **UI:** `@tuvsud/design-system` + Tailwind 4 + TanStack Table + Recharts
- **Tests:** Vitest 4.1.9 — 24 tests, ~98% cobertura en módulos testeados
- **CI/CD:** `azure-pipelines.yml` (preparado, sin agente activo — ver más abajo)

### Páginas disponibles (`app/src/app/(dashboard)/`)
| Ruta | Descripción |
|---|---|
| `/dashboard` | KPIs de ciclo de vida de cartera (Fieles/Nuevos/Recuperados/Perdidos + Pareto) |
| `/clientes` | Buscador 360 con filtros + export CSV completo |
| `/oportunidades` | Matriz cliente × servicio con export CSV |
| `/clientes/[id]` | Ficha 360 del cliente (whitespots, contactos, facturas) |
| `/segmentacion` | Segmentación de cartera |
| `/top-clientes` | Ranking por facturación |
| `/catalogo` | Catálogo de servicios con incompatibilidades legales |
| `/accesos` | Gestión IAM de usuarios y roles (solo `IAM_MANAGE`) |
| `/auditoria` | Registro de actividad (solo `IAM_MANAGE`) |

### Migraciones de BD (10 en total, todas aplicadas)
```
20260522065740_init
20260522085551_customer_enrichment_and_contact_relaxation
20260522122052_contact_rgpd_fields
20260528000000_customer_identity_refactor
20260604094913_iam_module
20260605100000_add_allowed_filters
20260610000000_db_push_catchup
20260611130000_service_incompatibilities
20260615000000_drop_redundant_billing_indexes
20260622000000_add_audit_events          ← última, incluye tabla AUDIT_EVENTS
```

---

## ⚠️ SITUACIÓN LEGAL Y DE DATOS — MUY IMPORTANTE

### El dump de la BD tiene datos reales

El fichero `app/scripts/mysqldump-focus-completo-25jun2026.sql` contiene datos reales de empresa protegidos por RGPD:

| Tabla | Dato real que contiene |
|---|---|
| `CUSTOMER_MASTER` | Nombres de empresas reales, CIFs/NIFs |
| `BILLING_RECORDS` | Facturación real (importes, fechas, nº factura) |
| `CONTACTS` | Nombres de personas, emails, teléfonos |
| `ORGANIZATIONS` | CIFs reales |
| `APP_USERS` | Usuarios reales de la empresa |

**Reglas estrictas:**
- ✅ El dump se puede usar en local en tu PC personal para desarrollo
- ❌ NUNCA subir el dump a GitHub (público ni privado)
- ❌ NUNCA subir los Excel originales a GitHub
- ❌ NUNCA usar datos reales en Vercel o cualquier plataforma pública

### El código tiene referencias a TÜV LFD

El paquete `@tuvsud/design-system` es privado de la empresa. Las referencias que hay que eliminar antes de GitHub:
- El paquete `@tuvsud/design-system` en `package.json` → sustituir por componentes open source
- Texto "TÜV LFD" en cualquier fichero de `docs/` → sustituir por "empresa de inspección técnica"
- El logo `app/public/focus-logo.svg` → sustituir por logo nuevo (ver carpeta `NUEVO_LOGO/`)
- Referencias a `tuvsud01` (Azure DevOps) en `azure-pipelines.yml` → solo relevante si hay pipeline

---

## 🗺️ PLAN DE TRABAJO EN ESTE PC PERSONAL

### Fase actual: DESARROLLO LOCAL (con datos reales, solo en este PC)

```
Estado: empezando desde cero en PC personal
Objetivo inmediato: hacer funcionar la app en local

Pasos:
1. ✅ Instalar Node.js, Git, MySQL 8
2. ✅ Crear BD focus_dev + usuario focus_app
3. ✅ Restaurar dump real (focus_dev ← mysqldump-focus-completo-25jun2026.sql)
4. ✅ Crear .env (ver abajo)
5. ✅ npm install → npx prisma generate → npm run dev
6. ✅ Verificar: 24 tests en verde (npm test)
```

### Fase siguiente: ANONIMIZACIÓN (antes de GitHub/Vercel)

```
Objetivo: reemplazar todos los datos reales por datos ficticios

Plan de anonimización:
1. Crear script  app/scripts/anonymize-db.ts  con @faker-js/faker
   - CUSTOMER_MASTER: legalName → faker.company.name(), taxId → CIF ficticio
   - BILLING_RECORDS: invoiceAmount → valor aleatorio en rango realista
   - CONTACTS: fullName/email/phone → faker.*
   - ORGANIZATIONS: legalName/taxId → ficticios
   - APP_USERS: mantener estructura, anonimizar nombres reales

2. Ejecutar el script contra la BD local

3. Hacer un dump de la BD anonimizada:
   mysqldump focus_dev > mysqldump-ANONIMIZADO.sql

4. Ese dump anonimizado es el que va a Vercel y al repo del curso
```

### Fase final: GITHUB + VERCEL

```
Objetivo: proyecto público limpio para el curso

1. Crear repo GitHub nuevo (sin historial de empresa)
   git init → commit inicial → git push

2. Sustituir @tuvsud/design-system por componentes open source

3. Nuevo logo (sin referencias legales a TÜV LFD)

4. README académico con tu nombre como autor

5. Vercel: conectar repo GitHub → configurar vars de entorno → deploy

6. BD en la nube: Railway (MySQL gratis) con el dump anonimizado
```

---

## 🔧 CONFIGURACIÓN LOCAL — `.env` que necesitas

Crea `app/.env` con este contenido exacto:

```env
DATABASE_URL="mysql://focus_app:Focus2026%21@localhost:3306/focus_dev?connection_limit=30"
SHADOW_DATABASE_URL="mysql://focus_app:Focus2026%21@localhost:3306/focus_dev_shadow"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="focus-curso-personal-2026-secret-abc123"
AUTH_ALLOW_MOCK="true"
```

> `AUTH_ALLOW_MOCK="true"` es imprescindible en el PC personal: permite entrar sin el Active Directory de la empresa. Puedes poner cualquier contraseña en el login.

> `%21` es el `!` URL-encodeado. Si cambias la contraseña de MySQL, URL-encódela en urlencoder.org.

---

## 🧪 TESTS — Cómo correrlos y qué cubren

```bash
cd app/
npm test                    # 24 tests, pasan en ~270ms
npm run test:watch          # modo watch mientras desarrollas
npm run test:coverage       # + informe de cobertura HTML
```

| Fichero de test | Qué cubre |
|---|---|
| `src/lib/sql.test.ts` | `escapeLike()` — evita inyección SQL en búsquedas LIKE |
| `src/lib/csv.test.ts` | `csvCell()` — anti-inyección de fórmulas en exports CSV |
| `src/lib/username.test.ts` | `normalizeUsername()` — sAMAccountName del AD |
| `src/lib/spain.test.ts` | `pc2CodesForProvince()`, `classifyEntity()` — CIFs y CP |

---

## 🏗️ CI/CD — Por qué no funciona y cómo simularlo

El fichero `azure-pipelines.yml` (raíz del proyecto) es un pipeline de Azure DevOps **completamente implementado** pero que no se puede ejecutar porque:

1. Requiere un agente de build de Azure DevOps (la empresa aún no tiene uno asignado)
2. Autentica contra un feed privado de npm (`@tuvsud`) inaccesible desde fuera

**Equivalente local del pipeline** (lo que haría el CI si funcionara):

```bash
cd app/
npx prisma generate          # Genera el cliente Prisma
npx prisma validate          # Valida el schema
npx tsc --noEmit             # Verifica tipos TypeScript (0 errores)
npm run lint                  # ESLint (0 errores en main)
npm run test:coverage         # 24/24 tests en verde
npm audit                     # Auditoría de vulnerabilidades (informativo)
```

Si los 6 pasos pasan en verde, el código pasaría el pipeline real.

---

## 📋 CONVENCIONES DEL CÓDIGO

- **Queries a la BD:** siempre en `app/src/lib/queries/`
- **Caché:** `nativeCached()` con tag. Invalidar con `POST /api/revalidate`
- **RLS (Row Level Security):** app-side. Las queries reciben `buIds` y `allowedFilters`
- **Migraciones:** siempre con `npx prisma migrate deploy` (NUNCA `migrate dev` — detecta tablas de backup y propone reset)
- **Seeds:** ejecutar en orden de dependencia (ver `docs/wiki/Pipeline-de-Datos.md`)

### Tablas de backup en la BD (no borrar, no migrar):
- `customer_master_bak_20260603` — backup manual, no es parte del schema
- `billing_records_bak_pre2021` — registros pre-2021 retirados (no reproducibles por seed)

---

## 📚 DOCUMENTACIÓN DISPONIBLE

| Documento | Dónde está | Para qué |
|---|---|---|
| Esta guía de contexto | `CONTEXTO_IDE.md` (raíz del export) | Contexto para el IDE/agente |
| Guía de instalación completa | `GUIA_INSTALACION_Y_CURSO.md` | Paso a paso desde el USB |
| Wiki técnica (14 páginas) | `docs/wiki/` | Referencia técnica completa |
| Handoff de cambios jun-2026 | `docs/OnBoarding/Focus_Cambios_Recientes_2026-06.md` | Qué cambió y en qué estado |
| Overview técnico completo | `docs/OnBoarding/Focus_Technical_and_Functional_Overview.md` | Arquitectura y módulos |
| Auditoría de seguridad | `docs/security/AUDITORIA_SEGURIDAD_2026-06-22.md` | Hallazgos y mitigaciones |
| Migración IAM | `app/docs/MIGRACION_IAM_FILTROS_SESION.md` | Cambios en el sistema IAM |

---

## 🆘 PROBLEMAS MÁS FRECUENTES

| Error | Causa | Solución |
|---|---|---|
| Login: "No se pudo contactar el directorio" | AD de empresa no accesible | Verifica `AUTH_ALLOW_MOCK="true"` en `.env` |
| `prisma.auditEvent` is undefined | Cliente Prisma desactualizado | `npx prisma generate` |
| `npm install` falla en `@tuvsud/design-system` | Paquete privado de empresa | Sustituirlo (ver plan de anonimización) |
| `prisma migrate dev` quiere hacer reset | Detecta tablas de backup como drift | Usa siempre `npx prisma migrate deploy` |
| El dashboard no muestra datos | `PRESENTATION_MOCKUP = true` | Ya corregido en este export (`= false`) |
| Seed falla leyendo un `.xlsx` | El fichero está abierto en Excel | Ciérralo y re-ejecuta |

---

*Documento generado el 25 de junio de 2026 — sincronizado con el export del mismo día.*
