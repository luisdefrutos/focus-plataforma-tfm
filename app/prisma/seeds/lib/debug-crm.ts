import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import { prisma } from './prisma';

async function main() {
  const wb = XLSX.readFile(resolve(__dirname, '../../../../data/raw/CONTACTOS CRM/CONTACTOS_CRM.xlsx'));
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { defval: null });
  const crmCodes = new Set(
    rows.map(r => r['CUSTOMER CODE'] != null ? String(r['CUSTOMER CODE']).trim() : null).filter(Boolean) as string[]
  );
  console.log(`CRM codes únicos: ${crmCodes.size}`);
  console.log('Muestra 20 CRM codes:', [...crmCodes].slice(0, 20));

  const allBdCodes = await prisma.customerMaster.findMany({
    where: { sapCustomerCode: { not: null } },
    select: { sapCustomerCode: true }
  });
  const bdSet = new Set(allBdCodes.map(c => c.sapCustomerCode!));
  console.log(`BD codes únicos: ${bdSet.size}`);
  console.log('Muestra 20 BD codes:', [...bdSet].slice(0, 20));

  const matched = [...crmCodes].filter(c => bdSet.has(c));
  console.log(`Match exact: ${matched.length}/${crmCodes.size}`);

  // Probar matching alternativo: ¿quizás los CRM codes son partner roles distintos?
  // CUSTOMER CODE 2 podría enlazar mejor
  const sampleUnmatched = [...crmCodes].filter(c => !bdSet.has(c)).slice(0, 20);
  console.log('Muestra 20 CRM codes NO encontrados:', sampleUnmatched);

  // ¿Cuántos tienen CUSTOMER CODE 2?
  const withCode2 = rows.filter(r => r['CUSTOMER CODE 2']).length;
  console.log(`\nFilas con CUSTOMER CODE 2: ${withCode2}/${rows.length}`);
  if (withCode2 > 0) {
    const sample2 = rows.filter(r => r['CUSTOMER CODE 2']).slice(0, 10);
    console.log('Muestra 10 con ambos codes:');
    for (const r of sample2) console.log(`  CODE=${r['CUSTOMER CODE']} CODE2=${r['CUSTOMER CODE 2']} ENTITY=${r['ENTITY']}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });