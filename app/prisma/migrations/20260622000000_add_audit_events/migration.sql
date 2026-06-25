-- Registro de auditoría append-only: un evento por acción relevante de usuario
-- (inicios/cierres de sesión, intentos fallidos, exportaciones CSV y administración de
-- accesos). Solo lo consultan administradores (IAM_MANAGE). Estilo de tablas IAM: sin
-- tripleta ETL (source_system/etl_run_id), porque es dato generado por la app.

-- CreateTable
CREATE TABLE `AUDIT_EVENTS` (
    `audit_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `user_id` INTEGER NULL,
    `username` VARCHAR(128) NOT NULL,
    `user_full_name` VARCHAR(255) NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `category` VARCHAR(32) NOT NULL,
    `outcome` VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
    `description` VARCHAR(500) NOT NULL,
    `target_type` VARCHAR(32) NULL,
    `target_id` VARCHAR(64) NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` VARCHAR(512) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `AUDIT_EVENTS_external_guid_key`(`external_guid`),
    INDEX `AUDIT_EVENTS_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `AUDIT_EVENTS_created_at_idx`(`created_at`),
    INDEX `AUDIT_EVENTS_event_type_idx`(`event_type`),
    INDEX `AUDIT_EVENTS_category_idx`(`category`),
    INDEX `AUDIT_EVENTS_outcome_idx`(`outcome`),
    PRIMARY KEY (`audit_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AUDIT_EVENTS` ADD CONSTRAINT `AUDIT_EVENTS_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `APP_USERS`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
