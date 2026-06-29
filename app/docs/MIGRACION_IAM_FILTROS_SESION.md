# Documentación de Cambios: Módulo IAM, Optimización y Sesiones

Este documento detalla las últimas implementaciones realizadas en el proyecto Focus para sincronizar el trabajo con el equipo.

## 1. Módulo de Autenticación y Autorización (IAM)
Se ha implementado un sistema completo de Gestión de Identidad y Accesos (IAM) con control de acceso basado en roles (RBAC) y filtrado a nivel de fila (RLS) basado en Business Units (BU).

### Base de Datos
Se han añadido 4 nuevas tablas al esquema Prisma (`prisma/schema.prisma`):
- `APP_ROLES`: Catálogo de roles (ej. Comercial, Administrador Total).
- `APP_PERMISSIONS`: Permisos granulares técnicos (ej. `IAM_MANAGE`).
- `APP_ROLE_PERMISSIONS`: Relación N:M que define qué permisos tiene cada rol.
- `APP_USER_ROLES`: Asignación que une Usuario + Rol + Business Unit (BU). Esto permite que un usuario sea "Comercial" solo en ciertas BUs.

### Panel de Administración de Accesos
- **Ruta:** `/accesos` (Protegido por el permiso `IAM_MANAGE`).
- Permite gestionar qué usuarios tienen qué roles y a qué combinaciones de Sociedad / División (Business Units) tienen acceso.
- Los usuarios nuevos que inician sesión se autogeneran sin permisos ("Sin Perfil"). Un administrador debe asignarles alcance y roles para que vean datos.

### 1.1 Flujo de Autenticación
El login valida las credenciales **reales** contra el **Active Directory corporativo** a través de un **web service SOAP** (`LoginLDAP_AD` de `gestion.atisae.com/loginwebservice/login.asmx`; cliente en `src/lib/ad-soap.ts`).

**A. ¿Cómo funciona el login?**
- El usuario introduce su **usuario de Windows** (ej. `moure-dev` o `WW001\moure-dev`) y su **contraseña** corporativa.
- La app llama a `LoginLDAP_AD(user, password, passport)`, donde `passport = MD5(user + CLAVE_ENCRIPTACION_LDAP)` — replica la función `Encripta()` de las apps internas. La clave va en `.env` (`AD_SOAP_LDAP_KEY`) y **nunca** se versiona.
- Si AD responde `OK`, se comprueba que el usuario exista y esté **activo** en `APP_USERS`. Si es así, se cargan sus permisos/roles/alcance (RLS) y entra; si no, se deniega el acceso aunque las credenciales AD sean válidas.
- El servicio devuelve estados precisos que se traducen a mensajes: `USUARIO_NO_EXISTE`, `CONTRASENNA_INCORRECTA`, `USUARIO_DESHABILITADO`, `ERROR_NO_CONTROLADO`.

**B. Alta de usuarios (panel `/accesos`)**
- El administrador teclea solo el `user_id`; la app lo verifica contra AD con `ExisteUsuarioLDAP_AD` y autorrellena el **nombre** desde el directorio (el **email** se prerellena si AD lo devuelve y queda **editable**, porque AD no siempre trae `mail`). No se crea el usuario si no existe en AD.

**C. Desarrollo sin conexión (mock opt-in)**
- Con `AUTH_ALLOW_MOCK=true` en `.env`, el login **no** valida la contraseña (solo que el usuario exista en `APP_USERS`). Úsalo únicamente en local sin acceso al web service; por defecto la validación va siempre por SOAP.

**D. Sobre el "SSO transparente" (sin contraseña)**
- Un login que detecte automáticamente el usuario de Windows requeriría Windows Integrated Auth (IIS/Kerberos) o Azure AD, que **no** se usan aquí: la integración emplea **solo los métodos SOAP**, por lo que el login **siempre pide usuario y contraseña**. Para usuarios externos sin cuenta AD, en el futuro podría añadirse un segundo proveedor de credenciales locales (contraseña hasheada con `bcrypt` en `APP_USERS`), reutilizando el mismo sistema de roles/RLS.

---

## 2. Optimización de Rendimiento en el Buscador 360
Anteriormente, un usuario comercial que tuviera cientos de BUs asignadas sin un filtro explícito colapsaba la base de datos debido a que la consulta SQL inyectaba más de 2000 parámetros (`IN (...)`) para Centros de Coste y Materiales en una cláusula `EXISTS`.

### Solución
- **Filtros Inteligentes (Bypass de RLS)**: En `src/lib/queries/customers.ts`, si se detecta que el usuario tiene acceso al 100% de los elementos de un catálogo (por ejemplo, tiene permiso sobre los más de 1500 materiales permitidos), **se anula el filtrado a nivel de base de datos** para esa columna.
- Al no aplicar restricciones redundantes en SQL, las consultas vuelven a cargar de forma instantánea (menos de 100ms frente al timeout).

---

## 3. Seguridad Estricta de Sesión (One-Tab Session)
Para mejorar la seguridad corporativa, se ha modificado la política de persistencia de sesión:

- **Cookies Efímeras:** Se han reconfigurado las 3 cookies de Next-Auth (`session-token`, `csrf-token`, `callback-url`) para eliminar el atributo `maxAge`. Ahora son **Session Cookies**, lo que significa que el navegador las destruye automáticamente al cerrarse por completo.
- **SessionStorage Guard (`AutoLogout`)**: Se implementó una marca `focus-tab-active` en el `sessionStorage` (que es independiente para cada pestaña). Si el usuario cierra la pestaña (pero no el navegador), la marca se destruye. Al volver a abrir la URL, un guardián intercepta la falta de marca y fuerza un `signOut()`, requiriendo un nuevo login.
- **Timeout de Inactividad**: Se mantiene el cierre automático por inactividad del teclado/ratón tras 15 minutos.

---

## 4. Filtros en Cascada (Sociedad → División)
En el panel del Buscador 360, los combos de Sociedad y División ahora están vinculados dinámicamente.

- **Antes:** Seleccionar una Sociedad no filtraba las opciones de División; siempre salían todas las divisiones de todos los BUs del usuario.
- **Ahora:** En `src/lib/queries/customers.ts` se precalcula un `entityDivisionMap`. Cuando el usuario selecciona una o varias Sociedades, el componente `FilterBar` (`src/components/buscador/filter-bar.tsx`) filtra en tiempo real el desplegable de Divisiones para mostrar **exclusivamente las divisiones que operan en las sociedades seleccionadas**.

---

# Script de Migración para el Compañero

Para que tu compañero pueda sincronizar su entorno local de desarrollo con estos cambios sin sufrir errores de esquema o falta de datos, debe ejecutar los siguientes comandos en su terminal (en el directorio `app`):

### Paso 1: Actualizar dependencias (por si acaso)
```bash
npm install
```

### Paso 2: Aplicar la migración de la base de datos
Esto actualizará su base de datos MariaDB local con las nuevas tablas del módulo IAM.
```bash
npx prisma migrate dev
```

### Paso 3: Rellenar la base de datos (Seeding)
Este paso es crucial. Ejecutará el nuevo script `09-iam-setup.ts` para crear los roles básicos (Comercial, Administrador Total), los permisos y asignará el superusuario a su cuenta de desarrollo local para que no se quede bloqueado sin acceso al panel.
```bash
npm run seed:iam
```
*(Nota: Si su base de datos estuviera vacía, simplemente puede lanzar `npm run seed` para poblarlo todo desde cero).*

### Paso 4: Arrancar el entorno
```bash
npm run dev
```

A partir de este momento, cuando tu compañero entre a `http://localhost:3000`, todo su entorno (base de datos, reglas de negocio y seguridad) será idéntico al tuyo.
