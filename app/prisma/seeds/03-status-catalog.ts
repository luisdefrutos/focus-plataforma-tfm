/**
 * Seed: STATUS_CATALOG.
 * Precarga 23 estados — 4 CUSTOMER + 8 OPPORTUNITY + 4 CAMPAIGN + 4 TARGET + 3 EXCLUSION.
 *
 * En v1 están activos CUSTOMER y OPPORTUNITY; el resto (CAMPAIGN/TARGET/EXCLUSION) son v2,
 * pero precargamos sus filas para que el catálogo esté completo desde el inicio.
 *
 * Idempotente: upsert por (entity_name, status_code).
 */

import { prisma } from './lib/prisma';

type StatusSeed = {
  entityName: 'CUSTOMER' | 'OPPORTUNITY' | 'CAMPAIGN' | 'TARGET' | 'EXCLUSION';
  statusCode: string;
  statusName: string;
  description: string;
  displayOrder: number;
};

const STATUSES: StatusSeed[] = [
  // CUSTOMER (4) — refleja el enum CustomerStatus
  { entityName: 'CUSTOMER', statusCode: 'ACTIVE',         statusName: 'Activo',                description: 'Cliente operativo.',                                            displayOrder: 1 },
  { entityName: 'CUSTOMER', statusCode: 'BLOCKED_DUP',    statusName: 'Bloqueado: duplicado',  description: 'Registro superseded — ver supersededBySapCode para el sucesor.', displayOrder: 2 },
  { entityName: 'CUSTOMER', statusCode: 'BLOCKED_UNPAID', statusName: 'Bloqueado: impagados',  description: 'Bloqueado por impago.',                                         displayOrder: 3 },
  { entityName: 'CUSTOMER', statusCode: 'BLOCKED_OTHER',  statusName: 'Bloqueado: otros',      description: 'Bloqueado por otras razones administrativas.',                 displayOrder: 4 },

  // OPPORTUNITY (8)
  { entityName: 'OPPORTUNITY', statusCode: 'NEW',         statusName: 'Nueva',       description: 'Generada automáticamente, pendiente de revisión.', displayOrder: 1 },
  { entityName: 'OPPORTUNITY', statusCode: 'ACCEPTED',    statusName: 'Aceptada',    description: 'El comercial decide trabajarla.',                  displayOrder: 2 },
  { entityName: 'OPPORTUNITY', statusCode: 'IN_PROGRESS', statusName: 'En progreso', description: 'Se está preparando propuesta o contactando.',      displayOrder: 3 },
  { entityName: 'OPPORTUNITY', statusCode: 'IN_CAMPAIGN', statusName: 'En campaña',  description: 'Vinculada a una campaña comercial formal.',        displayOrder: 4 },
  { entityName: 'OPPORTUNITY', statusCode: 'QUALIFIED',   statusName: 'Cualificada', description: 'El cliente ha mostrado interés real.',             displayOrder: 5 },
  { entityName: 'OPPORTUNITY', statusCode: 'REJECTED',    statusName: 'Rechazada',   description: 'Descartada tras evaluación.',                      displayOrder: 6 },
  { entityName: 'OPPORTUNITY', statusCode: 'CLOSED_WON',  statusName: 'Ganada',      description: 'Venta materializada con éxito.',                   displayOrder: 7 },
  { entityName: 'OPPORTUNITY', statusCode: 'CLOSED_LOST', statusName: 'Perdida',     description: 'Proceso comercial concluido sin éxito.',           displayOrder: 8 },

  // CAMPAIGN (4) — v2
  { entityName: 'CAMPAIGN', statusCode: 'DRAFT',     statusName: 'Borrador',   description: 'Campaña en preparación.',         displayOrder: 1 },
  { entityName: 'CAMPAIGN', statusCode: 'ACTIVE',    statusName: 'Activa',     description: 'Campaña en ejecución.',           displayOrder: 2 },
  { entityName: 'CAMPAIGN', statusCode: 'COMPLETED', statusName: 'Completada', description: 'Campaña finalizada.',             displayOrder: 3 },
  { entityName: 'CAMPAIGN', statusCode: 'CANCELLED', statusName: 'Cancelada',  description: 'Campaña cancelada antes de fin.', displayOrder: 4 },

  // TARGET (4) — v2
  { entityName: 'TARGET', statusCode: 'PENDING',   statusName: 'Pendiente',  description: 'Pendiente de contacto.',          displayOrder: 1 },
  { entityName: 'TARGET', statusCode: 'CONTACTED', statusName: 'Contactado', description: 'Contacto realizado.',             displayOrder: 2 },
  { entityName: 'TARGET', statusCode: 'CONVERTED', statusName: 'Convertido', description: 'Convertido en venta.',            displayOrder: 3 },
  { entityName: 'TARGET', statusCode: 'REJECTED',  statusName: 'Rechazado',  description: 'Rechazado por el cliente.',       displayOrder: 4 },

  // EXCLUSION (3) — v2
  { entityName: 'EXCLUSION', statusCode: 'PERMANENT',      statusName: 'Permanente',     description: 'Sin fecha de caducidad.',      displayOrder: 1 },
  { entityName: 'EXCLUSION', statusCode: 'TEMPORARY',     statusName: 'Temporal',        description: 'Vigencia entre dos fechas.',   displayOrder: 2 },
  { entityName: 'EXCLUSION', statusCode: 'MARKETING_ONLY', statusName: 'Solo marketing', description: 'Afecta sólo a marketing.',     displayOrder: 3 },
];

export async function seedStatusCatalog(): Promise<void> {
  console.log(`\n🏷  Cargando ${STATUSES.length} STATUS_CATALOG…`);
  for (const s of STATUSES) {
    await prisma.statusCatalog.upsert({
      where: { uk_status_entity_code: { entityName: s.entityName, statusCode: s.statusCode } },
      update: { statusName: s.statusName, description: s.description, displayOrder: s.displayOrder },
      create: { ...s, isActive: true },
    });
  }
  console.log(`   ✔ ${STATUSES.length} estados cargados.`);
}

if (require.main === module) {
  seedStatusCatalog()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}