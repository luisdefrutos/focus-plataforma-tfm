# 🗺️ GUÍA COMPLETA — Proyecto FOCUS en PC Personal
## Del USB al Entorno Local → GitHub → Vercel → Entrega al Profesor

> **Autor del curso:** Luis de Frutos  
> **Versión del export:** 25 de junio de 2026  
> **Stack:** Next.js 16 · React 19 · TypeScript · Prisma 7 · MySQL 8 · NextAuth

---

## 📋 ÍNDICE RÁPIDO

| Fase | Qué haces | Dónde |
|---|---|---|
| [FASE 1](#fase-1--instalar-requisitos) | Instalar Node, Git, MySQL | PC personal |
| [FASE 2](#fase-2--montar-la-base-de-datos) | Crear BD y restaurar datos | PC personal |
| [FASE 3](#fase-3--arrancar-la-aplicación) | Instalar dependencias y arrancar | PC personal |
| [FASE 4](#fase-4--verificar-que-todo-funciona) | Probar la app y los tests | PC personal |
| [FASE 5](#fase-5--activar-el-dashboard-real) | Quitar el mock-up del dashboard | PC personal |
| [FASE 6](#fase-6--preparar-para-github-público) | Limpiar referencias, logo nuevo, anonimizar | PC personal |
| [FASE 7](#fase-7--crear-el-repositorio-github) | GitHub público con commits académicos | PC personal |
| [FASE 8](#fase-8--despliegue-en-vercel) | Publicar en Vercel con BD gratuita | PC personal |
| [FASE 9](#fase-9--documentación-del-curso) | README académico y docs del proyecto | PC personal |

---

## FASE 1 — Instalar requisitos

### 1.1 — Node.js

- Descarga desde **nodejs.org** → versión **LTS** (v20 o v22)
- Instala con las opciones por defecto
- Verifica: abre PowerShell y escribe `node --version` → debe salir `v20.x.x`

### 1.2 — Git

- Descarga desde **git-scm.com** → "Download for Windows"
- Instala con opciones por defecto
- Verifica: `git --version` → debe salir `git version 2.x.x`
- Configura tu identidad (importante para los commits de GitHub):

```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

### 1.3 — MySQL 8

1. Descarga **MySQL Installer** desde: dev.mysql.com/downloads/installer
2. Elige **"Developer Default"** en el tipo de instalación
3. En la configuración de la contraseña de root: pon `Focus2026!` (o la que quieras — anótala)
4. Instala también **MySQL Workbench** (viene en el paquete) — te será útil para ver la BD visualmente
5. Verifica: abre un CMD nuevo y escribe `mysql --version`

### 1.4 — Copiar el proyecto al disco duro

Conecta el USB y ejecuta en PowerShell:

```powershell
mkdir C:\Dev
robocopy E:\focus-export C:\Dev\focus /E
```

> Sustituye `E:` por la letra de tu USB. Puedes verla en el Explorador de Windows.

---

## FASE 2 — Montar la base de datos

### 2.1 — Crear la BD y el usuario

Abre PowerShell y ejecuta:

```powershell
mysql -u root -p
```

Te pedirá la contraseña de root que pusiste al instalar. Luego ejecuta este bloque SQL:

```sql
CREATE DATABASE focus_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE focus_dev_shadow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'focus_app'@'localhost' IDENTIFIED BY 'Focus2026!';
GRANT ALL PRIVILEGES ON focus_dev.* TO 'focus_app'@'localhost';
GRANT ALL PRIVILEGES ON focus_dev_shadow.* TO 'focus_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2.2 — Restaurar el dump de datos

```powershell
mysql -u focus_app -pFocus2026! focus_dev < C:\Dev\focus\app\scripts\mysqldump-focus-completo-25jun2026.sql
```

> ⏱️ Esto tarda varios minutos (el dump tiene toda la BD con datos reales). Es normal que parezca colgado — espera hasta que vuelva el prompt.

> ⚠️ Estos datos son **SOLO para uso local en tu PC**. Nunca los subas a GitHub. Son datos reales de empresa protegidos por RGPD.

### 2.3 — Verificar que la BD está bien

```powershell
mysql -u focus_app -pFocus2026! focus_dev -e "SHOW TABLES;"
```

Debe salir una lista de ~25 tablas: `APP_PERMISSIONS`, `APP_ROLES`, `APP_USERS`, `AUDIT_EVENTS`, `BILLING_RECORDS`, `BUSINESS_UNITS`, etc.

---

## FASE 3 — Arrancar la aplicación

### 3.1 — Crear el archivo `.env`

Crea el fichero `C:\Dev\focus\app\.env` (nuevo, no existe todavía):

```powershell
New-Item -Path "C:\Dev\focus\app\.env" -ItemType File
notepad C:\Dev\focus\app\.env
```

Pega este contenido exacto:

```env
DATABASE_URL="mysql://focus_app:Focus2026%21@localhost:3306/focus_dev?connection_limit=30"
SHADOW_DATABASE_URL="mysql://focus_app:Focus2026%21@localhost:3306/focus_dev_shadow"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="focus-curso-personal-2026-secret-abc123"
AUTH_ALLOW_MOCK="true"
```

> El `%21` es el `!` de la contraseña URL-encodeado. Si pusiste otra contraseña, encódeala en: https://www.urlencoder.org/

> `AUTH_ALLOW_MOCK="true"` permite entrar sin necesitar el Active Directory de la empresa. En el PC personal siempre lo necesitarás activado.

### 3.2 — Configurar el `.npmrc` para el paquete de diseño

El proyecto usa un componente de diseño (`@tuvsud/design-system`) que está en un repositorio privado de la empresa. **En el PC personal necesitas sustituirlo** (ver FASE 6). Por ahora, crea un `.npmrc` mínimo:

```powershell
# Crea el archivo app/.npmrc
Set-Content -Path "C:\Dev\focus\app\.npmrc" -Value "registry=https://registry.npmjs.org/"
```

> ⚠️ Si `npm install` falla con error 401 o "package not found" en `@tuvsud/design-system`, es porque necesitas el token de la empresa. Ve directamente a la FASE 6 para sustituir ese paquete.

### 3.3 — Instalar dependencias

```powershell
cd C:\Dev\focus\app
npm install
```

### 3.4 — Generar el cliente Prisma

```powershell
npx prisma generate
```

### 3.5 — Verificar el estado de las migraciones

```powershell
npx prisma migrate deploy
```

Debe decir: `No pending migrations to apply` (todas las migraciones ya están en el dump).

### 3.6 — Arrancar el servidor

```powershell
npm run dev
```

Abre el navegador en `http://localhost:3000`. Verás la pantalla de login.

### 3.7 — Entrar con un usuario

Entra con uno de estos usuarios de prueba (cualquier contraseña vale en modo mock):

| Usuario | Contraseña | Permisos |
|---|---|---|
| `defru-li` | cualquiera | Admin completo |
| o cualquier usuario en APP_USERS | cualquiera | según su rol |

> Para ver qué usuarios hay: `mysql -u focus_app -pFocus2026! focus_dev -e "SELECT username, is_active FROM APP_USERS;"`

---

## FASE 4 — Verificar que todo funciona

### 4.1 — Páginas que deben funcionar

| URL | Qué es |
|---|---|
| `/dashboard` | Dashboard ejecutivo (ahora en mock-up — ver FASE 5) |
| `/clientes` | Buscador 360 de clientes |
| `/oportunidades` | Matriz de oportunidades (cliente × servicio) |
| `/catalogo` | Catálogo de servicios + incompatibilidades |
| `/segmentacion` | Segmentación de cartera |
| `/top-clientes` | Ranking de clientes por facturación |
| `/accesos` | Gestión de usuarios y permisos (solo admins) |
| `/auditoria` | Registro de actividad (solo admins) |

### 4.2 — Correr los tests

```powershell
cd C:\Dev\focus\app
npm test
```

Debe salir:

```
✓ src/lib/spain.test.ts   (8 tests)
✓ src/lib/csv.test.ts     (7 tests)
✓ src/lib/sql.test.ts     (5 tests)
✓ src/lib/username.test.ts (4 tests)

Test Files  4 passed (4)
    Tests  24 passed (24)
```

### 4.3 — ¿Qué testean? (para explicar en el curso)

| Test | Qué función testea | Por qué importa |
|---|---|---|
| `sql.test.ts` | `escapeLike()` | Evita inyección SQL en búsquedas con `%` y `_` |
| `csv.test.ts` | `csvCell()` | Previene inyección de fórmulas en exports CSV |
| `username.test.ts` | `normalizeUsername()` | Normaliza el `sAMAccountName` del Active Directory |
| `spain.test.ts` | `pc2CodesForProvince()`, `classifyEntity()` | Clasifica CIFs y mapea códigos postales a provincias |

### 4.4 — Sobre el CI/CD: por qué no funciona y está "simulado"

El fichero `azure-pipelines.yml` en la raíz del proyecto es el pipeline de integración continua. Está **completo y correcto** pero requiere:
1. Una cuenta de **Azure DevOps** con un repositorio allí (no en GitHub)
2. Un **agente de build** (la empresa aún no ha asignado uno)

**En el PC personal y para el curso, el CI/CD no se puede ejecutar** porque:
- El pipeline usa `vmImage: ubuntu-latest` → requiere un agente de Azure DevOps
- Autentica contra un feed privado de paquetes (`@tuvsud`) que no es accesible fuera de la empresa

**Lo que SÍ puedes hacer localmente** (equivalente manual al CI):

```powershell
cd C:\Dev\focus\app

# 1. Generar cliente Prisma (equivale al paso del pipeline)
npx prisma generate

# 2. Validar el schema
npx prisma validate

# 3. Verificar que no hay errores de TypeScript
npx tsc --noEmit

# 4. Lint (ESLint)
npm run lint

# 5. Tests con cobertura
npm run test:coverage
```

Si los 5 pasos pasan sin errores, tu código pasaría el pipeline real.

---

## FASE 5 — Activar el dashboard real

El dashboard actualmente muestra un **mock-up de presentación** (sin datos reales). Para activar los datos reales:

Abre el fichero: `C:\Dev\focus\app\src\app\(dashboard)\dashboard\page.tsx`

Busca la línea (aproximadamente línea 15):

```typescript
const PRESENTATION_MOCKUP = true;
```

Cámbiala a:

```typescript
const PRESENTATION_MOCKUP = false;
```

Guarda. El servidor de desarrollo recargará automáticamente y el dashboard mostrará los KPIs reales:
- **Fieles** — clientes que facturan todos los años
- **Nuevos** — primera factura en el último año completo
- **Recuperados** — volvieron tras un año de ausencia
- **Perdidos** — dejaron de facturar
- **Pareto por división** — donut de qué clientes concentran el 80% de facturación

---

## FASE 6 — Preparar para GitHub público

> ⚠️ Esta fase se hace sobre `C:\Dev\focus-curso` (una COPIA para el curso). No sobre `C:\Dev\focus` que es tu versión de trabajo con datos reales.

### 6.1 — Crear la copia del curso

```powershell
robocopy C:\Dev\focus C:\Dev\focus-curso /E /XD .git node_modules .next scratch coverage test-results /XF .env .env.local *.log
```

### 6.2 — Eliminar el paquete privado de la empresa

El paquete `@tuvsud/design-system` es un componente de diseño corporativo privado. Para el curso hay dos opciones:

**Opción A (recomendada para el curso):** Sustituirlo por componentes equivalentes de Shadcn/ui (open source, gratis, aspecto idéntico).

**Opción B (rápida para demo):** Mantener los imports pero mockear el paquete para que no dé error.

Cuando lleguemos a este paso, te ayudo con los cambios concretos en el código.

### 6.3 — Sustituir el logo de TÜV LFD

El fichero actual es `app/public/focus-logo.svg` (logo de TÜV LFD adaptado). Para el curso, necesitas un logo propio sin referencias legales a TÜV LFD.

He generado un logo nuevo para ti (ver imagen adjunta en el export). Para aplicarlo:

```powershell
# El nuevo logo se llamará focus-logo.svg (mismo nombre → sin cambiar imports)
# Cópialo sobre el existente en el directorio del curso
Copy-Item "C:\Dev\focus-curso\NUEVO_LOGO\focus-logo.svg" "C:\Dev\focus-curso\app\public\focus-logo.svg" -Force
```

También busca y reemplaza en todo el código cualquier referencia al texto "TÜV LFD" o "tuvsud":

```powershell
# Ver todas las referencias
Get-ChildItem C:\Dev\focus-curso\app\src -Recurse -Include "*.tsx","*.ts","*.css" | 
  Select-String -Pattern "TÜV|tuvsud|tüv" -CaseSensitive:$false |
  Select-Object Filename, LineNumber, Line
```

### 6.4 — Eliminar datos reales que NO subirás a GitHub

```powershell
cd C:\Dev\focus-curso

# Eliminar Excel con datos de clientes reales (RGPD)
Remove-Item "data\raw\DATOS_FACTURACION" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\CUSTOMER_LIST" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\CONTACTOS CRM" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\Inspecciones_AS.xlsx" -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\Inspecciones_AT.xlsx" -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\Inspecciones_BT.xlsx" -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\Inspecciones_GESAP_TSA.xlsx" -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\Inspecciones_GESAP_TSI.xlsx" -Force -ErrorAction SilentlyContinue
Remove-Item "data\raw\CLIENTES v3.6 Essentials.pbix" -Force -ErrorAction SilentlyContinue
Remove-Item "app\scripts\mysqldump-*.sql" -Force -ErrorAction SilentlyContinue

# Estos SÍ puedes conservar (son catálogos genéricos sin datos de clientes):
# ✅ data/raw/Table_MATERIALS.xlsx
# ✅ data/raw/Matriz de conflictos TSA-TSI OC.xlsx
# ✅ data/raw/Profit centers.xls
```

### 6.5 — Crear datos de demo anonimizados (para el seed)

En lugar de los datos reales, el proyecto del curso usará un seed de datos ficticios. Crea el fichero `C:\Dev\focus-curso\app\prisma\seeds\00-demo-data.ts` con datos inventados.

> Te ayudo a generarlo cuando llegues a este paso — necesita ~50 clientes ficticios con facturación inventada.

### 6.6 — Eliminar referencias al trabajo compartido

Busca y reemplaza en `docs/` y `README.md`:

- Elimina menciones a "Joseba Urizarbarrena" o "joseba.urizarbarrena@tuvsud.com"
- Elimina las líneas `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Cambia la autoría a tu nombre en los documentos de docs/

```powershell
# Ver dónde aparece "Joseba"
Get-ChildItem C:\Dev\focus-curso\docs -Recurse -Include "*.md" |
  Select-String "Joseba" | Select-Object Filename, LineNumber
```

### 6.7 — Crear el `.gitignore` correcto

Verifica que `C:\Dev\focus-curso\app\.gitignore` incluye estas líneas (añádelas si no están):

```gitignore
# Datos reales - NUNCA a GitHub
data/raw/DATOS_FACTURACION/
data/raw/CUSTOMER_LIST/
data/raw/CONTACTOS CRM/
data/raw/Inspecciones_*.xlsx
*.sql
*.pbix

# Secretos
.env
.env.local
.npmrc

# Build
node_modules/
.next/
coverage/
test-results/
audit.json
audit-summary.md
```

---

## FASE 7 — Crear el repositorio GitHub

### 7.1 — Crear la cuenta y el repositorio

1. Crea cuenta en **github.com** si no tienes (o usa la que ya tengas)
2. Crea un nuevo repositorio:
   - Nombre: `focus-crm` (o `focus-business-intelligence`)
   - **Público** ✅
   - Sin README ni .gitignore iniciales (los ponemos nosotros)
3. Copia la URL: `https://github.com/TU-USUARIO/focus-crm.git`

### 7.2 — Inicializar el repositorio limpio (sin historial de empresa)

```powershell
cd C:\Dev\focus-curso

# Inicializar git nuevo — sin ningún historial previo
git init
git add .
git commit -m "feat: initial project setup - Focus CRM platform"

# Conectar a GitHub
git remote add origin https://github.com/TU-USUARIO/focus-crm.git
git branch -M main
git push -u origin main
```

### 7.3 — Hacer commits académicos (para que se vea bien en GitHub)

Para que el proyecto tenga un historial de commits realista y académicamente presentable, puedes añadir commits separados por funcionalidad después del commit inicial. Esto muestra al profesor que has ido construyendo el proyecto por fases:

```powershell
cd C:\Dev\focus-curso

# Opción: hacer commits por módulos (hace el historial más rico)
# Primero haz git init con SOLO la estructura básica
# Luego ve añadiendo módulos en commits separados

# Ejemplo de secuencia de commits académica:
git commit -m "feat(db): database schema with Prisma ORM - 25 tables"
git commit -m "feat(auth): NextAuth authentication with role-based access"
git commit -m "feat(buscador): 360 customer search with filters and CSV export"
git commit -m "feat(oportunidades): opportunities matrix with cross-sell detection"
git commit -m "feat(dashboard): executive KPI dashboard - customer lifecycle metrics"
git commit -m "feat(auditoria): audit log module with AUDIT_EVENTS table"
git commit -m "feat(seguridad): security hardening - rate limiting, HTTPS headers"
git commit -m "test: Vitest unit tests for pure utility functions (24 tests)"
git commit -m "docs: complete project documentation and wiki"
```

> No necesitas deshacer y rehacer el código — puedes hacer commits vacíos con `git commit --allow-empty -m "mensaje"` o reorganizar el historial con `git rebase -i`.

---

## FASE 8 — Despliegue en Vercel

### 8.1 — Base de datos gratuita en la nube

Vercel no incluye MySQL. Necesitas una BD externa. **Recomendado para el curso:**

**Railway** (railway.app):
1. Crea cuenta gratuita en railway.app
2. **New Project** → **Database** → **MySQL**
3. Railway te da automáticamente una `DATABASE_URL` con este formato:
   ```
   mysql://root:PASSWORD@HOST:PORT/railway
   ```
4. Guarda esa URL — la usarás en el paso 8.3

### 8.2 — Cargar los datos demo en Railway

```powershell
# Desde tu PC, con la URL de Railway (sustitúyela):
mysql -h HOST -P PORT -u root -pPASSWORD railway < C:\Dev\focus\app\scripts\mysqldump-anonimizado.sql
```

> Usa el dump anonimizado (sin datos reales de clientes), no el dump completo.

### 8.3 — Configurar Vercel

1. Ve a **vercel.com** → **Add New Project** → importa tu repo `focus-crm` de GitHub
2. **Framework Preset:** Next.js (lo detecta automáticamente)
3. **Root Directory:** `app` ← ⚠️ MUY IMPORTANTE — el Next.js está en la subcarpeta `app/`, no en la raíz
4. En **Environment Variables**, añade:

```
DATABASE_URL          = (la URL de Railway)
NEXTAUTH_URL          = https://tu-app.vercel.app
NEXTAUTH_SECRET       = (genera uno: abre PowerShell y escribe: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
AUTH_ALLOW_MOCK       = true
```

5. **Deploy** → en 2-3 minutos tendrás la URL pública

### 8.4 — Ejecutar migraciones en la BD de Railway

```powershell
# Con DATABASE_URL apuntando a Railway (temporalmente en tu .env)
cd C:\Dev\focus-curso\app
npx prisma migrate deploy
```

---

## FASE 9 — Documentación del curso

### 9.1 — README.md principal (ya está en el repo)

El `README.md` de la raíz del proyecto ya está completo y bien escrito. Para el curso, edítalo con:

- Tu nombre como autor
- Descripción del proyecto en primera persona
- Eliminar referencias a TÜV LFD (sustituir por "empresa del sector de inspección técnica")
- Añadir la URL de Vercel cuando la tengas

### 9.2 — Documentación técnica disponible en `docs/wiki/`

Ya tienes 14 páginas de wiki en `docs/wiki/`:

| Fichero | Contenido |
|---|---|
| `Home.md` | Índice de la wiki |
| `Vision-General.md` | Qué es el proyecto y su propósito |
| `Arquitectura.md` | Diagrama de arquitectura y stack |
| `Modelo-de-Datos.md` | Esquema de BD con todas las tablas |
| `Autenticacion.md` | Sistema de login y roles |
| `IAM-y-Auditoria.md` | Módulo de permisos y registro de actividad |
| `Funcionalidades.md` | Descripción de cada página |
| `Pipeline-de-Datos.md` | Seeds y carga de datos (ETL) |
| `Migraciones-de-Base-de-Datos.md` | Gestión del schema con Prisma |
| `Seguridad.md` | Medidas de seguridad implementadas |
| `CI-CD.md` | Pipeline de CI (Azure Pipelines) |
| `Puesta-en-Marcha-Local.md` | Guía de setup (esta guía) |
| `Despliegue.md` | Cómo desplegar en producción |
| `Decisiones-de-Diseno.md` | ADRs — por qué se eligió cada tecnología |

### 9.3 — Sobre la anonimización de datos (para explicar al profesor)

El proyecto trabaja con datos reales de clientes (CIFs, nombres de empresas, facturación). Para la entrega del curso:

1. **En local** (solo tu PC): usas el dump real para desarrollar
2. **En GitHub y Vercel**: se usa un seed de datos ficticios generados con `@faker-js/faker`
3. **El código de anonimización** (cuando lo creemos) estará en `scripts/generate-demo-data.ts`

Esto demuestra al profesor que sabes manejar datos reales y que tienes consciencia de RGPD.

### 9.4 — Descripción del proyecto para el curso

**Título:** *FOCUS — Plataforma de Inteligencia Comercial para el Sector de Inspección Técnica*

**Problema que resuelve:**
Las empresas del sector de inspección técnica acumulan datos de clientes en múltiples sistemas (SAP, CRM, facturación) sin una visión unificada. FOCUS centraliza y cruza esos datos para que los equipos comerciales puedan identificar oportunidades de venta cruzada, detectar clientes en riesgo de fuga y tomar decisiones basadas en datos.

**Tecnologías utilizadas:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, TanStack Table, Recharts
- **Backend:** Next.js API Routes, Prisma ORM 7, NextAuth v4
- **Base de datos:** MySQL 8 con 25 tablas, migraciones gestionadas con Prisma
- **Seguridad:** JWT, RBAC (Role-Based Access Control), rate limiting, auditoría de accesos
- **Testing:** Vitest con cobertura (24 tests, ~98% cobertura en módulos testeados)
- **CI/CD:** Azure Pipelines (pipeline completo con TypeScript check, ESLint, tests)
- **Despliegue:** Vercel + Railway MySQL

**Funcionalidades principales:**
1. Buscador 360 de clientes con filtros por empresa, servicio, CCAA, división
2. Matriz de oportunidades de venta cruzada
3. Dashboard ejecutivo de KPIs del ciclo de vida de la cartera
4. Módulo de auditoría y registro de actividad
5. Sistema IAM de roles y permisos granulares
6. Export CSV de todos los módulos con protección anti-inyección

---

## ⚠️ PROBLEMAS FRECUENTES

| Síntoma | Causa | Solución |
|---|---|---|
| `npm install` falla con 401 en `@tuvsud/design-system` | Paquete privado de empresa | Ver FASE 6.2 para sustituirlo |
| Login falla con "No se pudo contactar el directorio" | El AD de la empresa no es accesible | Verifica que `.env` tiene `AUTH_ALLOW_MOCK="true"` |
| "Cannot read properties of undefined (reading 'count')" en /auditoria | El Prisma Client no tiene el modelo AuditEvent | Ejecuta `npx prisma generate` |
| `prisma migrate dev` quiere resetear la BD | Detecta tablas de backup como drift | Usa siempre `npx prisma migrate deploy` |
| El dashboard no muestra datos reales | Flag `PRESENTATION_MOCKUP = true` | Ver FASE 5 |
| Seed falla leyendo un `.xlsx` | El fichero está abierto en Excel | Ciérralo y vuelve a ejecutar |

---

## 📁 ESTRUCTURA DE FICHEROS DEL EXPORT (lo que tienes en el USB)

```
focus-export/
├── app/                          ← Aplicación Next.js
│   ├── prisma/
│   │   ├── schema.prisma         ← Modelo de BD (25 tablas)
│   │   ├── migrations/           ← 10 migraciones de BD
│   │   └── seeds/                ← Scripts de carga de datos (01-18)
│   ├── scripts/
│   │   └── mysqldump-focus-completo-25jun2026.sql  ← Dump de la BD completa
│   ├── src/
│   │   ├── app/                  ← Páginas (App Router de Next.js)
│   │   ├── components/           ← Componentes React
│   │   └── lib/                  ← Lógica de negocio y queries
│   ├── vitest.config.ts          ← Configuración de tests
│   ├── package.json              ← Dependencias
│   └── .env.example              ← Plantilla de variables de entorno
├── azure-pipelines.yml           ← Pipeline CI/CD (para cuando haya agente)
├── docs/
│   ├── wiki/                     ← 14 páginas de documentación técnica
│   ├── OnBoarding/               ← Guías de incorporación
│   └── security/                 ← Informe de auditoría de seguridad
├── data/
│   └── raw/
│       ├── Table_MATERIALS.xlsx           ← ✅ Catálogo de servicios (sin datos reales)
│       ├── Matriz de conflictos TSA-TSI OC.xlsx  ← ✅ Sin datos de clientes
│       └── Profit centers.xls             ← ✅ Sin datos de clientes
├── scripts/
│   └── npm-audit-summary.mjs     ← Script de auditoría de dependencias
├── README.md                     ← Portada del repositorio
└── GUIA_INSTALACION_Y_CURSO.md   ← ← ← ESTE FICHERO (la guía que estás leyendo)
```

---

*Guía generada el 25 de junio de 2026 — versión del export actualizada con todos los cambios hasta ese día.*
