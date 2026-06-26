# Seguridad

> Informe completo: **`docs/security/AUDITORIA_SEGURIDAD_2026-06-22.md`**. Esta página resume la postura y, sobre todo, las **acciones operativas pendientes** para producción.

## Modelo de amenaza

Focus es una **herramienta interna corporativa de BI de solo lectura**, accesible en la red corporativa, con login real contra Active Directory y **RLS deliberadamente desactivado** (todos los usuarios autenticados ven todos los datos — decisión de negocio, no un fallo). Ver [Autenticación](/Autenticacion).

## Postura general

La auditoría (22-jun-2026, multiagente sobre 11 dimensiones con verificación adversarial) concluyó que la postura es **sólida para una herramienta interna**:

- **Sin** lectura de datos sin autenticación.
- **Sin** inyección SQL explotable: pese al uso intensivo de `$queryRawUnsafe`, todo valor de usuario va **parametrizado con `?`** o restringido a listas blancas/enteros.
- **Sin** escalada de privilegios a `IAM_MANAGE` desde la aplicación.
- React autoescapa y no hay `dangerouslySetInnerHTML`; el cliente SOAP escapa el XML y verifica TLS.

Los problemas se concentraron en **endurecimiento operativo y de configuración**, no en agujeros remotos.

## Remediación ya aplicada (en `main`)

Casi todos los hallazgos se corrigieron en código:

- **Inyección de fórmulas CSV** neutralizada en un helper compartido (`lib/csv.ts`): prefija `'` a los valores que empiezan por `= + - @`.
- **Cabeceras de seguridad** en `next.config.ts`.
- **TLS del adapter MariaDB** por entorno (`prisma.ts`).
- **Rate-limiting** de login y exports (`lib/rate-limit.ts`).
- **Auditoría endurecida**: saneado de entrada, IP por proxy de confianza, evento `AUTHZ_DENIED`.
- **Escape de `LIKE`** en búsquedas (`customers.ts`).
- **`/api/revalidate`** exige `IAM_MANAGE` + comparación con `timingSafeEqual`.
- **Guardas de sesión** en `segmentacion` y `top-clientes`.
- **PII fuera de git**: reglas en `.gitignore` + `git rm --cached` de ficheros con datos reales (`app/scratch/*`, `app/test_export.csv`, etc.).

### Hallazgo A-1 NO corregido (a propósito)

`AUTH_ALLOW_MOCK` sin guarda de `NODE_ENV` en `auth.ts` — **decisión del usuario**: ese código no estará en producción. Aun así, es el riesgo más grave si la variable se cuela en un `.env` de producción (login como admin sin contraseña). Trátalo con cuidado. Ver [Autenticación → Modo mock](/Autenticacion#modo-mock-solo-desarrollo).

## ⚠️ Acciones operativas pendientes (no son código)

Estas tareas son de **infraestructura/operaciones** y deben hacerse al desplegar:

1. **Rotar la contraseña del usuario MySQL `focus_app`.** La contraseña *viva* parece ya rotada (difiere de la del historial), pero la antigua sigue en el **historial de git** (`app/scratch/explain.js`, `app/run_bench.ts`). Conviene **purgar el historial** (`git filter-repo` / BFG) para limpieza.
2. **En producción, configurar el entorno**:
   - `DATABASE_SSL=true` (si no, `prisma.ts` lanza para hosts remotos).
   - `TRUSTED_PROXY_HOPS=<nº de proxies>` (para que la IP de auditoría sea fiable; sin proxy de confianza, la cabecera `X-Forwarded-For` es falsificable).
   - **Reiniciar** el servidor para cargar las cabeceras de seguridad (`next.config.ts` no se recarga en caliente; verificar con `curl -I /login`).
3. **Borrar/mover** `docs/executive/backfill_cif_recuperado.csv` (PII: CIF reales; ya gitignoreado, pero sigue en disco).
4. **(Investigado — no es fuga) Token del feed Azure Artifacts en `app/.npmrc`.** Detectado al montar CI (2026-06-24). Resultó que `app/.npmrc` **está gitignored y nunca se versionó** (sin historial git): el token del feed `design-system` **nunca se filtró al repositorio**, es una credencial **local** de desarrollo. No hay nada que purgar. Hardening opcional: usar `vsts-npm-auth` para guardar el token a nivel de usuario en vez del fichero del proyecto. El pipeline **genera su propio `.npmrc` sin token** en CI. Ver [CI/CD](/CI-CD).

## Residuales menores conocidos

De la re-auditoría tras el endurecimiento (todos **low/info**, ninguno high/medium, sin regresiones):

- Export de auditoría sin rate-limit.
- `catalog.ts` y la búsqueda libre de auditoría sin `escapeLike`.
- `?checkOnly` consume cuota de rate-limit (doble conteo).
- `sanitize()` no cubre separadores Unicode/bidi ni trunca por *code-point*.
- Validación de fecha en filtros de auditoría (`Invalid Date` → 500).
- Rate-limit **en memoria** (no sirve para multi-instancia ni sobrevive a reinicios).

## Deferidos con justificación

- Cambiar `xlsx@0.18.5` en los seeds (solo offline, sin superficie web).
- Instalar el paquete `server-only` (mitigado parcialmente moviendo `normalizeUsername` a `lib/username.ts`).

> **Siguiente**: [Puesta en Marcha Local](/Puesta-en-Marcha-Local) — montar el entorno de desarrollo.
