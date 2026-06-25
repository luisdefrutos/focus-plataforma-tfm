/**
 * Validación del enlace inspección↔factura para los nuevos extractos:
 * muestrea números de documento de cada fichero y comprueba qué % existe en
 * BILLING_RECORDS.invoice_number y a qué sociedad pertenecen esas facturas.
 *
 * Uso: npx tsx prisma/seeds/lib/analyze-inspections-billing-match.ts
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import { prisma } from './prisma';

const RAW = resolve(__dirname, '../../../../data/raw');
const FILES = ['Inspecciones_AT.xlsx', 'Inspecciones_BT.xlsx', 'Inspecciones_GESAP_TSA.xlsx', 'Inspecciones_GESAP_TSI.xlsx'];
const COL_DOCS = 12;
const DATA_START = 3;
const SAMPLE = 400;

async function main() {
  for (const f of FILES) {
    const wb = XLSX.readFile(resolve(RAW, f), { cellDates: false });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, defval: null }) as (string | number | null)[][];
    const data = rows.slice(DATA_START);

    // Todos los docs (primero por fila, como hace el seed) y muestreo sistemático
    const firstDocs: string[] = [];
    for (const r of data) {
      const v = r?.[COL_DOCS];
      if (v == null) continue;
      const docs = String(v).split(/[;,\s]+/).map(x => x.replace(/\D/g, '')).filter(Boolean);
      if (docs[0]) firstDocs.push(docs[0]);
    }
    const step = Math.max(1, Math.floor(firstDocs.length / SAMPLE));
    const sample = firstDocs.filter((_, i) => i % step === 0).slice(0, SAMPLE);

    const found = await prisma.$queryRawUnsafe<{ invoice_number: string; sap_code: string; cnt: bigint }[]>(
      `SELECT br.invoice_number, le.sap_code, COUNT(*) cnt
         FROM billing_records br
         JOIN business_units bu ON bu.bu_id = br.bu_id
         JOIN legal_entities le ON le.entity_id = bu.entity_id
        WHERE br.invoice_number IN (${sample.map(() => '?').join(',')})
        GROUP BY br.invoice_number, le.sap_code`,
      ...sample
    );
    const matched = new Set(found.map(r => r.invoice_number));
    const byEntity = new Map<string, number>();
    for (const r of found) byEntity.set(r.sap_code, (byEntity.get(r.sap_code) ?? 0) + 1);

    console.log(`\n📄 ${f}`);
    console.log(`   docs muestreados: ${sample.length} (de ${firstDocs.length} filas con doc)`);
    console.log(`   match en BILLING_RECORDS: ${matched.size} (${((matched.size / sample.length) * 100).toFixed(1)}%)`);
    console.log(`   sociedades de las facturas matcheadas: ${[...byEntity].sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s}×${c}`).join('  ')}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
