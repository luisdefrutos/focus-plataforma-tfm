# Focus - Plataforma de Inteligencia Estratégica

> **Trabajo Fin de Máster (TFM)**  
> **Autor:** Luis de Frutos  
> **Ámbito:** Plataforma de Arquitectura de Datos, Dato Maestro (Master Data Management) y Activación Comercial.

---

## 1. Contexto y Problema a Resolver

Las grandes corporaciones industriales operan frecuentemente a través de múltiples sociedades legales y divisiones (ITV, Industria, Certificaciones). En este escenario tecnológico fragmentado, los sistemas de facturación (ERPs como SAP) aíslan los registros de los clientes por cada entidad legal. 

El resultado directo es la **inexistencia de una visión única del cliente**: un mismo cliente real (por ejemplo, una gran empresa manufacturera) aparece duplicado múltiples veces con diferentes identificadores. Esto genera tres grandes problemas operativos:

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
- 🔐 **Control de Accesos Centralizado (IAM)**: Conexión con *Active Directory* (SOAP) y sistema de matrices de permisos granulares por rol y división, asegurando la privacidad del dato.

---

## 3. Arquitectura y Stack Tecnológico

El proyecto ha sido desarrollado bajo una arquitectura moderna, escalable y fuertemente tipada. Se aplica el patrón de renderizado híbrido para optimizar tiempos de carga sin comprometer la seguridad.

```mermaid
graph TD
    %% Usuarios y Clientes
    U((Usuario/Directivo)) <-->|Navegación UI| F

    %% Frontend (Next.js)
    subgraph "Capa de Presentación (Frontend)"
        F[Next.js 16 App Router]
        UI[Tailwind 4 + Design System]
        C[TanStack Table / Recharts]
    end

    %% Backend y Auth
    subgraph "Capa de Aplicación (Backend Node)"
        API[API Routes / Server Actions]
        Auth[NextAuth v4]
        ORM[Prisma ORM 7]
    end

    %% Infraestructura y Datos
    subgraph "Capa de Persistencia y SSO"
        AD{Active Directory LDAP}
        DB[(MySQL 8 / MariaDB)]
    end

    %% Relaciones
    F <-->|Server Components| API
    F --> UI
    F --> C
    API --> Auth
    Auth <-->|LDAP Web Service SOAP| AD
    API <--> ORM
    ORM <-->|Conexión TLS / Connection Pool| DB
```

### Tecnologías Core

| Componente | Tecnología Aplicada | Justificación Arquitectónica |
| :--- | :--- | :--- |
| **Framework Web** | Next.js 16 (App Router) + React 19 | Separación estricta entre *Server Components* (para peticiones a DB sin exponer APIs intermedias) y *Client Components*. |
| **Lenguaje** | TypeScript (Strict Mode) | Prevención de errores en tiempo de compilación y tipado end-to-end con Prisma. |
| **Persistencia** | Prisma 7 ORM | Abstracción de la base de datos MySQL, migraciones declarativas (`schema.prisma`) y protección nativa contra inyecciones SQL. |
| **Motor de Base de Datos** | MySQL 8.0 | Motor relacional robusto para albergar el modelo normalizado (25 tablas) optimizado para transacciones analíticas mediante índices *b-tree*. |
| **Autenticación** | Next-Auth v4 + AD SOAP | Delegación de identidad al Active Directory corporativo, gestionando la sesión mediante JWT (*JSON Web Tokens*). |
| **Interfaz (UI)** | Tailwind CSS 4 | Estilado de componentes escalable. Implementación de un sistema de diseño institucional (*Design System*). |

---

## 4. Modelo de Datos (Diagrama Entidad-Relación Simplificado)

El modelo de datos cuenta con **25 tablas** gestionadas por Prisma. El siguiente diagrama ilustra el flujo de deduplicación del *Golden Record*:

```mermaid
erDiagram
    ORGANIZATIONS ||--|{ CUSTOMER_MASTER : "Agrupa"
    CUSTOMER_MASTER ||--|{ BILLING_RECORDS : "Factura"
    CUSTOMER_MASTER ||--|{ CONTACTS : "Posee"
    BUSINESS_UNITS ||--|{ BILLING_RECORDS : "Emite"
    
    ORGANIZATIONS {
        int org_id PK
        string tax_id "Clave Fiscal (CIF)"
        string legal_name
    }
    CUSTOMER_MASTER {
        int customer_id PK
        int org_id FK
        string sap_number "ID fragmentado del ERP"
    }
    BILLING_RECORDS {
        int billing_id PK
        int customer_id FK
        int bu_id FK
        float invoice_amount
    }
    BUSINESS_UNITS {
        int bu_id PK
        string name "Línea de Negocio"
    }
```

---

## 5. Puesta en Marcha Local

Para levantar el proyecto en un entorno local para su evaluación, se requiere **Node.js 20+** y un motor de base de datos **MySQL 8**.

1. **Clonar e instalar dependencias**
   ```bash
   cd app
   npm install
   ```

2. **Configuración de Variables de Entorno (`.env`)**
   Copiar `.env.example` a `.env` y asegurar las credenciales:
   ```env
   DATABASE_URL="mysql://usuario:clave@localhost:3306/focus_dev"
   AUTH_ALLOW_MOCK="true"  # Habilita entorno offline sin Active Directory
   ```

3. **Migración de Estructuras (DDL)**
   ```bash
   npx prisma migrate deploy
   ```

4. **Arranque del Servidor de Desarrollo**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

---

## 6. Documentación Anexa

Dentro del repositorio, la carpeta `docs/` contiene el desarrollo documental extenso requerido para la defensa de la arquitectura y la gobernanza de datos:

- **[TFM_ARQUITECTURA_Y_PRUEBAS.md](docs/TFM_ARQUITECTURA_Y_PRUEBAS.md)**: Memoria técnica detallada sobre Autenticación, CI/CD y Testing.
- **[DOCUMENTACION_UNIFICADA.md](docs/v2-standardized/DOCUMENTACION_UNIFICADA_FOCUS_STANDARDIZED.md)**: Manual técnico extendido con casos de uso, diagrama de componentes y auditoría de decisiones de arquitectura.
- **[INFORME_DIRECCION.md](docs/v2-standardized/INFORME_DIRECCION_PROYECTO_FOCUS_STANDARDIZED.md)**: Resumen ejecutivo orientado a la gerencia de la empresa, definiendo los OKRs (*Objectives and Key Results*) de la implantación.
- **[Auditoría de Seguridad](docs/security/AUDITORIA_SEGURIDAD_2026-06-22.md)**: Análisis estático de vulnerabilidades (OWASP).

---

> *Desarrollado y arquitecturado por Luis de Frutos como TFM en Ingeniería y Gestión de Datos.*
