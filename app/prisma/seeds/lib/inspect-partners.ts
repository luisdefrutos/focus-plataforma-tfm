/**
 * Inspecciona las columnas Partner Function / Customer no de CUSTOMER_LIST
 * para construir un mapping role → main_customer y mejorar el matching con CRM.
 */
import * as XLSX from 'xlsx';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(__dirname, '../../../../data/raw/CUSTOMER_LIST');
const files = readdirSync(dir).filter(f => f.toUpperCase().endsWith('.XLSX')).sort();

// Inspeccionar 0380 (más pequeño) y 0135_1 (grande)
const target = ['0380.XLSX', '0135_1.XLSX'];
for (const f of target) {
  if (!files.includes(f)) continue;
  const path = resolve(dir, f);
  console.log(`\n══════ ${f} ══════`);
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];
  const headers = matrix[0]!.map(v => v == null ? '' : String(v));
  console.log(`Total filas: ${matrix.length - 1}`);
  console.log(`\nColumnas con "Partner" o "Customer no":`);
  headers.forEach((h, i) => {
    if (/partner|customer no/i.test(h)) console.log(`  col ${i}: ${h}`);
  });

  // Mirar los Partner Function / Customer no pairs (col 69-76 según inspección previa)
  console.log(`\nMuestra primeras 5 filas en cols 69-76 + col 0 (Customer):`);
  for (let i = 1; i <= 5 && i < matrix.length; i++) {
    const row = matrix[i]!;
    console.log(`  Customer=${row[0]}  → PF1=${row[69]}/${row[70]}  PF2=${row[71]}/${row[72]}  PF3=${row[73]}/${row[74]}  PF4=${row[75]}/${row[76]}`);
  }

  // Estadísticas: para cada par PF/Customer, ¿qué valores únicos hay en la Partner Function?
  console.log(`\nPartner Functions únicas:`);
  for (const idx of [69, 71, 73, 75]) {
    const vals = new Map<string, number>();
    for (let i = 1; i < matrix.length; i++) {
      const v = matrix[i]![idx];
      if (v != null) {
        const s = String(v).trim();
        if (s) vals.set(s, (vals.get(s) ?? 0) + 1);
      }
    }
    if (vals.size > 0) console.log(`  col ${idx}: ${[...vals].sort((a,b) => b[1]-a[1]).slice(0, 5).map(([k,n]) => `${k}(${n})`).join(', ')}`);
  }

  // Cuántas filas tienen al menos un partner alternativo
  let withPartners = 0;
  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i]!;
    if (row[70] || row[72] || row[74] || row[76]) withPartners++;
  }
  console.log(`\nFilas con al menos un partner alternativo: ${withPartners}/${matrix.length - 1}`);

  // Mirar también "alte Knr." (col 27)
  console.log(`\nMuestra alte Knr. (col 27, old SAP number):`);
  for (let i = 1; i <= 5 && i < matrix.length; i++) {
    const row = matrix[i]!;
    console.log(`  Customer=${row[0]}  alte Knr.=${row[27]}`);
  }
}