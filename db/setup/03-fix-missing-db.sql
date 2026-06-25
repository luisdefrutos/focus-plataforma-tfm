-- Fix: crea la BD focus_dev (que no se creó) y le da permisos al usuario focus_app.
-- Ejecutar conectado como root en DBeaver.

CREATE DATABASE focus_dev
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON focus_dev.* TO 'focus_app'@'localhost';

FLUSH PRIVILEGES;

-- Verificación: ambas líneas deben devolver 1
SELECT COUNT(*) AS db_exists FROM information_schema.schemata WHERE schema_name = 'focus_dev';
SHOW GRANTS FOR 'focus_app'@'localhost';