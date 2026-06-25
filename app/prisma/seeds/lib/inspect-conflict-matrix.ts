/**
 * Inspección one-off de la matriz de conflictos (incompatibilidades legales entre servicios).
 * Fichero: data/raw/Matriz de conflictos TSA-TSI OC.xlsx
 *
 * Uso: npx tsx prisma/seeds/lib/inspect-conflict-matrix.ts
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

const FILE = resolve(__dirname, '../../../../data/raw/Matriz de conflictos TSA-TSI OC.xlsx');

const fmt = (v: unknown): string => {
  if (v == null) return '·';
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s.length > 28 ? s.slice(0, 25) + '…' : s;
};

const wb = XLSX.readFile(FILE, { dense: true });
console.log(`Hojas: ${wb.SheetNames.join(' | ')}`);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]!;
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const nCols = Math.max(...rows.map(r => r.length), 0);
  console.log(`\n${'═'.repeat(110)}\nHoja "${name}" — ${rows.length} filas × ${nCols} columnas (rango ${ws['!ref'] ?? '?'})`);
  // Merges dan pistas de la estructura de cabecera
  const merges = (ws['!merges'] ?? []).slice(0, 15);
  if (merges.length) console.log(`Merges (primeros 15): ${merges.map(m => XLSX.utils.encode_range(m)).join(', ')}`);

  const maxRows = Math.min(rows.length, 40);
  const maxCols = Math.min(nCols, 14);
  for (let i = 0; i < maxRows; i++) {
    const cells = [];
    for (let c = 0; c < maxCols; c++) cells.push(fmt(rows[i]?.[c]).padEnd(28));
    console.log(`${String(i).padStart(3)} | ${cells.join('')}`);
  }
  if (rows.length > maxRows) console.log(`… (${rows.length - maxRows} filas más)`);
  if (nCols > maxCols) console.log(`… (${nCols - maxCols} columnas más)`);
}
