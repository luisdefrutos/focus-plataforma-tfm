-- Limpieza de índices redundantes/muertos en BILLING_RECORDS (optimización de carga).
-- Verificado con EXPLAIN: las agregaciones del Buscador 360 usan idx_br_cust_agg /
-- idx_br_bu_agg ("Using index"), nunca estos tres:
--   · customer_id / bu_id  → prefijo izquierdo de los índices de cobertura (que además
--                            cubren las FKs, por lo que el DROP es seguro).
--   · expiry_date          → columna 100% NULL (935.218/935.218) → índice muerto.

-- DropIndex
DROP INDEX `BILLING_RECORDS_customer_id_idx` ON `BILLING_RECORDS`;

-- DropIndex
DROP INDEX `BILLING_RECORDS_bu_id_idx` ON `BILLING_RECORDS`;

-- DropIndex
DROP INDEX `BILLING_RECORDS_expiry_date_idx` ON `BILLING_RECORDS`;
