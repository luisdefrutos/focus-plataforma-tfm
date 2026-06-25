/**
 * Inspección one-off de los nuevos extractos de inspecciones (AT, BT, GESAP_TSA, GESAP_TSI).
 * Imprime, por fichero y hoja: dimensiones y una tabla columna a columna con las
 * primeras filas (cabeceras jerárquicas) + una fila de datos de muestra.
 *
 * Uso: npx tsx prisma/seeds/lib/inspect-inspections-new.ts [fichero...]
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

const RAW = resolve(__dirname, '../../../../data/raw');
const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['Inspecciones_AT.xlsx', 'Inspecciones_BT.xlsx', 'Inspecciones_GESAP_TSA.xlsx', 'Inspecciones_GESAP_TSI.xlsx'];

const fmt = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v);
  return s.length > 38 ? s.slice(0, 35) + '…' : s;
};

for (const f of FILES) {
  const path = resolve(RAW, f);
  console.log(`\n${'═'.repeat(100)}\n📄 ${f}`);
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.readFile(path, { dense: true });
  } catch (e) {
    console.log(`   ✖ No se pudo leer: ${(e as Error).message}`);
    continue;
  }
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]!;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const nRows = rows.length;
    const nCols = Math.max(...rows.slice(0, 10).map(r => r.length), 0);
    console.log(`\n   Hoja "${sheetName}" — ${nRows} filas × ~${nCols} columnas (rango ${ws['!ref'] ?? '?'})`);

    // Detectar la primera fila con datos "reales": heurística = primera fila tras las 5 primeras
    // cuyo nº de celdas no nulas supere la mitad de las columnas. Imprimimos filas 0..5 igualmente.
    const headRows = rows.slice(0, 5);
    const sampleIdx = Math.min(5, nRows - 1);
    const sample = rows[sampleIdx] ?? [];

    console.log(`   ${'idx'.padEnd(4)} ${'fila0'.padEnd(30)} ${'fila1'.padEnd(30)} ${'fila2'.padEnd(34)} ${'fila3'.padEnd(30)} muestra(fila${sampleIdx})`);
    for (let c = 0; c < nCols; c++) {
      const cells = headRows.map(r => fmt(r?.[c]));
      console.log(
        `   ${String(c).padEnd(4)} ${cells[0]!.slice(0, 29).padEnd(30)} ${cells[1]!.slice(0, 29).padEnd(30)} ${cells[2]!.slice(0, 33).padEnd(34)} ${cells[3]!.slice(0, 29).padEnd(30)} ${fmt(sample[c])}`
      );
    }
    // Conteo de filas no vacías a partir de la fila 3 (asumiendo formato AS) para hacerse una idea
    const dataRows = rows.slice(3).filter(r => r.some(v => v != null && v !== '')).length;
    console.log(`   → filas con algún dato a partir de fila 3: ${dataRows}`);
  }
}
