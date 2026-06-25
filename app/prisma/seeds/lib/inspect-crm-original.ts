/**
 * Inspecciona los ficheros CRM originales (clientesTotales0XXX.xlsx) para
 * descubrir columnas que NO se trasladaron al CONTACTOS_CRM.xlsx consolidado.
 *
 * Buscamos en particular: razón social del cliente, tax_id, partner codes alternativos.
 */
import * as XLSX from 'xlsx';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '../../../../data/raw/CONTACTOS CRM');
const files = readdirSync(dir)
  .filter(f => f.toLowerCase().startsWith('clientestotales') && f.toLowerCase().endsWith('.xlsx'))
  .sort();

console.log(`Ficheros encontrados: ${files.length}`);
for (const f of files) {
  const path = resolve(dir, f);
  const size = statSync(path).size;
  console.log(`\n══════ ${f} (${(size / 1024 / 1024).toFixed(1)} MB) ══════`);

  const wb = XLSX.readFile(path);
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]!;
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`  Hoja "${sheetName}": ${rows.length} filas`);
    if (rows.length === 0) continue;

    const cols = Object.keys(rows[0]!);
    console.log(`  Columnas (${cols.length}):`);
    cols.forEach(c => console.log(`    - ${c}`));

    // Muestra primeras 2 filas completas
    console.log(`\n  Muestra fila 1:`);
    for (const k of cols) console.log(`    ${k.padEnd(45)} = ${JSON.stringify(rows[0]![k])}`);

    // Cuántas filas tienen valor en cada columna (detectar columnas casi vacías)
    console.log(`\n  Densidad de columnas (% no-null):`);
    const counts = new Map<string, number>();
    for (const r of rows) for (const k of cols) if (r[k] != null && r[k] !== '') counts.set(k, (counts.get(k) ?? 0) + 1);
    for (const c of cols) {
      const pct = ((counts.get(c) ?? 0) * 100 / rows.length).toFixed(1);
      console.log(`    ${c.padEnd(45)} ${pct}%`);
    }
  }
}