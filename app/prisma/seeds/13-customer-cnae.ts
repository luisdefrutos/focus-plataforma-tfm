/**
 * Seed: CUSTOMER_CNAE — clasifica cada cliente con su CNAE principal.
 *
 * Fuente: CUSTOMER_MASTER.industry_code (lo carga 05-customer-enrichment desde la
 * columna "Industry" de CUSTOMER_LIST). Los valores son códigos CNAE-2009 a nivel de
 * división (2 dígitos, p.ej. "96") o de grupo (con punto, p.ej. "45.2"); estos últimos
 * se normalizan truncando en el punto y se enlazan con CNAE_CATALOG. Lo que no resuelve
 * (p.ej. "0001") cae al código '999' (sin clasificar). Marca is_primary=true.
 *
 * Depende de: 05-customer-enrichment (industry_code) + 08-cnae-catalog (catálogo).
 * Idempotente: createMany skipDuplicates sobre la UK (customer_id, cnae_id).
 */

import { prisma, SEED_AUDIT } from './lib/prisma';
import { randomUUID } from 'node:crypto';

const BATCH_SIZE = 1000;

/** "45.2" → "45"; "96" → "96". Devuelve la parte anterior al primer punto. */
function toDivision(code: string): string {
  return code.split('.')[0]!.trim();
}

export async function seedCustomerCnae(): Promise<void> {
  console.log('🏭 Seed CUSTOMER_CNAE — mapeo industry_code → CNAE…');

  // Catálogo CNAE en memoria: cnae_code → cnae_id.
  const catalog = await prisma.cnaeCatalog.findMany({ select: { cnaeId: true, cnaeCode: true } });
  const codeToId = new Map(catalog.map(c => [c.cnaeCode, c.cnaeId]));
  const unclassifiedId = codeToId.get('999');
  if (unclassifiedId === undefined) {
    throw new Error("CNAE '999' (sin clasificar) no existe — ejecuta `npm run seed:cnae` antes.");
  }

  const customers = await prisma.customerMaster.findMany({
    where: { industryCode: { not: null } },
    select: { customerId: true, industryCode: true },
  });
  console.log(`   ${customers.length} clientes con industry_code`);

  type Row = {
    externalGuid: string;
    customerId: number;
    cnaeId: number;
    isPrimary: boolean;
    sourceSystem: string;
    etlRunId: bigint;
  };
  const rows: Row[] = [];
  let matched = 0;
  let fallback = 0;
  for (const c of customers) {
    const raw = (c.industryCode ?? '').trim();
    if (!raw) continue;
    const cnaeId = codeToId.get(raw) ?? codeToId.get(toDivision(raw));
    if (cnaeId !== undefined) {
      matched++;
      rows.push({ externalGuid: randomUUID(), customerId: c.customerId, cnaeId, isPrimary: true, ...SEED_AUDIT });
    } else {
      fallback++;
      rows.push({ externalGuid: randomUUID(), customerId: c.customerId, cnaeId: unclassifiedId, isPrimary: true, ...SEED_AUDIT });
    }
  }
  console.log(`   Resueltos a una división CNAE: ${matched} · a '999' sin clasificar: ${fallback}`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const res = await prisma.customerCnae.createMany({
      data: rows.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  console.log(`   ✔ CUSTOMER_CNAE: ${inserted} filas nuevas (los duplicados ya existentes se omiten)`);
}

if (require.main === module) {
  seedCustomerCnae()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
