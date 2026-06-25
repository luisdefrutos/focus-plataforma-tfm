-- ============================================================================
-- Proyecto Focus — Setup inicial de la base de datos MySQL
-- ============================================================================
-- Ejecutar como usuario root (o equivalente con permisos CREATE USER + GRANT).
-- Crea la base de datos focus_dev y un usuario dedicado focus_app con permisos
-- sobre esa base de datos.
--
-- INSTRUCCIONES:
-- 1. Abrir DBeaver, conectar a localhost:3306 como root.
-- 2. ⚠️  CAMBIAR la contraseña 'TU_PASSWORD_AQUI' por una real antes de ejecutar.
-- 3. Ejecutar este script entero.
-- 4. Anotar la contraseña en app/.env (DATABASE_URL).
-- ============================================================================

-- Crear la base de datos con charset utf8mb4 (soporta emojis y caracteres latinos)
CREATE DATABASE IF NOT EXISTS focus_dev
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- Crear usuario dedicado para la aplicación (en lugar de usar root)
-- ⚠️ Sustituir 'TU_PASSWORD_AQUI' por una contraseña fuerte
CREATE USER IF NOT EXISTS 'focus_app'@'localhost'
    IDENTIFIED BY 'TU_PASSWORD_AQUI';

-- Conceder permisos completos sobre focus_dev (necesario para Prisma migrate)
GRANT ALL PRIVILEGES ON focus_dev.* TO 'focus_app'@'localhost';

-- Aplicar cambios
FLUSH PRIVILEGES;

-- Verificación
SELECT User, Host FROM mysql.user WHERE User = 'focus_app';
SHOW GRANTS FOR 'focus_app'@'localhost';
SHOW DATABASES LIKE 'focus_dev';
