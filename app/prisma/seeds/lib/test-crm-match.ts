/**
 * Experimento: cuánto recuperamos si enlazamos por NAME1 (razón social) además del code.
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { prisma } from './prisma';

async function main() {
  const dir = resolve(__dirname, '../../../../data/raw/CONTACTOS CRM');
  const files = readdirSync(dir).filter(f => /clientestotales\d+(-validated)?\.xlsx$/i.test(f));
  console.log('Ficheros:', files);

  // Cargar todos los crm rows
  const allCrm: { code: string; name1: string | null; entity: string }[] = [];
  for (const f of files) {
    const entityMatch = f.match(/(\d+)/);
    if (!entityMatch) continue;
    const entity = entityMatch[1]!;
    const wb = XLSX.readFile(resolve(dir, f));
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`  ${f}: ${rows.length} filas (entity=${entity})`);
    for (const r of rows) {
      const code = r['ZTUEV_CONTACT_PERSON_STRUC-KUNNR'];
      const name1 = r['BAPIBUS1006_CENTRAL_ORGAN-NAME1'];
      if (code != null) {
        allCrm.push({
          code: String(code).trim(),
          name1: name1 != null ? String(name1).trim() : null,
          entity,
        });
      }
    }
  }
  console.log(`\nTotal filas CRM con KUNNR: ${allCrm.length}`);

  // Codes únicos y NAME1 únicos
  const uniqueCodes = new Set(allCrm.map(c => c.code));
  const uniqueNames = new Set(allCrm.filter(c => c.name1).map(c => c.name1!));
  console.log(`Codes únicos: ${uniqueCodes.size}`);
  console.log(`Names únicos (NAME1): ${uniqueNames.size}`);

  // Customer master
  const customers = await prisma.customerMaster.findMany({
    select: { customerId: true, sapCustomerCode: true, legalName: true },
  });
  const bdCodes = new Set(customers.filter(c => c.sapCustomerCode).map(c => c.sapCustomerCode!));
  const bdNames = new Map<string, number>();
  for (const c of customers) {
    bdNames.set(c.legalName.toUpperCase().trim(), c.customerId);
  }
  console.log(`\nBD codes: ${bdCodes.size}, BD names: ${bdNames.size}`);

  // Match por CODE
  const matchedByCode = [...uniqueCodes].filter(c => bdCodes.has(c)).length;
  console.log(`\n📊 Match exact por code:  ${matchedByCode} / ${uniqueCodes.size}`);

  // Match por NAME1 (uppercase, trimmed)
  const matchedByName = [...uniqueNames].filter(n => bdNames.has(n.toUpperCase().trim())).length;
  console.log(`📊 Match exact por NAME1: ${matchedByName} / ${uniqueNames.size}`);

  // Match COMBINADO (code O nombre): cuántas filas crm matchearían?
  let combined = 0;
  for (const c of allCrm) {
    const byCode = bdCodes.has(c.code);
    const byName = c.name1 ? bdNames.has(c.name1.toUpperCase().trim()) : false;
    if (byCode || byName) combined++;
  }
  console.log(`📊 Match COMBINADO (code OR name): ${combined} / ${allCrm.length} filas (${(combined * 100 / allCrm.length).toFixed(1)}%)`);

  // Para los que NO matchean, ¿qué pinta tienen?
  const unmatched = allCrm.filter(c => !bdCodes.has(c.code) && (!c.name1 || !bdNames.has(c.name1.toUpperCase().trim()))).slice(0, 10);
  console.log(`\nMuestra 10 contactos NO encontrados:`);
  for (const c of unmatched) console.log(`  code=${c.code}  name1="${c.name1}"  entity=${c.entity}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });