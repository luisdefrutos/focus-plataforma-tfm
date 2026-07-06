# Focus — Plataforma de Inteligencia Estratégica

> **Trabajo Fin de Máster (TFM)**
> **Autor:** Luis de Frutos
> **Ámbito:** Plataforma de Arquitectura de Datos, Dato Maestro (Master Data Management) y Activación Comercial.
> **📊 Presentación Oficial (Defensa TFM):** [Descargar Presentación (.pptx)](docs/presentacion_tfm/PRESENTACION_TFM.pptx)
> **💻 Repositorio GitHub:** [https://github.com/luisdefrutos/focus-plataforma-tfm](https://github.com/luisdefrutos/focus-plataforma-tfm)
> **🌍 URL de Producción (Vercel):** [https://focus-plataforma-tfm.vercel.app](https://focus-plataforma-tfm.vercel.app)

![CI](https://github.com/luisdefrutos/focus-plataforma-tfm/actions/workflows/ci.yml/badge.svg)

---

## 1. Contexto y Problema a Resolver

Las grandes corporaciones industriales operan frecuentemente a través de múltiples sociedades legales y divisiones. En este escenario tecnológico fragmentado, los sistemas de facturación (ERPs como SAP) aíslan los registros de los clientes por cada entidad legal.

El resultado directo es la **inexistencia de una visión única del cliente**: un mismo cliente real aparece duplicado múltiples veces con diferentes identificadores. Esto genera tres grandes problemas operativos:

1. **Opacidad comercial**: Imposibilidad de medir el valor real de la cuenta a nivel corporativo.
2. **Oportunidades perdidas (Whitespots)**: Dificultad para detectar servicios que el cliente consume en una división pero no en otras (falta de *Cross-Selling*).
3. **Gestión de Privacidad (RGPD)**: Dificultades técnicas para asegurar consentimientos cruzados de comunicaciones corporativas.

**Focus** nace como solución tecnológica a este problema, sustituyendo informes estáticos pesados por una **aplicación web interactiva basada en el paradigma del Golden Record**.

---

## 1.1 Estructura del Proyecto

El código fuente sigue las directrices del *App Router* de Next.js y está estructurado en los siguientes directorios principales:

```text
focus/
├── .github/workflows/   # CI/CD: Pipeline de GitHub Actions (Lint, TypeCheck, Vitest, Playwright)
├── app/
│   ├── prisma/          # Esquema de Base de Datos (schema.prisma) y Seeds (ETL scripts)
│   ├── public/          # Assets estáticos, logos e iconos
│   ├── src/
│   │   ├── app/         # Next.js App Router: Páginas, Layouts y API Routes
│   │   ├── components/  # Componentes React (UI genérica y lógica de dominio)
│   │   ├── lib/         # Utilidades puras, Prisma Client, queries y adaptadores de IA
│   │   └── types/       # Definiciones estrictas de TypeScript
│   ├── package.json     # Dependencias y scripts de ejecución
│   └── vitest.config.ts # Configuración de pruebas unitarias y cobertura
├── data/logos/          # Logos institucionales
├── db/setup/            # Scripts SQL de inicialización de base de datos
└── docs/                # Documentación exhaustiva (TFM, Arquitectura, Modelo de Datos)
```

---

## 2. Visión Funcional (Golden Record)

El pilar fundamental de la plataforma es la deduplicación de registros fragmentados en una única "Verdad Única" o **Golden Record**.

El motor de normalización agrupa dinámicamente los distintos números de cliente (`CUSTOMER_MASTER`) basándose en una clave fiscal única (CIF/NIF), consolidándolos bajo un paraguas corporativo (`ORGANIZATIONS`).

### Módulos Principales de la Plataforma

- 🔍 **Buscador 360º de Clientes** (`/clientes`): Interfaz con filtrado *server-side* multi-selección por sociedad, BU, geografía, sector CNAE, material/servicio y año. Exportación CSV masiva respetando filtros activos.
- 🎯 **Motor de Whitespots / Venta Cruzada** (`/clientes` — modo whitespot): Cruza la cartera filtrada contra el catálogo de sociedades y BUs, detectando huecos = oportunidades de cross-sell. Incluye control de **Incompatibilidades Legales de Servicios** (Anexo 4 GG6).
- 🏢 **Ficha 360º del cliente** (`/clientes/[id]`): Detalle por organización con facturación histórica, contactos y whitespots por empresa.
- 📊 **Módulos Analíticos**: Dashboard Ejecutivo (`/dashboard`) con KPIs de ciclo de vida de cartera, Segmentación (`/segmentacion`), Top Clientes (`/top-clientes`) y Catálogo de Servicios (`/catalogo`).
- 🔐 **Control de Accesos Centralizado IAM** (`/accesos`): Sistema de matrices de permisos granulares por rol y Business Unit. Alta de usuarios verificada contra Active Directory corporativo. Alcance por dimensión (CCAA, provincia, material, profit center…).
- 📋 **Registro de Auditoría** (`/auditoria`): Visor del log de actividad del sistema con filtros avanzados, paginación y exportación CSV. Permite reconstruir exportaciones anteriores.
- 🤖 **Asistente IA integrado**: Chatbot analítico construido sobre Vercel AI SDK con modelo Llama 3 (70B) vía Groq, integrado como *bot flotante* en la interfaz.

---

## 3. Arquitectura y Stack Tecnológico

El proyecto ha sido desarrollado bajo una arquitectura moderna, escalable y Serverless. Se aplica el patrón de renderizado híbrido (React Server Components) para optimizar tiempos de carga sin comprometer la seguridad.

```mermaid
graph TD
    U((Usuario/Directivo)) <-->|Navegación UI| F

    subgraph "Capa de Presentación y Aplicación (Vercel Edge/Serverless)"
        F[Next.js 16 App Router]
        UI[Tailwind 4 + Design System TÜV]
        API[Server Actions & API Routes]
        Auth[NextAuth v4]
        ORM[Prisma 7 ORM]
        MW[Middleware proxy.ts]
    end

    subgraph "Capa de Persistencia (Serverless DB)"
        DB[(TiDB Cloud / MySQL 8)]
    end

    subgraph "Red Corporativa"
        AD[Active Directory SOAP]
    end

    F <-->|RSC| API
    F --> UI
    MW --> F
    API --> Auth
    Auth -->|LoginLDAP_AD MD5| AD
    API <--> ORM
    ORM <-->|Conexión TLS / Connection Pool| DB
```

### Tecnologías Core

| Componente | Tecnología Aplicada | Justificación Arquitectónica |
| :--- | :--- | :--- |
| **Infraestructura Cloud** | **Vercel** + **TiDB Cloud** | Despliegue automático (CD) sin mantenimiento de servidores. Base de datos distribuida nativa en la nube compatible con MySQL 8. |
| **Framework Web** | **Next.js 16** (App Router) + React 19 | Separación estricta entre *Server Components* (peticiones a DB sin exponer APIs intermedias) y *Client Components*. |
| **Lenguaje** | **TypeScript** (Strict Mode) | Prevención de errores en compilación y tipado end-to-end con Prisma. |
| **Persistencia** | **Prisma 7 ORM** + adapter MariaDB | Abstracción de MySQL, migraciones declarativas y protección nativa contra SQL injection. |
| **Autenticación** | **NextAuth v4** (JWT) | Login delegado al Active Directory corporativo vía SOAP. Modo Mock para evaluación académica. |
| **Integración Continua** | **GitHub Actions** | CI automatizada (Lint, TypeCheck, Vitest, Playwright) en cada push a `main`. |
| **Interfaz (UI)** | **Tailwind CSS 4** + `@tuvsud/design-system` | Design System institucional corporativo TÜV SÜD con wrappers React. |

---

## 4. Documentación de Ingeniería

La documentación técnica completa está modularizada en `docs/`:

### Arquitectura de Sistemas
- [Memoria Técnica (TFM): CI/CD, Pruebas y Autenticación](docs/TFM_ARQUITECTURA_Y_PRUEBAS.md)
- [Arquitectura Detallada](docs/architecture/Arquitectura.md): Flujo SSR, caché, estructura de carpetas y diagrama de arquitectura.
- [Modelo de Datos](docs/architecture/Modelo-de-Datos.md): Las 25 tablas en 7 módulos.
  - ↳ [Diagrama Entidad-Relación Completo](docs/diagrams/DIAGRAMA_ER_COMPLETO.md)
- [Decisiones de Diseño (ADRs)](docs/architecture/Decisiones-de-Diseno.md): Justificación de tecnologías.
- [IAM y Auditoría](docs/architecture/IAM-y-Auditoria.md): Control de acceso basado en roles y logs.
- [Seguridad](docs/architecture/Seguridad.md): Hardening, cifrado y matriz de riesgos.

### Datos y Pipelines
- [Pipeline de Datos (ETL)](docs/data/Pipeline-de-Datos.md): Cómo se procesan y normalizan los datos desde los extractos SAP.

### Producto y Funcionalidades
- [Manual de Funcionalidades](docs/product/Funcionalidades.md): Explicación pantalla por pantalla.
- [Glosario y Referencias](docs/product/Glosario-y-Referencias.md): Términos técnicos y de negocio.

---

## 5. Diseño de Base de Datos, Datos Sintéticos y Cumplimiento RGPD

### 5.1 Las Migraciones (Estructura)
El repositorio **sí incluye las migraciones de Prisma** (`app/prisma/migrations/`), que definen la arquitectura relacional completa. Estas migraciones construyen de forma automatizada las **25 tablas en 7 módulos funcionales**. El comando `prisma migrate deploy` reconstruye el esquema desde cero en cualquier entorno.

### 5.2 Ausencia de Datos Reales en GitHub (RGPD)
**El repositorio NO contiene ningún dato real** (PII de clientes, contactos o ingresos corporativos). Por estricto cumplimiento del **RGPD** y de la confidencialidad corporativa exigida en un TFM, los volcados de la base de datos y los extractos SAP/CRM jamás se versionan en GitHub.

¿Cómo se prueba la plataforma?

1. **Datos Sintéticos Anonimizados:** Los scripts *seeds* en `app/prisma/seeds/` (18 scripts ordenados por dependencia) inyectan datos generados algorítmicamente que replican la misma estructura, volumetría y casuística real. El script `scripts/anonymize-db.ts` aplica ofuscación a los datos antes de cualquier subida a entornos compartidos.
2. **Pipeline Inalterado:** El código ETL de normalización que construye el Golden Record es 100% idéntico al de producción. El tribunal puede evaluar el código completo, las migraciones y la lógica de negocio sin exponer información confidencial.

---

## 6. Puesta en Marcha Local

Para levantar el proyecto localmente se requiere **Node.js 20+** y **MySQL 8** (o conexión a TiDB Cloud).

### 6.1 Instalación

```bash
# Desde la raíz del repositorio
cd app
npm install
```

### 6.2 Variables de Entorno

```bash
cp .env.example .env
```

Variables mínimas requeridas:

```env
DATABASE_URL="mysql://usuario:clave@localhost:3306/focus_dev"
NEXTAUTH_SECRET="una-clave-aleatoria-segura"
AUTH_ALLOW_MOCK="true"   # activa el modo sin Active Directory (ver sección 6.4)
```

### 6.3 Migración de Estructura y Carga de Datos

```bash
# Aplicar el esquema de BD
npx prisma migrate dev

# Catálogos ligeros (org, servicios, estados, CNAE)
npm run seed

# Datos de negocio (en orden de dependencia)
npm run seed:billing       # facturación
npm run seed:customers     # maestro de clientes + direcciones
npm run seed:contacts      # contactos CRM
npm run seed:normalize     # normalización de datos geográficos
npm run seed:iam           # usuarios, roles y permisos
npm run seed:add-moure     # usuario de evaluación TFM (moure-dev)
```

### 6.4 Arranque del Servidor

```bash
npm run dev
# Disponible en http://localhost:3000
```

### 6.5 Modo Offline — Bypass de Active Directory (Mock)

En producción, el login valida credenciales contra el **Active Directory** corporativo vía SOAP (`LoginLDAP_AD`). Para evaluación fuera de la VPN corporativa, la variable `AUTH_ALLOW_MOCK=true` **intercepta la llamada SOAP** y permite el acceso a cualquier usuario dado de alta en `APP_USERS`, independientemente de la contraseña.

> **Para Evaluadores del TFM:**
> Inicia sesión con:
> - **Usuario**: `moure-dev`
> - **Contraseña**: *(cualquiera, el modo mock permite el acceso)*
>
> *Nota: En producción esta variable no se despliega y el bypass es imposible.*

---

## 7. Testing y CI/CD

El proyecto cuenta con un flujo de **Integración Continua** en GitHub Actions (`.github/workflows/ci.yml`).

En cada push a `main` o Pull Request, el pipeline verifica automáticamente:

1. **Calidad de Código**: `eslint`
2. **Tipado Estricto**: `tsc --noEmit`
3. **Tests Unitarios** (24 tests): `vitest` — valida la lógica de negocio pura (normalización geográfica, exportación CSV segura, validación de identificadores).
4. **Tests E2E**: `playwright` — simula el flujo de login y navegación.

Si todos los checks pasan, **Vercel** despliega automáticamente en producción (CD).

```bash
# Tests unitarios con cobertura
npm run test:coverage

# Tests E2E
npx playwright test
```

---

## 8. Prueba de Concepto: Asistente Analítico con IA

Como cierre innovador del TFM, la plataforma incluye un **Chatbot integrado impulsado por IA**. Este asistente actúa como "Copiloto de Datos": explica el modelo de negocio, la arquitectura y responde dudas funcionales sobre Focus.

Construido con **Vercel AI SDK** sobre el modelo **Llama 3 (70B)** vía **Groq** (LPUs ultrarrápidas), integrado como bot flotante en el *App Router* (`/api/chat`).

> **Cómo probarlo:**
> 1. Inicia sesión (usuario `moure-dev`).
> 2. Haz clic en el **bot flotante azul** (esquina inferior derecha).
> 3. Pregunta, por ejemplo:
>    - *"¿Cuál es la diferencia entre Customer Master y Organizations?"*
>    - *"¿Qué es un Whitespot y cómo se detecta?"*
>    - *"¿Cómo funciona el control de incompatibilidades de servicios?"*
>
> *Nota técnica: Requiere la variable `GROQ_API_KEY` (gratuita en console.groq.com) tanto en local como en las Environment Variables de Vercel.*

---

> *Desarrollado y arquitecturado por Luis de Frutos como Trabajo Fin de Máster.*
