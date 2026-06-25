-- Corrige el drift del módulo IAM: el modelo `AppUser` declara el campo
-- `allowedFilters Json? @map("allowed_filters")`, pero la migración
-- 20260604094913_iam_module no creó la columna. Sin ella, `seed:iam` (y el
-- login, que lee user.allowedFilters) fallan con P2022 en una BD desde cero.
--
-- AlterTable
ALTER TABLE `APP_USERS` ADD COLUMN `allowed_filters` JSON NULL;
