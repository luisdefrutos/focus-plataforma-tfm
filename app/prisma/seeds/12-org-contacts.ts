/**
 * Seed: ORGANIZATION_CONTACTS — personas de contacto del GESTOR y del TITULAR.
 *
 * Fuentes: los 5 extractos de inspecciones (AS, AT, BT, GESAP_TSA, GESAP_TSI); las
 * configs de columnas de los sub-bloques CONTACTO viven en lib/load-inspections.ts.
 * Cuelga de `organizations` (resuelto por CIF). NO toca la tabla `contacts` (CRM).
 *
 * Idempotencia: recarga por fuente — BORRA los contactos de los source_system
 * seleccionados y los reinserta desde el extracto (organization_contacts no tiene
 * UK natural, así que skipDuplicates no protege entre ejecuciones). Tras este seed
 * hay que RE-EJECUTAR el 16 (dedupe-contacts), que vuelve a fusionar duplicados
 * y erratas entre fuentes y con el CRM.
 *
 * RGPD: se carga TODO el dato y se clasifica el email en `email_validation`
 *   (VALIDO = B2B con dominio propio · GRATUITO = gmail/hotmail/… · SIN_EMAIL = ausente/malformado).
 * Dedup en memoria por (orgId, email) — entre fuentes gana la primera (AS primero).
 *
 * Uso:
 *   tsx prisma/seeds/12-org-contacts.ts                  → las 5 fuentes
 *   tsx prisma/seeds/12-org-contacts.ts AT GESAP_TSI     → solo esas fuentes
 *   tsx prisma/seeds/12-org-contacts.ts 500              → con límite de filas por fuente
 */

import { prisma } from './lib/prisma';
import { randomUUID } from 'node:crypto';
import {
  INSPECTION_SOURCES, sourceByKey, readSourceMatrix, DATA_START_INDEX,
  cleanStr, normCif, type InspectionSourceConfig, type ContactCols,
} from './lib/load-inspections';

const BATCH_SIZE = 1000;

const FREE_EMAIL = /@(gmail|hotmail|outlook|yahoo|live|msn|icloud|me|aol|gmx|terra|wanadoo|ya|telefonica|movistar|orange|jazztel|protonmail)\./i;

function pickEmail(a: unknown, b: unknown): string | null {
  for (const v of [a, b]) {
    const s = cleanStr(v);
    if (s && s.includes('@')) return s.toLowerCase();
  }
  return null;
}
function classifyEmail(email: string | null): string {
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'SIN_EMAIL';
  return FREE_EMAIL.test(email) ? 'GRATUITO' : 'VALIDO';
}

type OC = {
  orgId: number; role: string; fullName: string | null; firstName: string | null; lastName: string | null;
  email: string | null; phone: string | null; mobile: string | null; fax: string | null;
  emailValidation: string; sourceSystem: string;
};

export async function seedOrgContacts(keys?: string[], limit = Infinity): Promise<void> {
  const sources: InspectionSourceConfig[] = (keys?.length ? keys : INSPECTION_SOURCES.map(s => s.key))
    .map(k => {
      const cfg = sourceByKey(k);
      if (!cfg) throw new Error(`Fuente desconocida: ${k}. Disponibles: ${INSPECTION_SOURCES.map(s => s.key).join(', ')}`);
      return cfg;
    });

  console.log(`📇 Seed ORGANIZATION_CONTACTS (gestor + titular) — fuentes: ${sources.map(s => s.key).join(', ')}`);
  const orgRows = await prisma.organization.findMany({ select: { orgId: true, taxId: true } });
  const orgIdByTax = new Map(orgRows.map((o) => [o.taxId, o.orgId]));
  console.log(`   ${orgIdByTax.size} organizaciones en BD`);

  const etlRunId = BigInt(Date.now());
  const dedup = new Map<string, OC>();

  const consider = (
    r: (string | number | null)[], role: string, sourceSystem: string,
    cifIdx: number, c: ContactCols,
  ): void => {
    const cif = normCif(r[cifIdx]);
    if (!cif) return;
    const orgId = orgIdByTax.get(cif);
    if (!orgId) return;
    const nombre = cleanStr(r[c.nombre]);
    const apellidos = cleanStr(r[c.apellidos]);
    const email = pickEmail(r[c.email], r[c.email1]);
    const phone = cleanStr(r[c.tel]) ?? cleanStr(r[c.tel1]);
    const mobile = c.mobile != null ? cleanStr(r[c.mobile]) : null;
    const fax = c.fax != null ? cleanStr(r[c.fax]) : null;
    const fullName = [nombre, apellidos].filter(Boolean).join(' ').trim() || null;
    if (!email && !fullName && !phone && !mobile) return; // no hay contacto
    const key = email ? `${orgId}|${email}` : `${orgId}|N:${fullName ?? ''}/${phone ?? ''}`;
    if (dedup.has(key)) return;
    dedup.set(key, {
      orgId, role, fullName,
      firstName: nombre ? nombre.slice(0, 128) : null,
      lastName: apellidos ? apellidos.slice(0, 128) : null,
      email: email ? email.slice(0, 255) : null,
      phone: phone ? phone.slice(0, 64) : null,
      mobile: mobile ? mobile.slice(0, 64) : null,
      fax: fax ? fax.slice(0, 64) : null,
      emailValidation: classifyEmail(email),
      sourceSystem,
    });
  };

  for (const cfg of sources) {
    const matrix = readSourceMatrix(cfg);
    let scanned = 0;
    const before = dedup.size;
    for (let i = DATA_START_INDEX; i < matrix.length && scanned < limit; i++) {
      const r = matrix[i];
      if (!r) continue;
      scanned++;
      consider(r, 'GESTOR', cfg.sourceSystem, cfg.cols.gCif, cfg.cols.contact.g);
      consider(r, 'TITULAR', cfg.sourceSystem, cfg.cols.tCif, cfg.cols.contact.t);
    }
    console.log(`   ${cfg.key}: ${scanned} filas → +${dedup.size - before} contactos nuevos (acumulado ${dedup.size})`);
  }

  // Recarga por fuente: fuera lo anterior de estos source_system, dentro lo del extracto.
  const systems = sources.map(s => s.sourceSystem);
  const del = await prisma.organizationContact.deleteMany({ where: { sourceSystem: { in: systems } } });
  console.log(`   🗑 ${del.count} contactos previos de ${systems.join(', ')} eliminados (recarga)`);

  const arr = [...dedup.values()].map((c) => ({
    externalGuid: randomUUID(),
    orgId: c.orgId, role: c.role,
    fullName: c.fullName ? c.fullName.slice(0, 255) : null,
    firstName: c.firstName, lastName: c.lastName,
    email: c.email, phone: c.phone, mobile: c.mobile, fax: c.fax,
    emailValidation: c.emailValidation,
    sourceSystem: c.sourceSystem, etlRunId,
  }));
  console.log(`   ${arr.length} contactos únicos a insertar`);

  let done = 0;
  for (let i = 0; i < arr.length; i += BATCH_SIZE) {
    const res = await prisma.organizationContact.createMany({ data: arr.slice(i, i + BATCH_SIZE), skipDuplicates: true });
    done += res.count;
    if ((i / BATCH_SIZE) % 10 === 0) process.stdout.write(`      ${done}/${arr.length}\r`);
  }
  console.log(`      ${done}/${arr.length} insertados ✓`);

  const byVal = await prisma.organizationContact.groupBy({ by: ['emailValidation'], _count: { _all: true } });
  console.log('   Por validación de email →', byVal.map((g) => `${g.emailValidation}: ${g._count._all}`).join('   '));
  console.log('   ⚠ Recuerda re-ejecutar el seed 16 (dedupe-contacts) para fusionar duplicados entre fuentes y con CRM.');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => /^\d+$/.test(a));
  const keys = args.filter(a => !/^\d+$/.test(a));
  seedOrgContacts(keys.length ? keys : undefined, limitArg ? Number(limitArg) : Infinity)
    .then(() => prisma.$disconnect())
    .catch((err) => { console.error(err); prisma.$disconnect(); process.exit(1); });
}
