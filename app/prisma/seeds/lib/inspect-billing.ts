/**
 * Inspecciona la cabecera real del fichero ZKSD_SD14_YYYY.xlsx (SAP).
 * Las primeras filas son metadatos del informe, los headers están más abajo.
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

const path = resolve(__dirname, '../../../../data/raw/DATOS_FACTURACION/ZKSD_SD14_2024.xlsx');
const wb = XLSX.readFile(path);
const sheet = wb.Sheets[wb.SheetNames[0]!]!;

// Lee como matriz cruda
const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];
console.log(`Total filas crudas: ${matrix.length}\n`);

// Primeras 20 filas: buscar manualmente dónde está la cabecera real
console.log('Primeras 20 filas (índice : primeras 6 celdas):');
matrix.slice(0, 20).forEach((row, i) => {
  const sample = row.slice(0, 6).map(v => v == null ? '∅' : String(v).slice(0, 30)).join(' | ');
  console.log(`  ${String(i).padStart(2)}: ${sample}`);
});

// Heurística: la fila de cabecera será la primera con muchas celdas no nulas
console.log('\nFilas con >5 celdas no nulas (candidatas a header):');
matrix.forEach((row, i) => {
  if (i > 30) return;
  const nonNull = row.filter(v => v != null).length;
  if (nonNull > 5) console.log(`  fila ${i}: ${nonNull} celdas, primeras 14: ${row.slice(0, 14).map(v => v == null ? '∅' : String(v).slice(0, 20)).join(' | ')}`);
});