-- Catch-up del esquema aplicado a la BD local con `prisma db push` y nunca migrado:
--   1. Módulo de Activos Inspeccionables (ORGANIZATIONS, ASSET_TYPES, ASSETS,
--      INSPECTIONS, ORGANIZATION_CONTACTS) + FK CUSTOMER_MASTER.org_id → ORGANIZATIONS.
--   2. BILLING_RECORDS.sales_order_number + índices de invoice_number y sales_order_number.
--
-- En la máquina donde ya existían estos objetos se registró como aplicada con
-- `prisma migrate resolve --applied`; en un despliegue limpio los crea. Verificada
-- aplicando las 7 migraciones sobre una BD vacía (diff final contra el schema = 0).

-- CreateTable
CREATE TABLE `ORGANIZATIONS` (
    `org_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `tax_id` VARCHAR(64) NOT NULL,
    `legal_name` VARCHAR(255) NOT NULL,
    `org_type` VARCHAR(32) NULL,
    `country_code` VARCHAR(2) NOT NULL DEFAULT 'ES',
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `ORGANIZATIONS_external_guid_key`(`external_guid`),
    UNIQUE INDEX `ORGANIZATIONS_tax_id_key`(`tax_id`),
    INDEX `ORGANIZATIONS_legal_name_idx`(`legal_name`),
    PRIMARY KEY (`org_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ASSET_TYPES` (
    `asset_type_id` INTEGER NOT NULL AUTO_INCREMENT,
    `type_code` VARCHAR(32) NOT NULL,
    `type_name` VARCHAR(128) NOT NULL,
    `reg_code_kind` VARCHAR(32) NULL,
    `is_regulated` BOOLEAN NOT NULL DEFAULT true,
    `default_periodicity_months` INTEGER NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `ASSET_TYPES_type_code_key`(`type_code`),
    PRIMARY KEY (`asset_type_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ASSETS` (
    `asset_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `asset_type_id` INTEGER NOT NULL,
    `reg_code` VARCHAR(64) NULL,
    `reg_code_kind` VARCHAR(32) NULL,
    `asset_name` VARCHAR(255) NULL,
    `full_address` VARCHAR(500) NULL,
    `postal_code` VARCHAR(16) NULL,
    `city` VARCHAR(128) NULL,
    `province` VARCHAR(128) NULL,
    `owner_org_id` INTEGER NULL,
    `owner_tax_id` VARCHAR(64) NULL,
    `owner_sap_code` VARCHAR(32) NULL,
    `owner_name` VARCHAR(255) NULL,
    `attributes` JSON NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `ASSETS_external_guid_key`(`external_guid`),
    INDEX `ASSETS_asset_type_id_idx`(`asset_type_id`),
    INDEX `ASSETS_reg_code_idx`(`reg_code`),
    INDEX `ASSETS_owner_org_id_idx`(`owner_org_id`),
    INDEX `ASSETS_province_idx`(`province`),
    UNIQUE INDEX `ASSETS_reg_code_kind_reg_code_province_key`(`reg_code_kind`, `reg_code`, `province`),
    PRIMARY KEY (`asset_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `INSPECTIONS` (
    `inspection_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `asset_id` INTEGER NULL,
    `cod_industria` VARCHAR(64) NOT NULL,
    `inspection_type` VARCHAR(32) NULL,
    `inspection_date` DATE NULL,
    `next_due_date` DATE NULL,
    `periodicity_months` INTEGER NULL,
    `result` VARCHAR(32) NULL,
    `maintainer_org_id` INTEGER NULL,
    `maintainer_tax_id` VARCHAR(64) NULL,
    `maintainer_sap_code` VARCHAR(32) NULL,
    `maintainer_name` VARCHAR(255) NULL,
    `offer_number` VARCHAR(32) NULL,
    `subject_number` VARCHAR(32) NULL,
    `order_number` VARCHAR(32) NULL,
    `legal_entity_id` INTEGER NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `INSPECTIONS_external_guid_key`(`external_guid`),
    UNIQUE INDEX `INSPECTIONS_cod_industria_key`(`cod_industria`),
    INDEX `INSPECTIONS_asset_id_idx`(`asset_id`),
    INDEX `INSPECTIONS_next_due_date_idx`(`next_due_date`),
    INDEX `INSPECTIONS_maintainer_org_id_idx`(`maintainer_org_id`),
    INDEX `INSPECTIONS_order_number_idx`(`order_number`),
    INDEX `INSPECTIONS_subject_number_idx`(`subject_number`),
    INDEX `INSPECTIONS_offer_number_idx`(`offer_number`),
    INDEX `INSPECTIONS_legal_entity_id_idx`(`legal_entity_id`),
    PRIMARY KEY (`inspection_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ORGANIZATION_CONTACTS` (
    `org_contact_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `org_id` INTEGER NOT NULL,
    `role` VARCHAR(16) NULL,
    `full_name` VARCHAR(255) NULL,
    `first_name` VARCHAR(128) NULL,
    `last_name` VARCHAR(128) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(64) NULL,
    `mobile` VARCHAR(64) NULL,
    `fax` VARCHAR(64) NULL,
    `email_validation` VARCHAR(32) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `ORGANIZATION_CONTACTS_external_guid_key`(`external_guid`),
    INDEX `ORGANIZATION_CONTACTS_org_id_idx`(`org_id`),
    INDEX `ORGANIZATION_CONTACTS_email_idx`(`email`),
    UNIQUE INDEX `ORGANIZATION_CONTACTS_org_id_email_key`(`org_id`, `email`),
    PRIMARY KEY (`org_contact_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: FK del Golden Record real (CUSTOMER_MASTER.org_id → ORGANIZATIONS)
ALTER TABLE `CUSTOMER_MASTER` ADD COLUMN `org_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `CUSTOMER_MASTER_org_id_idx` ON `CUSTOMER_MASTER`(`org_id`);

-- AddForeignKey
ALTER TABLE `CUSTOMER_MASTER` ADD CONSTRAINT `CUSTOMER_MASTER_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `ORGANIZATIONS`(`org_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ASSETS` ADD CONSTRAINT `ASSETS_asset_type_id_fkey` FOREIGN KEY (`asset_type_id`) REFERENCES `ASSET_TYPES`(`asset_type_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ASSETS` ADD CONSTRAINT `ASSETS_owner_org_id_fkey` FOREIGN KEY (`owner_org_id`) REFERENCES `ORGANIZATIONS`(`org_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `INSPECTIONS` ADD CONSTRAINT `INSPECTIONS_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `ASSETS`(`asset_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `INSPECTIONS` ADD CONSTRAINT `INSPECTIONS_maintainer_org_id_fkey` FOREIGN KEY (`maintainer_org_id`) REFERENCES `ORGANIZATIONS`(`org_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `INSPECTIONS` ADD CONSTRAINT `INSPECTIONS_legal_entity_id_fkey` FOREIGN KEY (`legal_entity_id`) REFERENCES `LEGAL_ENTITIES`(`entity_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ORGANIZATION_CONTACTS` ADD CONSTRAINT `ORGANIZATION_CONTACTS_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `ORGANIZATIONS`(`org_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: backfill de nº de pedido de venta en facturación (seed 11-billing-salesorder-backfill)
ALTER TABLE `BILLING_RECORDS` ADD COLUMN `sales_order_number` VARCHAR(32) NULL;

-- CreateIndex
CREATE INDEX `BILLING_RECORDS_invoice_number_idx` ON `BILLING_RECORDS`(`invoice_number`);

-- CreateIndex
CREATE INDEX `BILLING_RECORDS_sales_order_number_idx` ON `BILLING_RECORDS`(`sales_order_number`);
