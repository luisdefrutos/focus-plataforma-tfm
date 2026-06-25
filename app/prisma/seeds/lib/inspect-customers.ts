/**
 * Inspeccion detallada: customer_code y tax_id en CUSTOMER_LIST y CONTACTOS_CRM,
 * formato de "Ship to party" en facturas (con prefijo T...).
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

// 1) CUSTOMER_LIST/0380.XLSX — el más pequeño, para inspección rápida
const custPath = resolve(__dirname, '../../../../data/raw/CUSTOMER_LIST/0380.XLSX');
console.log('═══ CUSTOMER_LIST/0380.XLSX ═══');
{
  const wb = XLSX.readFile(custPath);
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  console.log(`Filas: ${rows.length}`);
  const sample = rows[0] ?? {};
  // mostrar solo campos interesantes
  const keys = ['Customer', 'Name', 'VAT', 'Tax 1', 'Tax 2', 'Street', 'Zip', 'Post Code', 'City', 'District', 'C', 'Tel', 'Industry', 'Company Code'];
  console.log('\nMuestra fila 1:');
  for (const k of keys) console.log(`  ${k.padEnd(15)} = ${JSON.stringify(sample[k])}`);

  // distinct prefixes de Customer
  const codes = rows.map(r => String(r['Customer'])).filter(Boolean);
  const prefixes = new Map<string, number>();
  for (const c of codes) {
    const p = c.substring(0, 4);
    prefixes.set(p, (prefixes.get(p) ?? 0) + 1);
  }
  console.log(`\nPrefijos de Customer code (primeros 4 chars):`);
  for (const [p, n] of [...prefixes].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`  ${p}*: ${n}`);

  // VATs
  const vats = rows.map(r => r['VAT']).filter(Boolean) as string[];
  console.log(`\nVATs no nulos: ${vats.length}/${rows.length}, muestra 3: ${vats.slice(0, 3).join(', ')}`);
}

// 2) CONTACTOS_CRM.xlsx — formato del customer code
console.log('\n═══ CONTACTOS_CRM.xlsx ═══');
{
  const path = resolve(__dirname, '../../../../data/raw/CONTACTOS CRM/CONTACTOS_CRM.xlsx');
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  console.log(`Filas: ${rows.length}`);
  const sample = rows[0] ?? {};
  console.log('\nMuestra fila 1:');
  for (const k of Object.keys(sample)) console.log(`  ${k.padEnd(25)} = ${JSON.stringify(sample[k])}`);

  // Prefijos de CUSTOMER CODE
  const codes = rows.map(r => String(r['CUSTOMER CODE'])).filter(Boolean);
  const prefixes = new Map<string, number>();
  for (const c of codes) {
    const p = c.substring(0, 4);
    prefixes.set(p, (prefixes.get(p) ?? 0) + 1);
  }
  console.log(`\nPrefijos de CUSTOMER CODE (primeros 4 chars):`);
  for (const [p, n] of [...prefixes].sort((a, b) => b[1] - a[1]).slice(0, 5)) console.log(`  ${p}*: ${n}`);

  // Filas válidas
  const valid = rows.filter(r => r['Email-Validacion'] === 'Válido').length;
  console.log(`\nFilas con Email-Validacion='Válido': ${valid} (${(valid * 100 / rows.length).toFixed(1)}%)`);
}

// 3) Comprobar si el customer_code de CUSTOMER_LIST coincide con Ship-to-party de billing
console.log('\n═══ Cross-check con billing (ZKSD_SD14_2024) ═══');
{
  const path = resolve(__dirname, '../../../../data/raw/DATOS_FACTURACION/ZKSD_SD14_2024.xlsx');
  const wb = XLSX.readFile(path, { sheetRows: 5000 }); // solo primeras 5k filas para muestra
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];
  const shipToCodes = new Set<string>();
  for (let i = 12; i < matrix.length; i++) {
    const v = matrix[i]![7]; // col 7 = Ship to party
    if (v) shipToCodes.add(String(v));
  }
  console.log(`Ship-to-party codes únicos (muestra ~5k facturas 2024): ${shipToCodes.size}`);
  console.log(`Ejemplos:`, [...shipToCodes].slice(0, 5));

  // Comparar con CUSTOMER_LIST 0380
  const wbC = XLSX.readFile(resolve(__dirname, '../../../../data/raw/CUSTOMER_LIST/0380.XLSX'));
  const sheetC = wbC.Sheets[wbC.SheetNames[0]!]!;
  const rowsC = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheetC, { defval: null });
  const custCodes = new Set(rowsC.map(r => String(r['Customer'])));
  console.log(`Customer codes en CUSTOMER_LIST/0380: ${custCodes.size}`);
  const overlap = [...shipToCodes].filter(c => custCodes.has(c));
  console.log(`Overlap entre ship-to-party y customer codes: ${overlap.length}`);
  if (overlap.length > 0) console.log(`Ejemplos de overlap:`, overlap.slice(0, 3));
}