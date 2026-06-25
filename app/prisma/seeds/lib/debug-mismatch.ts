/**
 * Investiga TODOS los registros con email específico para entender la asignación.
 */
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import { prisma } from './prisma';

async function main() {
  const targetEmail = 'ana.arnaiz@saica.com';
  const files = [
    'clientesTotales0135-validated.xlsx',
    'clientesTotales0158.xlsx',
  ];
  const allHits: Array<{ file: string; kunnr: string; name1: string }> = [];

  for (const f of files) {
    const path = resolve(__dirname, '../../../../data/raw/CONTACTOS CRM', f);
    const wb = XLSX.readFile(path);
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    for (const r of rows) {
      const e = r['ZTUEV_CONTACT_PERSON_STRUC-SMTP_ADDRESS'];
      if (e != null && String(e).trim().toLowerCase() === targetEmail) {
        allHits.push({
          file: f,
          kunnr: String(r['ZTUEV_CONTACT_PERSON_STRUC-KUNNR'] ?? ''),
          name1: String(r['BAPIBUS1006_CENTRAL_ORGAN-NAME1'] ?? ''),
        });
      }
    }
  }
  console.log(`Total filas para ${targetEmail}: ${allHits.length}`);

  // ¿Cuántas tienen NAME1="HIJOS DE RIVERA, S.A." (o similar)?
  const matchHijosName = allHits.filter(h => h.name1.toUpperCase().trim() === 'HIJOS DE RIVERA, S.A.');
  console.log(`  Con NAME1='HIJOS DE RIVERA, S.A.': ${matchHijosName.length}`);

  // Distribución de NAME1
  const byName = new Map<string, number>();
  for (const h of allHits) byName.set(h.name1, (byName.get(h.name1) ?? 0) + 1);
  console.log(`\nNAME1 más comunes:`);
  for (const [n, c] of [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${c}x  "${n}"`);
  }

  // Buscar en BD cuáles de esos NAME1 matchean con legal_name
  const namesUpper = new Set([...byName.keys()].map(n => n.toUpperCase().trim()));
  const customers = await prisma.customerMaster.findMany({
    where: { legalName: { in: [...byName.keys()] } },
    select: { customerId: true, legalName: true },
  });
  console.log(`\nCustomers en BD que matchean por nombre con algún NAME1: ${customers.length}`);
  for (const c of customers.slice(0, 10)) console.log(`  id=${c.customerId} "${c.legalName}"`);

  // Saica directamente
  console.log('\n¿Hay alguna fila con SAICA en NAME1?');
  const saicaRows = allHits.filter(h => h.name1.toUpperCase().includes('SAICA'));
  console.log(`  ${saicaRows.length} filas`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });