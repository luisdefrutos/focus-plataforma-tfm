-- CreateTable
CREATE TABLE `APP_USERS` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `external_guid` VARCHAR(36) NOT NULL,
    `username` VARCHAR(128) NOT NULL,
    `user_type` VARCHAR(16) NOT NULL DEFAULT 'LOCAL',
    `full_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `APP_USERS_external_guid_key`(`external_guid`),
    UNIQUE INDEX `APP_USERS_username_key`(`username`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `APP_ROLES` (
    `role_id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_name` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `APP_ROLES_role_name_key`(`role_name`),
    PRIMARY KEY (`role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `APP_PERMISSIONS` (
    `permission_id` INTEGER NOT NULL AUTO_INCREMENT,
    `permission_code` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NULL,

    UNIQUE INDEX `APP_PERMISSIONS_permission_code_key`(`permission_code`),
    PRIMARY KEY (`permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `APP_USER_ROLES` (
    `user_id` INTEGER NOT NULL,
    `role_id` INTEGER NOT NULL,
    `bu_id` INTEGER NOT NULL,

    PRIMARY KEY (`user_id`, `role_id`, `bu_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `APP_ROLE_PERMISSIONS` (
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `idx_br_cust_agg` ON `BILLING_RECORDS`(`customer_id`, `bu_id`, `invoice_date`, `invoice_amount`);

-- CreateIndex
CREATE INDEX `idx_br_bu_agg` ON `BILLING_RECORDS`(`bu_id`, `customer_id`, `invoice_date`, `invoice_amount`);

-- AddForeignKey
ALTER TABLE `APP_USER_ROLES` ADD CONSTRAINT `APP_USER_ROLES_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `APP_USERS`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `APP_USER_ROLES` ADD CONSTRAINT `APP_USER_ROLES_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `APP_ROLES`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `APP_USER_ROLES` ADD CONSTRAINT `APP_USER_ROLES_bu_id_fkey` FOREIGN KEY (`bu_id`) REFERENCES `BUSINESS_UNITS`(`bu_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `APP_ROLE_PERMISSIONS` ADD CONSTRAINT `APP_ROLE_PERMISSIONS_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `APP_ROLES`(`role_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `APP_ROLE_PERMISSIONS` ADD CONSTRAINT `APP_ROLE_PERMISSIONS_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `APP_PERMISSIONS`(`permission_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
