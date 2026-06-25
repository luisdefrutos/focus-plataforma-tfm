-- Incompatibilidades legales entre servicios (matriz de conflictos OC, Anexo 4 GG6).
-- Pares material TSA × material TSI con severidad TOTAL (exclusión) / PARCIAL (warning).
-- Relación lógica con PRODUCT_CATALOG por material_code (sin FK, igual que STATUS_CATALOG).

-- CreateTable
CREATE TABLE `SERVICE_INCOMPATIBILITIES` (
    `incompatibility_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `material_code_a` VARCHAR(64) NOT NULL,
    `material_code_b` VARCHAR(64) NOT NULL,
    `severity` ENUM('TOTAL', 'PARCIAL') NOT NULL,
    `source_note` VARCHAR(500) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `SERVICE_INCOMPATIBILITIES_external_guid_key`(`external_guid`),
    INDEX `SERVICE_INCOMPATIBILITIES_material_code_b_idx`(`material_code_b`),
    UNIQUE INDEX `SERVICE_INCOMPATIBILITIES_material_code_a_material_code_b_key`(`material_code_a`, `material_code_b`),
    PRIMARY KEY (`incompatibility_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
