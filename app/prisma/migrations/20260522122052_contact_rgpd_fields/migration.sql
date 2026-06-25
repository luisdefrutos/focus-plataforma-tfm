-- AlterTable
ALTER TABLE `contacts` ADD COLUMN `consent_email` BOOLEAN NULL,
    ADD COLUMN `consent_fax` BOOLEAN NULL,
    ADD COLUMN `consent_letter` BOOLEAN NULL,
    ADD COLUMN `consent_phone` BOOLEAN NULL,
    ADD COLUMN `consent_sms` BOOLEAN NULL,
    ADD COLUMN `first_name` VARCHAR(128) NULL,
    ADD COLUMN `last_name` VARCHAR(128) NULL,
    ADD COLUMN `mobile` VARCHAR(64) NULL,
    ADD COLUMN `phone` VARCHAR(64) NULL,
    ADD COLUMN `title` VARCHAR(16) NULL;
