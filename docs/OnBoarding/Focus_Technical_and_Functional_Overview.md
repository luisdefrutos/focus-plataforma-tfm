# Proyecto Focus: Resumen Funcional y Técnico
**Documento de Onboarding para Nuevos Miembros del Equipo**
*Actualizado: 10-06-2026*

---

## 1. Resumen Funcional (¿Qué es Focus?)

### El Problema de Negocio
Antes de **Focus**, TÜV LFD utilizaba un informe de Power BI muy pesado (108 MB) y lento para realizar el seguimiento de la facturación y los datos comerciales de los clientes. Debido a que TÜV LFD opera a través de múltiples entidades legales y divisiones, un mismo cliente podía existir múltiples veces en el sistema con diferentes IDs.

### La Solución: El "Golden Record" (Registro de Oro)
Focus es una **Plataforma de Inteligencia Estratégica**. Su propósito principal es crear un **Golden Record** — una identidad única para cada cliente. La identidad funciona en dos niveles: cada registro SAP vive en `CUSTOMER_MASTER` (identidad fuerte: `sap_customer_code`), y la tabla `ORGANIZATIONS` agrupa los N registros SAP de una misma entidad real **deduplicando por CIF/NIF**. Sobre esta base limpia, Focus proporciona:

1. **Visión 360º del Cliente**: Un buscador (`/clientes`) con filtros multi-selección, export a CSV y ficha de detalle (`/clientes/[id]`) con la facturación histórica, contactos y direcciones.
2. **Análisis de Whitespots (venta cruzada manual)**: El buscador tiene un *modo whitespot* que cruza la cartera filtrada contra todas las sociedades/BUs del grupo y muestra dónde NO hay facturación (oportunidad de cross-sell). **Nota:** el motor *automático* de oportunidades que existió en versiones tempranas se desactivó por decisión de producto — la tabla `CROSS_SELL_OPPORTUNITIES` existe pero está vacía y no hay procesos batch que la alimenten.
3. **Módulos Analíticos**: Dashboard Ejecutivo (`/dashboard`), Segmentación y Top Clientes (`/segmentacion`, `/top-clientes`), Catálogo de Servicios (`/catalogo`).
4. **Activos Inspeccionables** (nuevo, junio 2026): modelo de instalaciones e inspecciones reglamentarias con caducidad. Cinco fuentes cargadas: ascensores (AS), alta tensión (AT), baja tensión (BT) y equipos a presión GESAP (INSPECCION_SA 8888 y TÜV LFD Iberia 9999). Titular ≠ gestor, periodicidades y enlace con facturación por nº de documento (78-90% según fuente). De momento es capa de datos (sin pantalla propia).
5. **Control de Accesos (IAM)**: roles y permisos por usuario con alcance por Business Unit y filtros granulares (CCAA, materiales…). Se administra en `/accesos` (accesible desde el menú del avatar).

---

## 2. Arquitectura Técnica (¿Cómo está construido?)

Focus es una aplicación web full-stack moderna.

### El Stack (Tecnologías)
* **Framework:** **Next.js 16** (React 19). Utiliza la arquitectura moderna "App Router".
* **UI:** **Tailwind CSS v4** + **`@tuvsud/design-system` ("Algorithm")**, el design system corporativo oficial de TÜV LFD (web components `ts-*` con wrappers React). Gráficas con **recharts** y tablas con **TanStack Table**.
* **Base de Datos:** **MySQL 8.0** (`focus_dev`).
* **ORM:** **Prisma 7** con el driver adapter de MariaDB.
* **Autenticación:** **next-auth v4** (JWT). El login valida **usuario + contraseña contra Active Directory** vía un web service SOAP corporativo (`LoginLDAP_AD`); el `passport` del servicio se calcula como `MD5(user + clave)` con la clave en `.env` (`AD_SOAP_LDAP_KEY`). Solo acceden usuarios dados de alta y activos en `APP_USERS`. Hay un *mock* opt-in (`AUTH_ALLOW_MOCK=true`) para desarrollo **sin conexión** que no comprueba la contraseña.

### Seguridad por filas (RLS)
El alcance de cada usuario viaja en el JWT: `permissions` (códigos como `IAM_MANAGE` o `DATA_MANAGE`), `buIds` (qué Business Units puede ver) y `allowedFilters` (listas blancas por dimensión: CCAA, provincias, materiales…). Las queries de servidor aplican ese alcance en cada consulta, y el token se refresca desde BD cada 5 minutos para propagar cambios hechos en `/accesos`. El middleware ([src/proxy.ts](../../app/src/proxy.ts) — en Next 16 `middleware.ts` pasa a llamarse `proxy.ts`) exige sesión para toda ruta salvo `/login`.

### Estructura de Carpetas Clave
* `/app/src/app/(dashboard)/`: las pantallas (dashboard, clientes, segmentacion, top-clientes, catalogo, accesos, login).
* `/app/src/lib/queries/`: **la lógica de backend.** Next.js usa React Server Components: las consultas a BD (`customers.ts`, `dashboard.ts`, `segmentacion.ts`…) se ejecutan en el servidor. Aquí es donde se aplica el RLS.
* `/app/src/lib/cache.ts`: las agregaciones de solo lectura se cachean 5 min (tag `billing`); `POST /api/revalidate` las refresca tras re-seedear.
* `/app/src/app/api/`: endpoints REST puros (`/api/clientes/export` para CSV, `/api/revalidate`, next-auth).
* `/app/prisma/`: el `schema.prisma` (plano de la base de datos) y `/seeds/` para cargar los datos desde los Excels originales de `/data/raw/`.

---

## 3. El Modelo de Base de Datos

La base de datos (`focus_dev`) consta de **23 tablas** en 7 bloques:

1. **Estructura Organizativa**: `LEGAL_ENTITIES`, `DIVISIONS`, `BUSINESS_UNITS`
2. **El Golden Record**: `CUSTOMER_MASTER`, `ADDRESSES`, `CONTACTS`, `CORPORATE_HOLDINGS` (vacía, pendiente de fuente)
3. **Clasificación Sectorial**: `CNAE_CATALOG` (88 divisiones CNAE-2009), `CUSTOMER_CNAE` (CNAE principal por cliente, poblada por `seed:customer-cnae` desde `industry_code`)
4. **Inteligencia Comercial**: `BILLING_RECORDS`, `PRODUCT_CATALOG`, `CROSS_SELL_OPPORTUNITIES` (vacía — motor desactivado)
5. **Activos Inspeccionables**: `ORGANIZATIONS`, `ASSET_TYPES`, `ASSETS`, `INSPECTIONS`, `ORGANIZATION_CONTACTS`
6. **Control de Acceso (IAM)**: `APP_USERS`, `APP_ROLES`, `APP_PERMISSIONS`, `APP_USER_ROLES`, `APP_ROLE_PERMISSIONS`
7. **Referencia**: `STATUS_CATALOG` (23 estados precargados)

> **Migraciones**: 7 en total (`init` … `db_push_catchup`). El bloque 5 (activos inspeccionables) y `BILLING_RECORDS.sales_order_number` se formalizaron en la última migración tras haberse aplicado con `db push`. Un despliegue limpio (`prisma migrate deploy`) reconstruye el esquema completo.

---

## 4. Cómo Ejecutar el Proyecto en Local

Este es tu flujo de trabajo diario:

1. **Inicia la Base de Datos:** MySQL corriendo en `localhost:3306` (bootstrap inicial: scripts de [/db/setup/](../../db/setup/)).
2. **Abre una terminal en la carpeta `/app`** y copia `.env.example` a `.env` (rellena `DATABASE_URL` y `NEXTAUTH_SECRET`).
3. **Aplica el esquema y carga datos** (solo la primera vez o tras cambios):
   ```bash
   npx prisma migrate dev
   npm run seed              # catálogos ligeros
   npm run seed:billing      # facturación (por defecto 2024-2026)
   npm run seed:customers && npm run seed:contacts && npm run seed:normalize
   npm run seed:iam          # usuarios y roles de prueba
   ```
4. **Ejecuta el servidor web:**
   ```bash
   npm run dev
   ```
5. **Abre tu navegador:** `http://localhost:3000`. Entra con uno de los usuarios creados por `seed:iam` (la contraseña no se valida en dev).

---

## 5. Depuración (Debugging)

Dado que usamos React Server Components, para depurar la lógica del backend (queries a la BD):
1. Pon un punto de interrupción (punto rojo) en cualquier archivo de `/lib/queries/`.
2. Ve a la pestaña de **Run and Debug** de VSCode/Antigravity IDE.
3. Selecciona **"Next.js: debug server-side"** y dale al Play.
4. Navega a la página en tu navegador para que el editor capture la ejecución.

*¡Bienvenido al equipo de Focus!*
