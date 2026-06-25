/**
 * Backfill: billing_records.sales_order_number desde los ZKSD (columna 9 "Sales order").
 *
 * Activa el match SECUNDARIO  inspection.subject_number ↔ billing.sales_order_number,
 * que complementa al match principal (order_number ↔ invoice_number, ya activo) y sube
 * la cobertura del enlace inspección↔factura de ~90% hacia ~94%.
 *
 * El Sales order llega como "0135/8103906312" → guardamos la parte numérica (8103906312).
 * Cada billing_document (= invoice_number) cuelga de un único sales_order, así que construimos
 * un map billing_doc→sales_order y aplicamos un UPDATE JOIN sobre billing_records.
 *
 * Misma disposición de columnas que 04-billing (header fila 11, datos desde la fila 12).
 *
 * Uso: tsx prisma/seeds/11-billing-salesorder-backfill.ts [años...]   (por defecto 2019-2026)
 */

import { prisma } from './lib/prisma';
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

const DATA_DIR = resolve(__dirname, '../../../data/raw/DATOS_FACTURACION');
const DEFAULT_YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];
const COL = { billingDocument: 3, salesOrder: 9 };
const DATA_START_INDEX = 12;
const INSERT_BATCH = 2000;

/** "0135/8103906312" → "8103906312" (parte numérica tras la sociedad). */
function soClean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  const part = s.includes('/') ? s.split('/').pop()! : s;
  return part.replace(/\D/g, '') || null;
}
function docClean(v: unknown): string | null {
  if (v == null) return null;
  return String(v).replace(/\D/g, '') || null;
}

export async function backfillSalesOrder(years: string[] = DEFAULT_YEARS): Promise<void> {
  console.log('🔗 Backfill sales_order_number — años:', years.join(', '));

  // 1) map billing_doc → sales_order (primero gana)
  const map = new Map<string, string>();
  for (const year of years) {
    const path = resolve(DATA_DIR, `ZKSD_SD14_${year}.xlsx`);
    const wb = XLSX.readFile(path, { cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];
    let n = 0;
    for (let i = DATA_START_INDEX; i < matrix.length; i++) {
      const r = matrix[i];
      if (!r) continue;
      const doc = docClean(r[COL.billingDocument]);
      const so = soClean(r[COL.salesOrder]);
      if (doc && so && !map.has(doc)) { map.set(doc, so); n++; }
    }
    console.log(`   ${year}: +${n} (map total ${map.size})`);
  }

  // 2) staging (billing_doc/sales_order son sólo dígitos → INSERT inline seguro)
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS _so_staging');
  await prisma.$executeRawUnsafe(
    'CREATE TABLE _so_staging (billing_doc VARCHAR(64) NOT NULL PRIMARY KEY, sales_order VARCHAR(32) NOT NULL) COLLATE utf8mb4_unicode_ci'
  );
  // Solo se incrustan valores numéricos (billing_doc/sales_order lo son siempre);
  // los que no lo sean se descartan y se avisan, para no romper el INSERT inline (CWE-89).
  const isNum = (x: unknown) => /^[0-9]+$/.test(String(x));
  const entries = [...map].filter(([d, s]) => isNum(d) && isNum(s));
  const skipped = map.size - entries.length;
  if (skipped > 0) console.warn(`   ⚠ ${skipped} pares no numéricos omitidos del backfill.`);
  for (let i = 0; i < entries.length; i += INSERT_BATCH) {
    const values = entries.slice(i, i + INSERT_BATCH).map(([d, s]) => `('${d}','${s}')`).join(',');
    await prisma.$executeRawUnsafe(`INSERT IGNORE INTO _so_staging (billing_doc, sales_order) VALUES ${values}`);
    if ((i / INSERT_BATCH) % 20 === 0) process.stdout.write(`      staging ${Math.min(i + INSERT_BATCH, entries.length)}/${entries.length}\r`);
  }
  console.log(`      staging poblada: ${entries.length} filas ✓`);

  // 3) UPDATE JOIN
  const affected = await prisma.$executeRawUnsafe(
    'UPDATE billing_records b JOIN _so_staging s ON s.billing_doc = b.invoice_number SET b.sales_order_number = s.sales_order WHERE b.sales_order_number IS NULL'
  );
  console.log(`   ✔ billing_records actualizados: ${affected}`);

  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS _so_staging');
}

if (require.main === module) {
  const years = process.argv.slice(2);
  backfillSalesOrder(years.length ? years : DEFAULT_YEARS)
    .then(() => prisma.$disconnect())
    .catch((err) => { console.error(err); prisma.$disconnect(); process.exit(1); });
}
