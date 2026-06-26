# Focus - Plataforma de Inteligencia Estratégica

> **Trabajo Fin de Máster (TFM)**  
> **Autor:** Luis de Frutos  
> **Ámbito:** Plataforma de Arquitectura de Datos, Dato Maestro (Master Data Management) y Activación Comercial.

---

## 1. Contexto y Problema a Resolver

Las grandes corporaciones industriales operan frecuentemente a través de múltiples sociedades legales y divisiones. En este escenario tecnológico fragmentado, los sistemas de facturación (ERPs como SAP) aíslan los registros de los clientes por cada entidad legal. 

El resultado directo es la **inexistencia de una visión única del cliente**: un mismo cliente real aparece duplicado múltiples veces con diferentes identificadores. Esto genera tres grandes problemas operativos:

1. **Opacidad comercial**: Imposibilidad de medir el valor real de la cuenta a nivel corporativo.
2. **Oportunidades perdidas (Whitespots)**: Dificultad para detectar servicios que el cliente consume en una división pero no en otras (falta de *Cross-Selling*).
3. **Gestión de Privacidad (RGPD)**: Dificultades técnicas para asegurar consentimientos cruzados de comunicaciones corporativas.

**Focus** nace como solución tecnológica a este problema, sustituyendo informes estáticos pesados por una **aplicación web interactiva basada en el paradigma del Golden Record**.

---

## 2. Visión Funcional (Golden Record)

El pilar fundamental de la plataforma es la deduplicación de registros fragmentados en una única "Verdad Única" o **Golden Record**.

El motor de normalización de la plataforma agrupa dinámicamente los distintos números de cliente (`CUSTOMER_MASTER`) basándose en una clave fiscal única (CIF/NIF), consolidándolos bajo un paraguas corporativo (`ORGANIZATIONS`).

### Módulos Principales de la Plataforma:

- 🔍 **Buscador 360º de Clientes**: Interfaz hiperoptimizada con filtrado *server-side*, que permite localizar grupos de facturación consolidados, contactos y servicios contratados.
- 🎯 **Motor de Whitespots (Venta Cruzada)**: Algoritmo que cruza las líneas de negocio contratadas frente al catálogo corporativo, exponiendo las carencias y sugiriendo activaciones.
- 📊 **Módulos Analíticos (Dashboards)**: Visualización en tiempo real del *revenue* por cliente, segmentación ABC, penetración sectorial y *share of wallet*.
- 🏢 **Registro de Activos e Inspecciones**: Capa de control normativo para equipos a presión, ascensores e instalaciones eléctricas, mapeando la caducidad de inspecciones con alertas de renovación.
- 🔐 **Control de Accesos Centralizado (IAM)**: Sistema de matrices de permisos granulares por rol y división, asegurando la privacidad del dato.

---

## 3. Arquitectura y Stack Tecnológico

El proyecto ha sido desarrollado bajo una arquitectura moderna, escalable y Serverless. Se aplica el patrón de renderizado híbrido para optimizar tiempos de carga sin comprometer la seguridad.

```mermaid
graph TD
    %% Usuarios y Clientes
    U((Usuario/Directivo)) <-->|Navegación UI| F

    %% Frontend (Vercel)
    subgraph "Capa de Presentación y Aplicación (Vercel Edge/Serverless)"
        F[Next.js 16 App Router]
        UI[Tailwind 4 + Design System]
        API[Server Actions & API Routes]
        Auth[NextAuth v4]
        ORM[Prisma ORM 7]
    end

    %% Infraestructura y Datos (TiDB Cloud)
    subgraph "Capa de Persistencia (Serverless DB)"
        DB[(TiDB Cloud / MySQL 8)]
    end

    %% Relaciones
    F <-->|RSC| API
    F --> UI
    API --> Auth
    API <--> ORM
    ORM <-->|Conexión TLS / Connection Pool| DB
```

### Tecnologías Core

| Componente | Tecnología Aplicada | Justificación Arquitectónica |
| :--- | :--- | :--- |
| **Infraestructura Cloud** | **Vercel** + **TiDB Cloud** | Despliegue automático (CD) sin mantenimiento de servidores. Escalado automático y base de datos distribuida nativa en la nube. |
| **Framework Web** | **Next.js 16** (App Router) + React 19 | Separación estricta entre *Server Components* (para peticiones a DB sin exponer APIs intermedias) y *Client Components*. |
| **Lenguaje** | **TypeScript** (Strict Mode) | Prevención de errores en tiempo de compilación y tipado end-to-end con Prisma. |
| **Persistencia** | **Prisma 7 ORM** | Abstracción de la base de datos MySQL, migraciones declarativas (`schema.prisma`) y protección nativa contra inyecciones SQL. |
| **Integración Continua** | **GitHub Actions** | CI automatizada (Linting, TypeScript check, Vitest y Playwright) en cada push a la rama `main`. |
| **Interfaz (UI)** | **Tailwind CSS 4** | Estilado de componentes escalable. Implementación de un sistema de diseño institucional (*Design System*). |

---

## 4. Documentación de Ingeniería

La documentación técnica completa ha sido modularizada para facilitar su lectura. Se divide en tres áreas principales:

### Arquitectura de Sistemas
- [Arquitectura Detallada](docs/architecture/Arquitectura.md): Flujo de SSR, caché, organización de carpetas y **Diagrama de Arquitectura (Mermaid)**.
- [Modelo de Datos](docs/architecture/Modelo-de-Datos.md): Diccionario de datos y explicación de los 7 módulos (25 tablas).
  - ↳ [Diagrama Entidad-Relación Completo](docs/diagrams/DIAGRAMA_ER_COMPLETO.md) *(Nuevo)*
- [Decisiones de Diseño (ADRs)](docs/architecture/Decisiones-de-Diseno.md): Justificación de las tecnologías elegidas.
- [IAM y Auditoría](docs/architecture/IAM-y-Auditoria.md): Control de acceso basado en roles y logs del sistema.
- [Seguridad](docs/architecture/Seguridad.md): Hardening, cifrado y matriz de riesgos.

### Datos y Pipelines
- [Pipeline de Datos (ETL)](docs/data/Pipeline-de-Datos.md): Cómo se procesan y normalizan los datos en los *seeds*.

### Producto y Funcionalidades
- [Manual de Funcionalidades](docs/product/Funcionalidades.md): Explicación pantalla por pantalla.
- [Glosario y Referencias](docs/product/Glosario-y-Referencias.md): Términos técnicos y de negocio.

---

## 5. Puesta en Marcha Local

Para levantar el proyecto en un entorno local para su evaluación, se requiere **Node.js 20+** y un motor de base de datos **MySQL 8** (o conexión a TiDB Cloud).

1. **Clonar e instalar dependencias**
   ```bash
   cd app
   npm install
   ```

2. **Configuración de Variables de Entorno (`.env`)**
   Copia el archivo de ejemplo y configura tu acceso a la BD:
   ```bash
   cp .env.example .env
   ```
   Asegúrate de tener la variable de conexión:
   ```env
   DATABASE_URL="mysql://usuario:clave@localhost:3306/focus_dev"
   ```

3. **Migración de Estructuras y Datos (DDL & Seeds)**
   ```bash
   npx prisma migrate dev
   npx tsx prisma/seeds/00-run-all.ts
   ```

4. **Arranque del Servidor de Desarrollo**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

---

## 6. Testing y CI/CD

El proyecto cuenta con un flujo de **Integración Continua (CI)** configurado en GitHub Actions (`.github/workflows/ci.yml`).

En cada push a `main` o en cada Pull Request, GitHub Actions verifica automáticamente:
1. **Calidad de Código**: `eslint` para mantener los estándares.
2. **Tipado Estricto**: `tsc` para asegurar la robustez de TypeScript.
3. **Tests Unitarios**: `vitest` ejecuta las pruebas de la lógica de negocio (ej. validación de CIFs).
4. **Tests E2E**: `playwright` simula la navegación del usuario para verificar que la UI funciona correctamente.

Si todos los checks pasan, **Vercel** despliega automáticamente la nueva versión en producción (CD).

```bash
# Ejecutar tests unitarios en local
npm run test

# Ejecutar tests E2E en local
npx playwright test
```

---

> *Desarrollado y arquitecturado por Luis de Frutos como Trabajo Fin de Máster.*
