# Memoria Técnica (TFM): Autenticación, Pruebas y CI/CD

> **Autor:** Luis de Frutos  
> Este documento extiende la memoria del Trabajo Fin de Máster (TFM) centrada en la Plataforma Focus, detallando las decisiones arquitectónicas de seguridad, la estrategia de validación del software (Testing) y el flujo de integración continua.

---

## 1. Modelo de Autenticación y Autorización (AD vs. Entorno Simulado)

El control de accesos de la plataforma Focus (*Identity and Access Management* - IAM) está diseñado con una arquitectura híbrida para soportar entornos cerrados corporativos (Intranet) y entornos de desarrollo/evaluación (como la defensa del TFM).

### 1.1 Entorno Real: Integración con Active Directory Corporativo (Producción)
En el entorno empresarial, los usuarios no tienen una "contraseña web". En su lugar, el sistema utiliza **delegación de identidad vía Web Service SOAP**:
1. El empleado introduce su ID corporativo (Ej: `lfrutos`) y su contraseña de red.
2. Next.js captura estas credenciales y envía una petición encriptada (MD5 del usuario + semilla corporativa) al endpoint interno `LoginLDAP_AD`.
3. Si el Active Directory aprueba las credenciales, Focus verifica si el usuario está dado de alta en la tabla interna `APP_USERS` y si está `activo`.
4. Solo entonces se emite el *JSON Web Token* (JWT) de sesión. Si un ex-empleado tiene su cuenta de AD dada de baja por RRHH, no podrá acceder aunque siga registrado en la BD.

### 1.2 Entorno Simulado: Modo de Evaluación TFM (`AUTH_ALLOW_MOCK`)
Para poder ejecutar, probar y evaluar la aplicación en la nube (Vercel) sin acceso a la Intranet corporativa privada ni al servidor SOAP, se ha implementado el **Modo de Simulación (Mock)**.

- Se activa mediante la variable de entorno `AUTH_ALLOW_MOCK="true"`.
- **Comportamiento:** En este modo, el sistema puentea temporalmente el envío de la contraseña al Active Directory. Cualquier contraseña tecleada se da por válida **si y solo si** el nombre de usuario existe previamente en la tabla `APP_USERS` de la base de datos (Ej: el usuario `moure-dev`).
- **Seguridad y Auditoría:** Este modo arroja una alerta roja por consola si se levanta en producción, impidiendo despliegues accidentales inseguros. Es estrictamente un puente para entornos académicos y *pipelines* de CI. Además, por principios de *Compliance*, todo inicio de sesión realizado bajo este método registra el metadato explícito `{"mock": true}` en los logs de auditoría (tabla `APP_AUDIT_LOGS`), asegurando una total transparencia sobre cuándo se empleó la validación alternativa en lugar del Directorio Activo real.

---

## 2. Flujo de Integración y Despliegue Continuo (CI/CD)

El proyecto se despliega de manera automatizada utilizando repositorios Git y arquitecturas *Serverless*.

### 2.1 Pipeline de Vercel & Base de Datos (TiDB)
Dado el contexto del TFM, la arquitectura de despliegue se moderniza:
- **Frontend y API Serverless (Vercel)**: La plataforma Next.js está conectada directamente a la rama `main` de GitHub. Cada *push* o *Merge Request* dispara un despliegue donde se compila el código y se ejecutan linters.
- **Base de Datos Gestionada (TiDB)**: MySQL/TiDB se aloja en la nube, proporcionando conexión TCP cifrada con TLS al frontend en Vercel. 
- **Flujo**: GitHub → Hook a Vercel → Build (`npm run build`) → Despliegue de los Serverless Functions → Online.

### 2.2 Validación Automática con GitHub Actions (QA)
Para asegurar la calidad del código, se ha implementado un flujo de trabajo (Workflow) en **GitHub Actions** (`ci.yml`):
1. **Ejecución de Tests (Vitest):** Ante cada cambio en la rama principal, un contenedor ejecuta automáticamente la batería de pruebas unitarias solicitando extracción de métricas (`npm run test:coverage`).
2. **Generación de Reporte de Cobertura:** Se emplea la acción especializada `vitest-coverage-report-action`, que lee los resultados JSON de Vitest y genera una tabla visual y detallada directamente en la pestaña **Summary** de GitHub Actions. Esto aporta un sello de garantía QA auditable, permitiendo al tribunal evaluar la calidad del software asíncronamente (Ver capturas adjuntas en la memoria principal).

---

## 3. Estrategia de Pruebas (Testing)

Para garantizar la integridad del Dato Maestro, la plataforma emplea pruebas a distintos niveles.

### 3.1 Unit Testing (Vitest)
Se realizan pruebas unitarias de los módulos lógicos (funciones puras) críticos del negocio. Actualmente hay **24 tests implementados** bajo el framework **Vitest**.
- **`src/lib/csv.test.ts`**: Valida que la exportación masiva sanitice inyecciones de fórmulas (mitigando vulnerabilidades CSV Injection CWE-1236).
- **`src/lib/spain.test.ts`**: Valida las conversiones de códigos postales y provincias españolas, vital para mapas de calor.

**¿Cómo ejecutarlos localmente?**
Abre una terminal en el proyecto y ejecuta:
```bash
cd app
npm run test
# O para ver la tabla de cobertura en consola:
npm run test:coverage
```

### 3.2 Pruebas End-to-End (E2E) con Playwright
En un entorno real, las pruebas de UI se realizan simulando un navegador completo. Recomendamos el uso de **Playwright**.
Un flujo típico E2E comprueba lo siguiente:
1. Playwright levanta Chromium.
2. Navega a `/login`.
3. Introduce el usuario `moure-dev` y clica en Entrar.
4. Verifica que la URL cambia a `/dashboard`.

*Nota para el Tribunal: Dado el enfoque de Arquitectura de Datos del TFM, la cobertura visual (E2E) es secundaria respecto a la integridad del modelo de datos backend (Unit/Integration).*

---

## 4. Observabilidad y Auditoría en Producción

Para garantizar el diagnóstico eficaz en un entorno de nube sin acceso directo a las herramientas locales, se ha ajustado la capa de persistencia (Prisma ORM):
- **Event-Driven SQL Logging:** Activando la variable `DEBUG_SQL=true` en Vercel, se habilita la captura de eventos a bajo nivel del cliente de Prisma (`client.$on('query')`).
- **Visibilidad de Parámetros:** Por diseño contra Inyecciones SQL (SQLi), el ORM parametriza las consultas (Ej: `WHERE cnae_id IN (?)`). Gracias al logger implementado, la consola en vivo de Vercel (Pestaña "Logs") muestra no solo la estructura SQL construida, sino también el array exacto con los argumentos en tiempo real (Ej: `Params: [1, 5, "uuid-sesion"]`), permitiendo depurar problemas de *Row Level Security* sin comprometer la seguridad corporativa.
