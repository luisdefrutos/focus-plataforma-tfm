# Focus — Aplicación web

Plataforma de inteligencia comercial de TÜV SÜD España: Golden Record de clientes, Buscador 360, segmentación, top clientes, catálogo de servicios y administración de accesos (IAM). Sustituye al informe Power BI "CLIENTES v3.6 Essentials".

**Stack**: Next.js 16 (App Router) · React 19 · Prisma 7 (adapter MariaDB) sobre MySQL 8 · next-auth v4 (JWT) · Tailwind 4 · `@tuvsud/design-system` (Algorithm) · recharts · TanStack Table.

> Contexto de proyecto, modelo de datos y convenciones: ver [../CLAUDE.md](../CLAUDE.md) y [docs/OnBoarding](../docs/OnBoarding/Focus_Technical_and_Functional_Overview.md).

## Puesta en marcha

1. **MySQL 8** corriendo en `localhost:3306`. Bootstrap inicial (BD `focus_dev` + usuario): scripts en [../db/setup/](../db/setup/).
2. **Variables de entorno**: copia `.env.example` a `.env` y rellena `DATABASE_URL` y `NEXTAUTH_SECRET`.
3. **Dependencias y esquema**:

   ```bash
   npm install
   npx prisma migrate dev    # aplica migraciones (ver nota de drift más abajo)
   ```

4. **Datos** (los Excel fuente viven en `../data/raw/`, no están en git):

   ```bash
   npm run seed              # catálogos ligeros: org + servicios + estados + CNAE
   npm run seed:billing      # CUSTOMER_MASTER + BILLING_RECORDS (por defecto 2024-2026; añade años como args)
   npm run seed:customers    # enriquecimiento desde CUSTOMER_LIST + direcciones
   npm run seed:contacts     # contactos CRM
   npm run seed:normalize    # normaliza ciudad/provincia/CP/teléfono
   npm run seed:iam          # roles, permisos y usuarios de prueba
   npm run seed:inspections  # módulo de activos inspeccionables (ascensores)
   npm run backfill:salesorder
   npm run seed:org-contacts
   npm run seed:customer-cnae # clasificación CNAE por cliente (depende de seed:customers + seed:cnae)
   npm run seed:org-backfill  # golden record universal por CIF (organizaciones + org_id; depende de billing+customers)
   npm run seed:dedupe-contacts # borra contactos duplicados por organización (re-ejecutar tras seed:contacts/org-contacts)
   ```

5. **Servidor de desarrollo**:

   ```bash
   npm run dev               # http://localhost:3000
   ```

6. **Login**: valida **usuario + contraseña contra Active Directory** mediante el web service SOAP corporativo (`LoginLDAP_AD`; ver [`src/lib/ad-soap.ts`](src/lib/ad-soap.ts)). Requiere `AD_SOAP_LDAP_KEY` en `.env` — el `passport` del servicio se calcula como `MD5(user + clave)` (replica la función `Encripta()` de las apps internas). Solo entran usuarios dados de alta en `APP_USERS` (se crean desde `/accesos`, que verifica el `user_id` en AD y autorrellena el nombre). Para desarrollo **sin conexión** hay un *mock* opt-in (`AUTH_ALLOW_MOCK=true`) que **no** comprueba la contraseña.

## Notas operativas

- **Migraciones**: 7 en total. La última (`20260610000000_db_push_catchup`) formaliza el módulo de inspecciones y `sales_order_number`, que se habían aplicado con `prisma db push`. Un `prisma migrate deploy` limpio reconstruye el esquema completo (verificado: diff final contra el schema = 0).
- **Caché**: las agregaciones de solo lectura se cachean 5 min (tag `billing`). Tras re-seedear, refresca con `POST /api/revalidate`.
- **RLS**: el alcance por usuario (BUs + `allowed_filters`) se aplica en las queries de servidor (`src/lib/queries/`). Toda query cacheada debe recibir ese alcance como argumento — forma parte de la clave de caché.
- **Sesión one-tab**: la app fuerza una única pestaña activa; las cookies de sesión expiran al cerrar el navegador.

## Estructura

```
src/
├── app/(dashboard)/    # Páginas: dashboard, clientes, clientes/[id], segmentacion,
│                       #   top-clientes, catalogo (DATA_MANAGE), accesos (IAM_MANAGE), login
├── app/api/            # auth/[...nextauth], clientes/export (CSV), revalidate
├── components/         # Por feature: buscador/, cliente/, segmentacion/, accesos/, layout/, ui/
├── lib/                # auth.ts (RBAC+scope), cache.ts, prisma.ts, spain.ts (CCAA/provincias)
│   └── queries/        # Lógica de datos server-side (customers, dashboard, segmentacion, …)
└── proxy.ts            # Middleware de autenticación (Next 16)

prisma/
├── schema.prisma       # Esquema canónico (23 tablas)
├── migrations/
└── seeds/              # Seeds 01-12 (ver tabla en ../CLAUDE.md)
```
