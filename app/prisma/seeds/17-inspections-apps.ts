/**
 * Seed: inspecciones del resto de aplicaciones técnicas (no ascensores).
 *
 * Fuentes (data/raw, junio 2026) — mismo formato que Inspecciones_AS.xlsx:
 *   - Inspecciones_AT.xlsx        → ALTA_TENSION  (ATISAE 0135)
 *   - Inspecciones_BT.xlsx        → BAJA_TENSION  (ATISAE 0135)
 *   - Inspecciones_GESAP_TSA.xlsx → GESAP         (ATISAE 0135)
 *   - Inspecciones_GESAP_TSI.xlsx → GESAP         (TÜV SÜD Iberia 0158)
 *
 * El motor y las configs de columnas viven en lib/load-inspections.ts.
 * Tras cargar: re-ejecutar 15 (org-backfill), 12 (org-contacts) y 16 (dedupe).
 *
 * Uso:
 *   tsx prisma/seeds/17-inspections-apps.ts                  → las 4 fuentes completas
 *   tsx prisma/seeds/17-inspections-apps.ts AT BT            → solo esas fuentes
 *   tsx prisma/seeds/17-inspections-apps.ts AT 200           → con límite de filas por fuente
 */

import { prisma } from './lib/prisma';
import { loadInspectionSource, sourceByKey, INSPECTION_SOURCES } from './lib/load-inspections';

const APP_KEYS = ['AT', 'BT', 'GESAP_TSA', 'GESAP_TSI'];

export async function seedInspeccionesApps(keys: string[] = APP_KEYS, limit = Infinity): Promise<void> {
  for (const key of keys) {
    const cfg = sourceByKey(key);
    if (!cfg) {
      console.error(`✖ Fuente desconocida: ${key}. Disponibles: ${INSPECTION_SOURCES.map(s => s.key).join(', ')}`);
      process.exitCode = 1;
      continue;
    }
    await loadInspectionSource(cfg, limit);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => /^\d+$/.test(a));
  const keys = args.filter(a => !/^\d+$/.test(a));
  seedInspeccionesApps(keys.length ? keys : APP_KEYS, limitArg ? Number(limitArg) : Infinity)
    .then(() => prisma.$disconnect())
    .catch((err) => { console.error(err); prisma.$disconnect(); process.exit(1); });
}
