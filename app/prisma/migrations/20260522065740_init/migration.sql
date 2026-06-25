-- CreateTable
CREATE TABLE `LEGAL_ENTITIES` (
    `entity_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `sap_code` VARCHAR(10) NOT NULL,
    `legal_name` VARCHAR(255) NOT NULL,
    `country_code` VARCHAR(2) NOT NULL DEFAULT 'ES',
    `country_name` VARCHAR(64) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `LEGAL_ENTITIES_external_guid_key`(`external_guid`),
    UNIQUE INDEX `LEGAL_ENTITIES_sap_code_key`(`sap_code`),
    PRIMARY KEY (`entity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DIVISIONS` (
    `division_id` INTEGER NOT NULL AUTO_INCREMENT,
    `division_code` VARCHAR(8) NOT NULL,
    `division_name` VARCHAR(128) NOT NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `DIVISIONS_division_code_key`(`division_code`),
    PRIMARY KEY (`division_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BUSINESS_UNITS` (
    `bu_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `entity_id` INTEGER NOT NULL,
    `division_id` INTEGER NOT NULL,
    `bu_code` VARCHAR(32) NOT NULL,
    `bu_name` VARCHAR(128) NOT NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `BUSINESS_UNITS_external_guid_key`(`external_guid`),
    INDEX `BUSINESS_UNITS_division_id_idx`(`division_id`),
    UNIQUE INDEX `BUSINESS_UNITS_entity_id_bu_code_key`(`entity_id`, `bu_code`),
    PRIMARY KEY (`bu_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CORPORATE_HOLDINGS` (
    `holding_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `holding_name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `CORPORATE_HOLDINGS_external_guid_key`(`external_guid`),
    UNIQUE INDEX `CORPORATE_HOLDINGS_holding_name_key`(`holding_name`),
    PRIMARY KEY (`holding_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PRODUCT_CATALOG` (
    `catalog_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `material_code` VARCHAR(64) NOT NULL,
    `description_en` VARCHAR(500) NOT NULL,
    `description_es` VARCHAR(500) NULL,
    `category` VARCHAR(128) NULL,
    `service_code` VARCHAR(32) NULL,
    `service_name` VARCHAR(255) NULL,
    `product_code` VARCHAR(32) NULL,
    `product_name` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `PRODUCT_CATALOG_external_guid_key`(`external_guid`),
    UNIQUE INDEX `PRODUCT_CATALOG_material_code_key`(`material_code`),
    PRIMARY KEY (`catalog_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CUSTOMER_MASTER` (
    `customer_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `holding_id` INTEGER NULL,
    `tax_id` VARCHAR(64) NOT NULL,
    `legal_name` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `CUSTOMER_MASTER_external_guid_key`(`external_guid`),
    UNIQUE INDEX `CUSTOMER_MASTER_tax_id_key`(`tax_id`),
    INDEX `CUSTOMER_MASTER_legal_name_idx`(`legal_name`),
    PRIMARY KEY (`customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ADDRESSES` (
    `address_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `full_address` VARCHAR(500) NOT NULL,
    `postal_code` VARCHAR(16) NULL,
    `city` VARCHAR(128) NULL,
    `province` VARCHAR(128) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `ADDRESSES_external_guid_key`(`external_guid`),
    INDEX `ADDRESSES_customer_id_idx`(`customer_id`),
    INDEX `ADDRESSES_postal_code_idx`(`postal_code`),
    PRIMARY KEY (`address_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CONTACTS` (
    `contact_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `bu_id` INTEGER NOT NULL,
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `contact_position` VARCHAR(255) NULL,
    `email_validation` VARCHAR(64) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `CONTACTS_external_guid_key`(`external_guid`),
    INDEX `CONTACTS_customer_id_idx`(`customer_id`),
    INDEX `CONTACTS_bu_id_idx`(`bu_id`),
    PRIMARY KEY (`contact_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CNAE_CATALOG` (
    `cnae_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `cnae_code` VARCHAR(10) NOT NULL,
    `cnae_name` VARCHAR(500) NOT NULL,
    `cnae_level` VARCHAR(32) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `CNAE_CATALOG_external_guid_key`(`external_guid`),
    UNIQUE INDEX `CNAE_CATALOG_cnae_code_key`(`cnae_code`),
    PRIMARY KEY (`cnae_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CUSTOMER_CNAE` (
    `customer_cnae_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `cnae_id` INTEGER NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `CUSTOMER_CNAE_external_guid_key`(`external_guid`),
    UNIQUE INDEX `CUSTOMER_CNAE_customer_id_cnae_id_key`(`customer_id`, `cnae_id`),
    PRIMARY KEY (`customer_cnae_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BILLING_RECORDS` (
    `billing_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `bu_id` INTEGER NOT NULL,
    `catalog_id` INTEGER NOT NULL,
    `invoice_number` VARCHAR(64) NULL,
    `invoice_amount` DECIMAL(18, 2) NULL,
    `invoice_date` DATE NULL,
    `invoice_description` VARCHAR(1000) NULL,
    `currency_code` VARCHAR(3) NULL DEFAULT 'EUR',
    `expiry_date` DATE NULL,
    `service_start_date` DATE NULL,
    `service_end_date` DATE NULL,
    `profit_center_code` VARCHAR(32) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `BILLING_RECORDS_external_guid_key`(`external_guid`),
    INDEX `BILLING_RECORDS_customer_id_idx`(`customer_id`),
    INDEX `BILLING_RECORDS_bu_id_idx`(`bu_id`),
    INDEX `BILLING_RECORDS_catalog_id_idx`(`catalog_id`),
    INDEX `BILLING_RECORDS_invoice_date_idx`(`invoice_date`),
    INDEX `BILLING_RECORDS_expiry_date_idx`(`expiry_date`),
    PRIMARY KEY (`billing_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CROSS_SELL_OPPORTUNITIES` (
    `opportunity_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `billing_id` INTEGER NULL,
    `origin_bu_id` INTEGER NOT NULL,
    `target_bu_id` INTEGER NOT NULL,
    `catalog_id` INTEGER NOT NULL,
    `opportunity_reason` VARCHAR(1000) NOT NULL,
    `priority_score` DECIMAL(5, 2) NULL,
    `potential_amount` DECIMAL(18, 2) NULL,
    `status` ENUM('NEW', 'ACCEPTED', 'IN_PROGRESS', 'IN_CAMPAIGN', 'QUALIFIED', 'REJECTED', 'CLOSED_WON', 'CLOSED_LOST') NOT NULL DEFAULT 'NEW',
    `reviewed_by` VARCHAR(128) NULL,
    `reviewed_at` TIMESTAMP(6) NULL,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `source_system` VARCHAR(64) NOT NULL,
    `etl_run_id` BIGINT NOT NULL,

    UNIQUE INDEX `CROSS_SELL_OPPORTUNITIES_external_guid_key`(`external_guid`),
    INDEX `CROSS_SELL_OPPORTUNITIES_customer_id_idx`(`customer_id`),
    INDEX `CROSS_SELL_OPPORTUNITIES_status_idx`(`status`),
    INDEX `CROSS_SELL_OPPORTUNITIES_target_bu_id_idx`(`target_bu_id`),
    PRIMARY KEY (`opportunity_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `STATUS_CATALOG` (
    `status_id` INTEGER NOT NULL AUTO_INCREMENT,
    `entity_name` VARCHAR(32) NOT NULL,
    `status_code` VARCHAR(32) NOT NULL,
    `status_name` VARCHAR(128) NOT NULL,
    `description` VARCHAR(500) NULL,
    `display_order` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `STATUS_CATALOG_entity_name_display_order_idx`(`entity_name`, `display_order`),
    UNIQUE INDEX `STATUS_CATALOG_entity_name_status_code_key`(`entity_name`, `status_code`),
    PRIMARY KEY (`status_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BUSINESS_UNITS` ADD CONSTRAINT `BUSINESS_UNITS_entity_id_fkey` FOREIGN KEY (`entity_id`) REFERENCES `LEGAL_ENTITIES`(`entity_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BUSINESS_UNITS` ADD CONSTRAINT `BUSINESS_UNITS_division_id_fkey` FOREIGN KEY (`division_id`) REFERENCES `DIVISIONS`(`division_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CUSTOMER_MASTER` ADD CONSTRAINT `CUSTOMER_MASTER_holding_id_fkey` FOREIGN KEY (`holding_id`) REFERENCES `CORPORATE_HOLDINGS`(`holding_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ADDRESSES` ADD CONSTRAINT `ADDRESSES_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `CUSTOMER_MASTER`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CONTACTS` ADD CONSTRAINT `CONTACTS_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `CUSTOMER_MASTER`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CONTACTS` ADD CONSTRAINT `CONTACTS_bu_id_fkey` FOREIGN KEY (`bu_id`) REFERENCES `BUSINESS_UNITS`(`bu_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CUSTOMER_CNAE` ADD CONSTRAINT `CUSTOMER_CNAE_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `CUSTOMER_MASTER`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CUSTOMER_CNAE` ADD CONSTRAINT `CUSTOMER_CNAE_cnae_id_fkey` FOREIGN KEY (`cnae_id`) REFERENCES `CNAE_CATALOG`(`cnae_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BILLING_RECORDS` ADD CONSTRAINT `BILLING_RECORDS_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `CUSTOMER_MASTER`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BILLING_RECORDS` ADD CONSTRAINT `BILLING_RECORDS_bu_id_fkey` FOREIGN KEY (`bu_id`) REFERENCES `BUSINESS_UNITS`(`bu_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BILLING_RECORDS` ADD CONSTRAINT `BILLING_RECORDS_catalog_id_fkey` FOREIGN KEY (`catalog_id`) REFERENCES `PRODUCT_CATALOG`(`catalog_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CROSS_SELL_OPPORTUNITIES` ADD CONSTRAINT `CROSS_SELL_OPPORTUNITIES_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `CUSTOMER_MASTER`(`customer_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CROSS_SELL_OPPORTUNITIES` ADD CONSTRAINT `CROSS_SELL_OPPORTUNITIES_billing_id_fkey` FOREIGN KEY (`billing_id`) REFERENCES `BILLING_RECORDS`(`billing_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CROSS_SELL_OPPORTUNITIES` ADD CONSTRAINT `CROSS_SELL_OPPORTUNITIES_origin_bu_id_fkey` FOREIGN KEY (`origin_bu_id`) REFERENCES `BUSINESS_UNITS`(`bu_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CROSS_SELL_OPPORTUNITIES` ADD CONSTRAINT `CROSS_SELL_OPPORTUNITIES_target_bu_id_fkey` FOREIGN KEY (`target_bu_id`) REFERENCES `BUSINESS_UNITS`(`bu_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CROSS_SELL_OPPORTUNITIES` ADD CONSTRAINT `CROSS_SELL_OPPORTUNITIES_catalog_id_fkey` FOREIGN KEY (`catalog_id`) REFERENCES `PRODUCT_CATALOG`(`catalog_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
