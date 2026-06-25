# CI/CD (Pipelines)

Focus usa **Azure Pipelines**. Hoy hay un único pipeline de **CI / test** que valida el código **en cada push a `main`** (`trigger: main`). Puede además usarse como **puerta de revisión de código** activándolo como *Build Validation* en una política de rama (opcional — ver más abajo). El despliegue automático a producción está **planificado**, no activo (ver al final).

Fichero: **[`azure-pipelines.yml`](/azure-pipelines.yml)** (raíz del repo).

## Qué hace el pipeline de CI

El pipeline combina **validación estática** del código de `app/` con una **suite mínima de tests unitarios**:

| Paso | Comando | Bloqueante |
|---|---|---|
| Instalar dependencias | `npm ci` (lockfile) | ✅ |
| Generar cliente Prisma | `npx prisma generate` | ✅ |
| Validar esquema | `npx prisma validate` | ✅ |
| Comprobación de tipos | `npx tsc --noEmit` | ✅ |
| Lint | `npm run lint` (ESLint) | ✅ |
| Tests + cobertura | `npm run test:coverage` (Vitest) | ✅ |
| Auditoría de dependencias | `npm audit` | ℹ️ informativo |

Los resultados de los tests se publican en el pipeline: **JUnit** → pestaña *Tests*, **Cobertura** → pestaña *Code Coverage*.

> **Lint bloqueante.** `main` está a **0 errores** de ESLint (los 35 que había se corrigieron el 2026-06-24: `no-explicit-any` tipados, `require`→`import`, `prefer-const`, scratch `apply-pushdown.js` eliminado, efectos URL→estado pasados al patrón idiomático de React). Quedan **25 warnings** preexistentes (`no-unused-vars`) que **no** bloquean (ESLint sale con código 0 si solo hay warnings). Para exigir también 0 warnings, añade `-- --max-warnings 0` al script `lint`.

Ni `prisma generate`/`validate` ni `tsc` conectan a la base de datos: el pipeline les pasa un `DATABASE_URL` **dummy** (no es un secreto, solo evita que `prisma.config.ts` falle por variable ausente).

## Tests y cobertura

Los tests usan **Vitest** y viven junto al código como `src/**/*.test.ts`. De momento es una **suite mínima de funciones puras** (sin BD, red ni DOM), pensada como base para crecer:

| Módulo | Qué cubre |
|---|---|
| `src/lib/sql.ts` | `escapeLike` (escape de comodines LIKE) |
| `src/lib/csv.ts` | `csvCell` (entrecomillado RFC-4180 + anti-inyección de fórmulas CSV) |
| `src/lib/username.ts` | `normalizeUsername` (sAMAccountName de AD) |
| `src/lib/spain.ts` | `pc2CodesForProvince` / `pc2CodesForCcaa` / `classifyEntity` |

En local:

```bash
npm test               # ejecuta los tests una vez
npm run test:watch     # modo watch (desarrollo)
npm run test:coverage  # tests + informe de cobertura
```

> **Cobertura acotada a propósito.** El `coverage.include` de `vitest.config.ts` apunta **solo** a esos 4 módulos con tests, así que el % refleja *"de lo que tiene tests, cuánto se cubre"* (~98%), no del app entero. Para ampliar: añade tests y mete sus ficheros en `coverage.include`. Los artefactos (`coverage/`, `test-results/`) están gitignored.

## Seguridad: auditoría de dependencias

Cada run ejecuta **`npm audit`** sobre las dependencias y surfacea las vulnerabilidades conocidas de tres maneras:

- **En el log** del paso (informe completo).
- **Resumen en la página del run**: tabla por severidad con enlaces a los avisos, rango vulnerable y fix disponible (vía `##vso[task.uploadsummary]`; el conversor `npm audit --json` → Markdown es [`scripts/npm-audit-summary.mjs`](/scripts/npm-audit-summary.mjs)).
- **Artefacto `npm-audit`** descargable (el `audit.json` completo).

Es **informativa** (no bloquea el build): hoy hay ~12 vulnerabilidades, casi todas en dependencias **transitivas y dev-only** (no llegan al bundle de producción). Para hacerla **bloqueante** por severidad, añade un paso con `npm audit --audit-level=high` (sin `|| true`).

> Opciones más avanzadas (no activas): publicar **SARIF** a la pestaña **Scans** (extensión *SARIF SAST Scans Tab*) o **GitHub Advanced Security for Azure DevOps** (dependency/secret/code scanning nativo, de pago).

## Dependencia: feed privado de Azure Artifacts

`@tuvsud/design-system` se instala desde un **feed privado** de Azure Artifacts (`tuvsud01/_packaging/design-system`), no desde npmjs. La configuración del registro vive en `app/.npmrc`, que está **gitignored** (`app/.gitignore`) — no se versiona, para no arrastrar tokens. Por eso el pipeline **genera un `.npmrc` sin token** (solo el mapeo `@tuvsud:registry=…`) y el paso **`npmAuthenticate@0`** le inyecta las credenciales con la **identidad del pipeline** — sin tokens ni en el YAML ni en el repo.

**Requisito de permisos (una vez):** la identidad de build **`Focus Build Service (tuvsud01)`** debe tener rol **Reader** (o Collaborator) sobre el feed `design-system`:

1. Azure DevOps → **Artifacts** → feed `design-system` → **⚙ Feed settings** → **Permissions**.
2. **Add users/groups** → añade `Focus Build Service (tuvsud01)` con rol **Reader**.

**En local**, cada desarrollador necesita su propio `app/.npmrc` (gitignored) con el mapeo del registro y un token. Lo recomendado en Windows es `npx vsts-npm-auth -config .npmrc`, que guarda el token en tu `~/.npmrc` de **usuario** (no en el del proyecto).

> ℹ️ **Nota de seguridad.** `app/.npmrc` **nunca estuvo versionado** (está en `app/.gitignore` y no tiene historial git), así que el token del feed **nunca se filtró al repositorio** — es una credencial **local** de desarrollo. Ver [Seguridad](/Seguridad).

## Cómo crear el pipeline en Azure DevOps (una vez)

1. Azure DevOps → proyecto **Focus** → **Pipelines** → **New pipeline**.
2. **Azure Repos Git** → repo **Focus**.
3. **Existing Azure Pipelines YAML file** → rama `main` → `/azure-pipelines.yml`.
4. **Run** (o **Save**). El primer run valida que todo está verde.

## Convertirlo en puerta de revisión de código (Branch Policy)

En Azure Repos, la validación de PR **no** se activa con la clave `pr:` del YAML, sino con una **política de rama**:

1. **Project Settings** → **Repositories** → repo **Focus** → pestaña **Policies** → rama **`main`**.
2. **Build Validation** → **+** → selecciona el pipeline de CI.
3. Configura:
   - **Trigger**: Automatic.
   - **Policy requirement**: **Required** (bloquea el merge si falla).
   - **Path filter**: opcional (p. ej. `/app/*` para no correr si solo cambian docs).
4. (Recomendado) En la misma página, exige **mínimo 1 revisor** y *"Check for linked work items"* si aplica.

A partir de ahí, **todo PR a `main` debe pasar el pipeline** (tipos + esquema) para poder fusionarse — esa es la revisión de código automatizada.

## Roadmap: ramas dev/prod y despliegue (planificado)

Lo siguiente está **previsto**, aún no implementado:

- **Ramas**: una rama de **desarrollo** (`develop`) y otra de **producción** (`main` o `release`). El CI correría en ambas; la build validation se aplicaría a las dos.
- **Despliegue**: un **stage de Deploy** condicionado a la rama de producción, contra un **Environment** de Azure DevOps (`focus-produccion`) con aprobaciones manuales. El esqueleto está comentado al final de `azure-pipelines.yml`.
- Encaja con el método de promoción descrito en [Despliegue](/Despliegue) (la app corre en el propio servidor `sesmade77033` porque `focus-fu` está restringido a `localhost`).

> El stage de Deploy se añadirá cuando exista el entorno de despliegue. De momento, **solo CI/test**.

> **Relacionado**: [Despliegue](/Despliegue) · [Seguridad](/Seguridad) · [Migraciones](/Migraciones-de-Base-de-Datos)
