-- DropForeignKey
ALTER TABLE `contacts` DROP FOREIGN KEY `CONTACTS_bu_id_fkey`;

-- AlterTable
ALTER TABLE `contacts` ADD COLUMN `entity_id` INTEGER NULL,
    ADD COLUMN `postal_code` VARCHAR(16) NULL,
    MODIFY `bu_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `customer_master` ADD COLUMN `industry_code` VARCHAR(16) NULL,
    ADD COLUMN `phone` VARCHAR(64) NULL,
    ADD COLUMN `sap_customer_code` VARCHAR(32) NULL;

-- CreateIndex
CREATE INDEX `CUSTOMER_MASTER_sap_customer_code_idx` ON `CUSTOMER_MASTER`(`sap_customer_code`);

-- AddForeignKey
ALTER TABLE `CONTACTS` ADD CONSTRAINT `CONTACTS_bu_id_fkey` FOREIGN KEY (`bu_id`) REFERENCES `BUSINESS_UNITS`(`bu_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CONTACTS` ADD CONSTRAINT `CONTACTS_entity_id_fkey` FOREIGN KEY (`entity_id`) REFERENCES `LEGAL_ENTITIES`(`entity_id`) ON DELETE SET NULL ON UPDATE CASCADE;
