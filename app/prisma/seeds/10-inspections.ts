/**
 * Seed: ASSETS + INSPECTIONS + ORGANIZATIONS — ascensores (extracto Inspecciones_AS.xlsx).
 *
 * La lógica vive en el motor genérico lib/load-inspections.ts (compartido con el
 * seed 17, que carga el resto de aplicaciones técnicas: AT, BT y GESAP). Este seed
 * es la invocación de la fuente 'AS' y produce exactamente la misma carga que la
 * versión original previa al refactor (mismas claves, mismos campos).
 *
 * Uso:
 *   tsx prisma/seeds/10-inspections.ts          → carga completa
 *   tsx prisma/seeds/10-inspections.ts 200      → prueba: sólo las primeras 200 inspecciones
 */

import { prisma } from './lib/prisma';
import { loadInspectionSource, sourceByKey } from './lib/load-inspections';

export async function seedInspeccionesAscensores(limit = Infinity): Promise<void> {
  await loadInspectionSource(sourceByKey('AS')!, limit);
}

if (require.main === module) {
  const limit = Number(process.argv[2]) || Infinity;
  seedInspeccionesAscensores(limit)
    .then(() => prisma.$disconnect())
    .catch((err) => { console.error(err); prisma.$disconnect(); process.exit(1); });
}
