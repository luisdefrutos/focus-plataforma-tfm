/**
 * Seed: BILLING_RECORDS + CUSTOMER_MASTER (implícito).
 *
 * Fuentes:
 *   - data/raw/DATOS_FACTURACION/ZKSD_SD14_YYYY.xlsx (un fichero por año)
 *   - data/raw/Profit centers.xls (para mapear profit_center → bu_id)
 *
 * Estrategia:
 *   1. Construir mapping en memoria: profit_center_code → bu_id
 *      (cruzando Profit centers.xls con BUSINESS_UNITS ya cargadas).
 *   2. Construir mapping: material_code → catalog_id (PRODUCT_CATALOG ya cargada).
 *   3. Para cada fichero ZKSD_SD14_YYYY:
 *      a) Saltar la cabecera SAP (filas 0-10), tomar fila 11 como headers, fila 12+ como datos.
 *      b) Acumular sap_customer_codes únicos → bulk insert CUSTOMER_MASTER.
 *      c) Bulk createMany BILLING_RECORDS con skipDuplicates.
 *
 * Identidad: la clave es `Customer` (sap_customer_code) — único por cliente SAP.
 * `Sales Tax ID` se guarda como atributo si es CIF válido; el literal "Not assigned"
 * y los vacíos pasan a NULL (no son identidad).
 *
 * Idempotente: sap_customer_code (UK) y external_guid (UK) protegen contra duplicación.
 *
 * Filas saltadas:
 *   - sin Customer (sap_customer_code) — no hay forma de identificar al cliente
 *   - material_code no en PRODUCT_CATALOG
 *   - profit_center no mapeable a una BU
 *
 * Por defecto carga solo 2024-2026 (los más recientes y relevantes para el MVP).
 * Para cargar más años, pasar como argumento: `tsx 04-billing.ts 2019 2020 2021 2022 2023`.
 */

import { prisma, SEED_AUDIT } from './lib/prisma';
import { parseProfitCenters } from './lib/parse-profit-centers';
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = resolve(__dirname, '../../../data/raw/DATOS_FACTURACION');
const PROFIT_CENTERS = resolve(__dirname, '../../../data/raw/Profit centers.xls');
const DEFAULT_YEARS = ['2024', '2025', '2026'];

// Posición de columnas en el fichero ZKSD_SD14 (fila 11 = header, fila 12+ = datos)
const COL = {
  profitCenter:     1,
  billingDocument:  3,
  invoiceDate:      4,
  billingDate:      5,
  salesTaxId:       6,
  customerCode:     7,
  customerName:     8,
  salesOrder:       9,
  description:     10,
  material:        11,
  invoicedAmount:  13,
} as const;

const HEADER_ROW_INDEX = 11;
const DATA_START_INDEX = 12;
const BATCH_SIZE = 1000;

/** Convierte serial Excel (días desde 1900-01-01) a Date. Devuelve null para 0/null. */
function excelDateToJs(serial: number | string | null): Date | null {
  if (serial == null || serial === '') return null;
  const n = typeof serial === 'string' ? Number(serial) : serial;
  if (!Number.isFinite(n) || n <= 0) return null;
  // Excel cuenta desde 1900-01-01 pero asume erróneamente que 1900 es bisiesto → ajuste -2
  const ms = (n - 25569) * 86400 * 1000;
  return new Date(ms);
}

function cleanStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function buildProfitCenterToBuMap(): Promise<Map<string, number>> {
  const rows = parseProfitCenters(PROFIT_CENTERS);
  const entities = await prisma.legalEntity.findMany();
  const entityIdByCode = new Map(entities.map(e => [e.sapCode, e.entityId]));
  const bus = await prisma.businessUnit.findMany();
  const buIdByEntityCode = new Map(bus.map(bu => [`${bu.entityId}|${bu.buCode}`, bu.buId]));

  const map = new Map<string, number>();
  let unmapped = 0;
  for (const r of rows) {
    const entityId = entityIdByCode.get(r.companyCode);
    if (!entityId) { unmapped++; continue; }
    const buId = buIdByEntityCode.get(`${entityId}|${r.businessLine}`);
    if (!buId) { unmapped++; continue; }
    map.set(r.profitCenterCode, buId);
  }
  console.log(`   PC→BU mapping: ${map.size} profit centers mapeados (${unmapped} sin BU)`);
  return map;
}

type BillingRaw = {
  sapCustomerCode: string;
  taxId: string | null;
  customerName: string | null;
  profitCenterCode: string;
  buId: number;
  materialCode: string;
  catalogId: number;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  billingDate: Date | null;
  amount: number | null;
  salesOrder: string | null;
  description: string | null;
};

/** Devuelve el taxId si es un CIF/NIF real; null para vacío o el literal SAP "Not assigned". */
function normalizeTaxId(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.trim().toLowerCase() === 'not assigned') return null;
  return raw;
}

async function processFile(
  year: string,
  pcToBuId: Map<string, number>,
  materialToCatalogId: Map<string, number>,
): Promise<{ inserted: number; skipped: Record<string, number> }> {
  const path = resolve(DATA_DIR, `ZKSD_SD14_${year}.xlsx`);
  console.log(`\n📂 ${year}: leyendo ${path}…`);
  const wb = XLSX.readFile(path, { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];
  console.log(`   ${matrix.length} filas crudas, datos desde fila ${DATA_START_INDEX}.`);

  // 1) Acumular customers únicos (por sap_customer_code) y billing válidos
  const customersBySapCode = new Map<string, { name: string; taxId: string | null }>();
  const validBillings: BillingRaw[] = [];
  const skipped = { noSapCode: 0, noPc: 0, noMaterial: 0, malformed: 0 };

  for (let i = DATA_START_INDEX; i < matrix.length; i++) {
    const row = matrix[i]!;
    if (row.length < 14) { skipped.malformed++; continue; }

    const sapCustomerCode = cleanStr(row[COL.customerCode]);
    if (!sapCustomerCode) { skipped.noSapCode++; continue; }

    const profitCenterCode = cleanStr(row[COL.profitCenter]);
    const buId = profitCenterCode ? pcToBuId.get(profitCenterCode) : undefined;
    if (!buId) { skipped.noPc++; continue; }

    const materialCode = cleanStr(row[COL.material]);
    const catalogId = materialCode ? materialToCatalogId.get(materialCode) : undefined;
    if (!catalogId) { skipped.noMaterial++; continue; }

    const taxId = normalizeTaxId(cleanStr(row[COL.salesTaxId]));
    const customerName = cleanStr(row[COL.customerName]) ?? sapCustomerCode;
    if (!customersBySapCode.has(sapCustomerCode)) {
      customersBySapCode.set(sapCustomerCode, { name: customerName, taxId });
    }

    const amount = row[COL.invoicedAmount];
    validBillings.push({
      sapCustomerCode,
      taxId,
      customerName,
      profitCenterCode: profitCenterCode!,
      buId,
      materialCode: materialCode!,
      catalogId,
      invoiceNumber: cleanStr(row[COL.billingDocument]),
      invoiceDate: excelDateToJs(row[COL.invoiceDate] as number | null),
      billingDate: excelDateToJs(row[COL.billingDate] as number | null),
      amount: typeof amount === 'number' ? amount : Number(amount) || null,
      salesOrder: cleanStr(row[COL.salesOrder]),
      description: cleanStr(row[COL.description])?.slice(0, 1000) ?? null,
    });
  }
  console.log(`   ${validBillings.length} facturas válidas, ${customersBySapCode.size} clientes únicos.`);
  console.log(`   Skipped → noSapCode:${skipped.noSapCode}, noPC:${skipped.noPc}, noMaterial:${skipped.noMaterial}, malformed:${skipped.malformed}`);

  // 2) Insertar customers nuevos (bulk con createMany skipDuplicates por sap_customer_code UK)
  console.log(`   👤 Insertando ${customersBySapCode.size} customers (skipDuplicates)…`);
  const customerRows = [...customersBySapCode].map(([sapCode, { name, taxId }]) => ({
    externalGuid: randomUUID(),
    sapCustomerCode: sapCode,
    taxId,
    legalName: name,
    ...SEED_AUDIT,
  }));
  await prisma.customerMaster.createMany({ data: customerRows, skipDuplicates: true });
  // Construir lookup sapCustomerCode → customerId
  const allCustomers = await prisma.customerMaster.findMany({
    where: { sapCustomerCode: { in: [...customersBySapCode.keys()] } },
    select: { customerId: true, sapCustomerCode: true },
  });
  const customerIdBySapCode = new Map(
    allCustomers.map(c => [c.sapCustomerCode!, c.customerId])
  );

  // 3) Insertar billing en batches
  console.log(`   💸 Insertando ${validBillings.length} billing records en batches de ${BATCH_SIZE}…`);
  let inserted = 0;
  for (let i = 0; i < validBillings.length; i += BATCH_SIZE) {
    const batch = validBillings.slice(i, i + BATCH_SIZE);
    const records = batch.map(b => ({
      externalGuid: randomUUID(),
      customerId: customerIdBySapCode.get(b.sapCustomerCode)!,
      buId: b.buId,
      catalogId: b.catalogId,
      invoiceNumber: b.invoiceNumber,
      invoiceAmount: b.amount,
      invoiceDate: b.invoiceDate,
      invoiceDescription: b.description,
      currencyCode: 'EUR',
      profitCenterCode: b.profitCenterCode,
      ...SEED_AUDIT,
    }));
    const res = await prisma.billingRecord.createMany({ data: records, skipDuplicates: true });
    inserted += res.count;
    if ((i / BATCH_SIZE) % 10 === 0) process.stdout.write(`      ${inserted}/${validBillings.length}\r`);
  }
  console.log(`      ${inserted}/${validBillings.length} ✓`);

  return { inserted, skipped };
}

export async function seedBilling(years: string[] = DEFAULT_YEARS): Promise<void> {
  console.log(`💰 Seed BILLING_RECORDS — años: ${years.join(', ')}`);
  console.log(`\n🗺  Construyendo mapping profit_center → bu_id…`);
  const pcToBuId = await buildProfitCenterToBuMap();

  console.log(`\n📦 Cargando mapping material_code → catalog_id…`);
  const catalogRows = await prisma.productCatalog.findMany({ select: { catalogId: true, materialCode: true } });
  const materialToCatalogId = new Map(catalogRows.map(c => [c.materialCode, c.catalogId]));
  console.log(`   ${materialToCatalogId.size} materiales en catálogo`);

  let totalInserted = 0;
  for (const year of years) {
    const { inserted } = await processFile(year, pcToBuId, materialToCatalogId);
    totalInserted += inserted;
  }
  console.log(`\n✔ Total billing records insertados: ${totalInserted}`);
}

if (require.main === module) {
  const cliYears = process.argv.slice(2);
  const years = cliYears.length > 0 ? cliYears : DEFAULT_YEARS;
  seedBilling(years)
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}