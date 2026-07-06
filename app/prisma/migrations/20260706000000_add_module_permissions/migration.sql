-- ==============================================================================
-- Migración: Siembra permisos MODULE_* para control granular de módulos (pantallas).
-- Cada módulo del sidebar tiene su propio permiso. Los roles lo heredan por
-- APP_ROLE_PERMISSIONS. Si un rol no tiene ningún MODULE_* → acceso total (retrocompat.).
-- ==============================================================================

-- 1. Insertar permisos MODULE_* (sin duplicar).
INSERT IGNORE INTO APP_PERMISSIONS (permission_code, description) VALUES
  ('MODULE_DASHBOARD',     'Acceso al Dashboard principal'),
  ('MODULE_CLIENTES',      'Acceso al Buscador 360 de clientes'),
  ('MODULE_OPORTUNIDADES', 'Acceso al módulo de Oportunidades'),
  ('MODULE_TOP_CLIENTES',  'Acceso al ranking Top Clientes'),
  ('MODULE_SEGMENTACION',  'Acceso al módulo de Segmentación'),
  ('MODULE_CATALOGO',      'Acceso al Catálogo de servicios'),
  ('MODULE_AUDITORIA',     'Acceso al log de Auditoría');

-- 2. Para el rol SUPERUSUARIO → no añadir MODULE_* (tiene IAM_MANAGE = acceso total).
-- Para el rol USUARIO → asignar todos los MODULE_* excepto MODULE_AUDITORIA.
-- Ajusta según los roleId reales de tu BD. Busca con:
--   SELECT role_id, role_name FROM APP_ROLES;

-- INSTRUCCIONES MANUALES:
-- Ejecuta primero: SELECT role_id, role_name FROM APP_ROLES;
-- Luego sustituye <ROLE_ID_USUARIO> por el role_id del rol "USUARIO" y ejecuta:
--
-- INSERT IGNORE INTO APP_ROLE_PERMISSIONS (role_id, permission_id)
-- SELECT <ROLE_ID_USUARIO>, permission_id FROM APP_PERMISSIONS
-- WHERE permission_code IN (
--   'MODULE_DASHBOARD','MODULE_CLIENTES','MODULE_OPORTUNIDADES',
--   'MODULE_TOP_CLIENTES','MODULE_SEGMENTACION','MODULE_CATALOGO'
-- );

-- ==============================================================================
-- ALTERNATIVA: Si quieres que ambos roles vean todo (comportamiento actual),
-- deja APP_ROLE_PERMISSIONS sin MODULE_* → la lógica en auth.ts ya contempla
-- que "sin MODULE_* = acceso total". Solo necesitas este INSERT para que la
-- columna exista en BD y la UI de Administración pueda editar módulos.
-- ==============================================================================
