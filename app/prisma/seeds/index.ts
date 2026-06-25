/**
 * Orquestador de los CATÁLOGOS BASE — `npm run seed`.
 *
 * Carga sólo lo que no depende de los Excel de datos: estructura organizativa,
 * catálogo de servicios, estados y CNAE. Las cargas pesadas con dependencias de
 * fichero se ejecutan aparte, en este orden:
 *   seed:billing → seed:customers → seed:contacts → seed:normalize → seed:iam
 *   → seed:inspections → backfill:salesorder → seed:org-contacts → seed:customer-cnae
 * (ver tabla de seeds en CLAUDE.md). Cada seed es idempotente.
 */

import { prisma } from './lib/prisma';
import { seedOrgStructure } from './01-org-structure';
import { seedProductCatalog } from './02-product-catalog';
import { seedStatusCatalog } from './03-status-catalog';
import { seedCnaeCatalog } from './08-cnae-catalog';

async function main(): Promise<void> {
  const t0 = Date.now();
  console.log('═══ Focus seeds (catálogos base) — inicio ═══\n');

  await seedOrgStructure();
  await seedProductCatalog();
  await seedStatusCatalog();
  await seedCnaeCatalog();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n═══ Focus seeds (catálogos base) — fin (${elapsed}s) ═══`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('\n❌ Error en seed:', err);
    prisma.$disconnect();
    process.exit(1);
  });