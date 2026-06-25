# Puesta en Marcha Local

Guía para levantar Focus en tu máquina de desarrollo desde cero.

## Requisitos

- **Node.js 20+**
- **MySQL 8** corriendo en `localhost:3306`
- Acceso a los **Excel de `data/raw/`** (no están en git) si vas a cargar datos reales
- La clave **`AD_SOAP_LDAP_KEY`** (la facilita IT) si vas a probar el login real; si no, usa el modo mock

## 1. Base de datos MySQL

Arranca MySQL en `localhost:3306`. El bootstrap inicial (crear base de datos `focus_dev` y usuario `focus_app`) está en los scripts de **`db/setup/`**.

Si usas `prisma migrate dev` también necesitas una **shadow DB** (`focus_dev_shadow`) con permisos para el usuario.

## 2. Configurar `.env`

Trabaja desde `app/`. Copia la plantilla y rellena los valores:

```bash
cd app
cp .env.example .env
```

### Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | ✅ | Conexión MySQL: `mysql://USER:PASSWORD@HOST:PORT/DATABASE`. Caracteres especiales en la password se **URL-encodean** (`#`→`%23`, `@`→`%40`, `/`→`%2F`, `:`→`%3A`). |
| `SHADOW_DATABASE_URL` | Para `migrate dev` | Shadow DB para los dry-runs de Prisma. |
| `NEXTAUTH_SECRET` | ✅ | Firma del JWT. Genera uno: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `NEXTAUTH_URL` | ✅ | URL base (`http://localhost:3000` en local). |
| `AD_SOAP_URL` | ✅ (login real) | Endpoint del web service de AD. |
| `AD_SOAP_LDAP_KEY` | ✅ (login real) | Clave para el `passport` MD5. La da IT. **No** se versiona. |
| `AD_SOAP_PASSPORT_FMT` / `_ENC` | ❌ | Override del formato del passport (normalmente innecesario). |
| `AD_SOAP_TIMEOUT_MS` | ❌ | Timeout SOAP (default 10000). |
| `AUTH_ALLOW_MOCK` | ❌ | `"true"` = login sin validar contraseña (**solo dev**). |
| `DATABASE_SSL` | En prod | `true` para TLS contra MySQL remoto. |
| `DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL` | ❌ | Flag del adapter MariaDB. |
| `TRUSTED_PROXY_HOPS` | En prod | Nº de proxies de confianza (IP fiable en auditoría). |
| `REVALIDATE_SECRET` | ❌ | Secreto para `POST /api/revalidate` desde scripts/CI (cabecera `x-revalidate-secret`). |

> Para desarrollo **sin conexión al AD**, basta con `AUTH_ALLOW_MOCK="true"` (no valida contraseña). Recuerda: **nunca** en producción.

## 3. Instalar dependencias y esquema

```bash
npm install
npx prisma migrate deploy     # aplica las 10 migraciones → crea el esquema (25 tablas)
```

> En `focus_dev` **no** uses `prisma migrate dev`: detectaría las tablas de backup ajenas al esquema como *drift* y propondría un reset. Ver [Migraciones de Base de Datos](/Migraciones-de-Base-de-Datos).

## 4. Cargar datos (seeds)

Requiere los Excel en `data/raw/`. **El orden importa** (hay dependencias — ver [Pipeline de Datos](/Pipeline-de-Datos)):

```bash
npm run seed                  # catálogos ligeros (01, 02, 03, 08)
npm run seed:billing          # 04 — facturación (por defecto 2024-2026)
npm run seed:customers        # 05
npm run seed:contacts         # 06
npm run seed:normalize        # 07
npm run seed:iam              # 09 — roles y usuarios admin
```

Para el resto de módulos (inspecciones, golden record universal, incompatibilidades, CNAE por cliente…) sigue el orden completo de la tabla de seeds en [Pipeline de Datos](/Pipeline-de-Datos).

## 5. Arrancar la app

```bash
npm run dev          # http://localhost:3000
```

Entra con un usuario dado de alta por `seed:iam` (en modo mock no se valida la contraseña).

## Scripts npm disponibles

| Script | Hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (`next dev`). |
| `npm run build` | Build de producción (`next build`). |
| `npm run start` | Sirve el build (`next start`). |
| `npm run lint` | ESLint. |
| `npm run seed` | Catálogos ligeros (01, 02, 03, 08). |
| `npm run seed:*` / `backfill:*` | Seeds individuales (ver [Pipeline de Datos](/Pipeline-de-Datos)). |

## Depuración (backend / React Server Components)

Como las queries corren en el servidor, para depurarlas:

1. Pon un breakpoint en cualquier fichero de `app/src/lib/queries/`.
2. En el IDE (VS Code / Antigravity), pestaña **Run and Debug**.
3. Selecciona **"Next.js: debug server-side"** y dale al Play.
4. Navega a la página en el navegador para que el editor capture la ejecución.

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| Seed falla leyendo un `.xlsx` | El fichero está **abierto en Excel/Office**. Ciérralo. |
| Login no valida / `ERROR_NO_CONTROLADO` | Falta `AD_SOAP_LDAP_KEY` o es incorrecta. Para dev offline, usa `AUTH_ALLOW_MOCK="true"`. |
| Sesiones que se invalidan al reiniciar | Falta `NEXTAUTH_SECRET` estable. |
| `migrate dev` quiere resetear la BD | Detecta las tablas de backup como drift. Usa `migrate deploy` (ver [Migraciones](/Migraciones-de-Base-de-Datos)). |
| Datos viejos tras re-seedear | Caché de agregaciones (5 min). `POST /api/revalidate`. |

> **Siguiente**: [Migraciones de Base de Datos](/Migraciones-de-Base-de-Datos).
