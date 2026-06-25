/**
 * Backfill de BILLING_RECORDS.invoice_description desde los Excel originales.
 *
 * Contexto: el seed 04-billing.ts no cargaba la columna 10 del fichero ZKSD_SD14
 * (texto libre que describe cada factura, p.ej. "ACCESO A LA PLATAFORMA NUMOS PARA …").
 * La columna invoice_description ya existe en el schema pero estaba toda en NULL.
 *
 * Estrategia (NO destructiva — no toca billing_id, FKs ni oportunidades):
 *   1. Releer los 8 ficheros ZKSD_SD14_YYYY y deduplicar por la clave compuesta
 *      (invoice_number, profit_center_code, catalog_id, invoice_amount, invoice_date),
 *      que el análisis mostró casi única (988 colisiones / 1,17M = 0,08%).
 *   2. Cargar esa clave + descripción en una tabla staging temporal.
 *   3. UPDATE ... JOIN para rellenar invoice_description en las filas existentes.
 *   4. Reportar cobertura y limpiar la tabla staging.
 *
 * Idempotente: se puede re-ejecutar; recrea la staging y vuelve a aplicar el UPDATE.
 */
import 'dotenv/config';
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import mariadb from 'mariadb';

const DATA_DIR = resolve(__dirname, '../../../../data/raw/DATOS_FACTURACION');
const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

// Misma posición de columnas que 04-billing.ts (+ la descripción en la 10)
const COL = {
  profitCenter: 1,
  billingDocument: 3,
  invoiceDate: 4,
  material: 11,
  description: 10,
  invoicedAmount: 13,
} as const;
const DATA_START_INDEX = 12;
const STAGING = '_billing_desc_staging';
const DESC_MAXLEN = 1000; // VARCHAR(1000) en el schema

function cleanStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** Igual que excelDateToJs del seed, pero devuelve 'YYYY-MM-DD' (UTC) para casar con @db.Date. */
function excelDateToStr(serial: number | string | null): string | null {
  if (serial == null || serial === '') return null;
  const n = typeof serial === 'string' ? Number(serial) : serial;
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

function toAmount(v: unknown): number | null {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  const n = Number(v);
  return Number.isFinite(n) && v !== '' && v != null ? Math.round(n * 100) / 100 : null;
}

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const pool = mariadb.createPool({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 4,
    allowPublicKeyRetrieval: true,
  });
  const conn = await pool.getConnection();

  try {
    // 1) mapping material_code -> catalog_id (PRODUCT_CATALOG)
    const cat = await conn.query('SELECT catalog_id, material_code FROM PRODUCT_CATALOG');
    const materialToCatalog = new Map<string, number>();
    for (const r of cat) materialToCatalog.set(String(r.material_code), Number(r.catalog_id));
    console.log(`📦 ${materialToCatalog.size} materiales en catálogo`);

    // 2) leer Excels y deduplicar por clave compuesta
    // clave -> [invoiceNumber, profitCenterCode, catalogId, amount, dateStr, description]
    type Row = [string | null, string | null, number, number | null, string | null, string];
    const byKey = new Map<string, Row>();
    let totalValid = 0;
    let noCatalog = 0;
    let collisions = 0;

    for (const year of YEARS) {
      const path = resolve(DATA_DIR, `ZKSD_SD14_${year}.xlsx`);
      const wb = XLSX.readFile(path, { cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]!]!;
      const m = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];
      let yearValid = 0;
      for (let i = DATA_START_INDEX; i < m.length; i++) {
        const row = m[i]!;
        if (row.length < 14) continue;

        const materialCode = cleanStr(row[COL.material]);
        const catalogId = materialCode ? materialToCatalog.get(materialCode) : undefined;
        if (!catalogId) { noCatalog++; continue; } // no estará en BD

        let description = cleanStr(row[COL.description]);
        if (!description) continue; // nada que backfillear
        if (description.length > DESC_MAXLEN) description = description.slice(0, DESC_MAXLEN);

        const invoiceNumber = cleanStr(row[COL.billingDocument]);
        const profitCenterCode = cleanStr(row[COL.profitCenter]);
        const amount = toAmount(row[COL.invoicedAmount]);
        const dateStr = excelDateToStr(row[COL.invoiceDate] as number | null);

        const key = `${invoiceNumber ?? ''}${profitCenterCode ?? ''}${catalogId}${amount ?? ''}${dateStr ?? ''}`;
        if (byKey.has(key)) {
          if (byKey.get(key)![5] !== description) collisions++;
          continue; // nos quedamos con la primera descripción vista
        }
        byKey.set(key, [invoiceNumber, profitCenterCode, catalogId, amount, dateStr, description]);
        yearValid++;
        totalValid++;
      }
      console.log(`  ${year}: ${yearValid} claves nuevas (acum ${byKey.size})`);
    }
    console.log(`\n🔑 ${byKey.size} claves únicas | ${noCatalog} filas sin material en catálogo (ignoradas) | ${collisions} colisiones de descripción (se quedó la 1ª)`);

    // 3) staging table — SIN índice al crear (se añade tras insertar, es más rápido)
    console.log(`\n🧱 Recreando staging ${STAGING}…`);
    await conn.query(`DROP TABLE IF EXISTS ${STAGING}`);
    await conn.query(`
      CREATE TABLE ${STAGING} (
        invoice_number    VARCHAR(64)  NULL,
        profit_center_code VARCHAR(32) NULL,
        catalog_id        INT          NOT NULL,
        invoice_amount    DECIMAL(18,2) NULL,
        invoice_date      DATE         NULL,
        invoice_description VARCHAR(1000) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Inserción rápida: una sola transacción + INSERT multi-fila (evita fsync por lote).
    const rows = [...byKey.values()];
    const CHUNK = 1000; // 1000 filas × 6 cols = 6000 placeholders por statement
    const cols = '(invoice_number, profit_center_code, catalog_id, invoice_amount, invoice_date, invoice_description)';
    console.log(`📥 Insertando ${rows.length} filas en staging (multi-row de ${CHUNK}, 1 transacción)…`);
    const t0 = Date.now();
    await conn.beginTransaction();
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const placeholders = slice.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const params: unknown[] = [];
      for (const r of slice) params.push(r[0], r[1], r[2], r[3], r[4], r[5]);
      await conn.query(`INSERT INTO ${STAGING} ${cols} VALUES ${placeholders}`, params);
      if ((i / CHUNK) % 50 === 0) process.stdout.write(`   ${Math.min(i + CHUNK, rows.length)}/${rows.length}\r`);
    }
    await conn.commit();
    console.log(`   ${rows.length}/${rows.length} ✓ en ${((Date.now() - t0) / 1000).toFixed(1)}s        `);

    console.log(`🔧 Creando índice de match…`);
    await conn.query(`ALTER TABLE ${STAGING} ADD KEY k_match (invoice_number, profit_center_code, catalog_id)`);

    // 4) UPDATE ... JOIN (null-safe en columnas nullable)
    console.log(`\n🔄 Aplicando UPDATE JOIN sobre BILLING_RECORDS…`);
    const before = await conn.query(`SELECT COUNT(*) AS n FROM BILLING_RECORDS WHERE invoice_description IS NOT NULL`);
    const res = await conn.query(`
      UPDATE BILLING_RECORDS b
      JOIN ${STAGING} s
        ON  b.invoice_number    <=> s.invoice_number
        AND b.profit_center_code <=> s.profit_center_code
        AND b.catalog_id          =  s.catalog_id
        AND b.invoice_amount     <=> s.invoice_amount
        AND b.invoice_date       <=> s.invoice_date
      SET b.invoice_description = s.invoice_description
    `);
    const total = await conn.query(`SELECT COUNT(*) AS n FROM BILLING_RECORDS`);
    const after = await conn.query(`SELECT COUNT(*) AS n FROM BILLING_RECORDS WHERE invoice_description IS NOT NULL`);
    const totN = Number(total[0].n), afterN = Number(after[0].n);
    console.log(`   Filas afectadas (matched): ${Number(res.affectedRows)}`);
    console.log(`   Con descripción: ${Number(before[0].n)} → ${afterN} / ${totN} (${(afterN / totN * 100).toFixed(2)}%)`);
    console.log(`   Sin descripción restantes: ${totN - afterN}`);

    // 5) limpiar
    await conn.query(`DROP TABLE IF EXISTS ${STAGING}`);
    console.log(`\n✔ Backfill completado. Staging eliminada.`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
