-- Diagnóstico: verifica estado de focus_app y focus_dev en una sola consulta.
-- Ejecutar conectado como root en DBeaver. Devuelve una fila con 4 columnas.

SELECT
  (SELECT GROUP_CONCAT(CONCAT(User, '@', Host) SEPARATOR ', ')
     FROM mysql.user WHERE User = 'focus_app')                       AS users_found,
  (SELECT COUNT(*) FROM information_schema.schemata
     WHERE schema_name = 'focus_dev')                                  AS db_exists,
  (SELECT GROUP_CONCAT(PRIVILEGE_TYPE SEPARATOR ', ')
     FROM information_schema.schema_privileges
     WHERE GRANTEE = "'focus_app'@'localhost'"
       AND TABLE_SCHEMA = 'focus_dev')                                 AS grants_on_focus_dev,
  (SELECT plugin FROM mysql.user
     WHERE User = 'focus_app' AND Host = 'localhost')                  AS auth_plugin;