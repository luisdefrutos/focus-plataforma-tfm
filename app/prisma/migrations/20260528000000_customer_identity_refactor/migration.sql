-- DropIndex
DROP INDEX `CUSTOMER_MASTER_sap_customer_code_idx` ON `CUSTOMER_MASTER`;

-- DropIndex
DROP INDEX `CUSTOMER_MASTER_tax_id_key` ON `CUSTOMER_MASTER`;

-- AlterTable
ALTER TABLE `CUSTOMER_MASTER` ADD COLUMN `block_reason` VARCHAR(500) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'BLOCKED_DUP', 'BLOCKED_UNPAID', 'BLOCKED_OTHER') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `superseded_by_sap_code` VARCHAR(32) NULL,
    MODIFY `tax_id` VARCHAR(64) NULL;

-- CreateIndex
CREATE INDEX `CONTACTS_email_idx` ON `CONTACTS`(`email`);

-- CreateIndex
CREATE UNIQUE INDEX `CONTACTS_customer_id_email_key` ON `CONTACTS`(`customer_id`, `email`);

-- CreateIndex
CREATE UNIQUE INDEX `CUSTOMER_MASTER_sap_customer_code_key` ON `CUSTOMER_MASTER`(`sap_customer_code`);

-- CreateIndex
CREATE INDEX `CUSTOMER_MASTER_tax_id_idx` ON `CUSTOMER_MASTER`(`tax_id`);

-- CreateIndex
CREATE INDEX `CUSTOMER_MASTER_status_idx` ON `CUSTOMER_MASTER`(`status`);
