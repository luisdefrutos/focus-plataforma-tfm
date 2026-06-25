/**
 * Investiga el mapping real de ZTUEV_CONTACT_PERSON_STRUC-TITLE.
 * Toma muestras del CRM con valores distintos de TITLE y mira el FULLNAME asociado
 * (que ya viene con "Mr.", "Ms.", "Mrs." prepended por SAP).
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';

const path = resolve(__dirname, '../../../../data/raw/CONTACTOS CRM/clientesTotales0135-validated.xlsx');
const wb = XLSX.readFile(path);
const sheet = wb.Sheets[wb.SheetNames[0]!]!;
const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

// Para cada valor de TITLE, contar y mostrar muestras de FULLNAME
const byTitle = new Map<string, { count: number; samples: string[] }>();
for (const r of rows) {
  const t = r['ZTUEV_CONTACT_PERSON_STRUC-TITLE'];
  const fn = r['BAPIBUS1006_CENTRAL_PERSON-FULLNAME'];
  if (t == null || fn == null) continue;
  const tkey = String(t).trim();
  if (!byTitle.has(tkey)) byTitle.set(tkey, { count: 0, samples: [] });
  const entry = byTitle.get(tkey)!;
  entry.count++;
  if (entry.samples.length < 5) entry.samples.push(String(fn));
}

console.log('Distribución TITLE → FULLNAME samples:');
for (const [t, { count, samples }] of [...byTitle].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  console.log(`\n  TITLE = "${t}"  (${count} ocurrencias)`);
  samples.forEach(s => console.log(`    - ${s}`));
}