/**
 * Seed: backfill UNIVERSAL del Golden Record por CIF (ORGANIZATIONS + CUSTOMER_MASTER.org_id).
 *
 * Hasta ahora ORGANIZATIONS solo se sembraba desde los extractos de inspecciones
 * (ascensores), así que la deduplicación por CIF del buscador/ficha/top/segmentación
 * solo funcionaba para esos clientes (25.999 de 26.001 CIFs multi-registro sin org).
 * Este seed la hace universal:
 *
 *   1. CURA DE GEMELOS T7: el mismo cliente SAP existe a veces dos veces — código
 *      `T75010478117` (facturación ZKSD) y `5010478117` (CUSTOMER_LIST sin prefijo).
 *      Copia el tax_id del gemelo que lo tiene al que no (ambas direcciones).
 *   2. ORGANIZATIONS: crea una organización por cada CIF válido de CUSTOMER_MASTER
 *      que aún no exista. CIF normalizado igual que el seed de inspecciones (normCif:
 *      mayúsculas, sin separadores, sin prefijo ES). Nombre = el del registro con más
 *      facturación de ese CIF (desempate: ACTIVE > bloqueado, menor customer_id).
 *   3. ENLACE: rellena CUSTOMER_MASTER.org_id (solo NULL) por CIF normalizado,
 *      vía tabla staging + UPDATE JOIN (mismo patrón que el seed 11).
 *
 * Idempotente y RE-EJECUTABLE tras cargar nuevos extractos de inspecciones de otras
 * aplicaciones técnicas (presión, AT/BT, …): las orgs se deduplican por tax_id (UK)
 * con skipDuplicates, y los futuros loaders de inspecciones encontrarán las orgs ya
 * creadas aquí y resolverán sus FKs titular/mantenedor contra ellas.
 *
 * Uso: npm run seed:org-backfill   (tras 04-billing y 05-customer-enrichment)
 */

import { prisma } from './lib/prisma';
import { randomUUID } from 'node:crypto';

const BATCH_SIZE = 1000;
const STAGING_BATCH = 2000;
const AUDIT = { sourceSystem: 'SEED_ORG_BACKFILL', etlRunId: BigInt(Date.now()) };

/** CIF/NIF normalizado (idéntico al seed 10-inspections): mayúsculas, sin separadores, sin prefijo país ES. */
function normCif(v: string | null): string | null {
  if (!v) return null;
  let c = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (/^ES[0-9A-Z]{9}$/.test(c)) c = c.slice(2);
  return c || null;
}

/** Identificadores plausibles: descarta residuos (CURPs, registros de 18+ dígitos, fragmentos). */
function isPlausibleCif(norm: string): boolean {
  return norm.length >= 8 && norm.length <= 16;
}

/** País inferido del prefijo VAT (FR…, DE…); los CIF españoles ya van sin prefijo. */
function countryOf(norm: string): string {
  const m = norm.match(/^([A-Z]{2})/);
  return m && norm.length >= 10 ? m[1]! : 'ES';
}

/** Tipo de organización inferido del nombre/CIF (misma lógica que el seed 10-inspections). */
function inferOrgType(name: string | null, cif: string | null): string {
  const n = (name ?? '').toUpperCase();
  if (/C\.?\s?P\.?|COMUNIDAD|PROPIETARIOS|MANCOMUNIDAD/.test(n)) return 'COMUNIDAD_PROPIETARIOS';
  if (/ADMON|ADMINISTRAC|FINCAS/.test(n)) return 'ADMIN_FINCAS';
  if (cif && /^[0-9]{8}[A-Z]$/.test(cif)) return 'PERSONA_FISICA';
  if (cif && /^[XYZ][0-9]{7}[A-Z]$/.test(cif)) return 'PERSONA_FISICA';
  return 'EMPRESA';
}

export async function backfillOrganizations(): Promise<void> {
  console.log('🏛  Backfill universal del Golden Record por CIF…');

  // ── 1) Curar gemelos T7: copiar tax_id entre pares T75xxxx ↔ 5xxxx ──
  const fixedT75 = await prisma.$executeRaw`
    UPDATE customer_master c1
    JOIN customer_master c2 ON c1.sap_customer_code = CONCAT('T7', c2.sap_customer_code)
    SET c1.tax_id = c2.tax_id
    WHERE c1.tax_id IS NULL AND c2.tax_id IS NOT NULL`;
  const fixedBare = await prisma.$executeRaw`
    UPDATE customer_master c2
    JOIN customer_master c1 ON c1.sap_customer_code = CONCAT('T7', c2.sap_customer_code)
    SET c2.tax_id = c1.tax_id
    WHERE c2.tax_id IS NULL AND c1.tax_id IS NOT NULL`;
  console.log(`   1) Gemelos T7 curados: ${fixedT75} filas T75 + ${fixedBare} filas peladas reciben tax_id`);

  // ── 2) Cargar estado actual ──
  const [orgs, customers, billingCounts] = await Promise.all([
    prisma.organization.findMany({ select: { orgId: true, taxId: true } }),
    prisma.customerMaster.findMany({
      where: { taxId: { not: null } },
      select: { customerId: true, taxId: true, legalName: true, status: true, orgId: true },
    }),
    prisma.$queryRaw<Array<{ customer_id: number | bigint; n: number | bigint }>>`
      SELECT customer_id, COUNT(*) AS n FROM billing_records GROUP BY customer_id`,
  ]);
  const orgByCif = new Map(orgs.map(o => [o.taxId, o.orgId]));
  const billedBy = new Map(billingCounts.map(b => [Number(b.customer_id), Number(b.n)]));
  console.log(`   2) Estado: ${orgs.length} organizaciones · ${customers.length} clientes con tax_id`);

  // ── 3) Crear organizaciones que faltan (una por CIF normalizado válido) ──
  type Candidate = { name: string; status: string; customerId: number; billed: number };
  const bestByCif = new Map<string, Candidate>();
  let invalid = 0;
  for (const c of customers) {
    const norm = normCif(c.taxId);
    if (!norm || !isPlausibleCif(norm)) { invalid++; continue; }
    if (orgByCif.has(norm)) continue;
    const cand: Candidate = {
      name: c.legalName,
      status: c.status,
      customerId: c.customerId,
      billed: billedBy.get(c.customerId) ?? 0,
    };
    const prev = bestByCif.get(norm);
    // Mejor representante: más facturas; luego ACTIVE sobre bloqueado; luego menor id (determinista).
    const better =
      !prev ||
      cand.billed > prev.billed ||
      (cand.billed === prev.billed && cand.status === 'ACTIVE' && prev.status !== 'ACTIVE') ||
      (cand.billed === prev.billed && cand.status === prev.status && cand.customerId < prev.customerId);
    if (better) bestByCif.set(norm, cand);
  }

  const toCreate = [...bestByCif.entries()].map(([cif, best]) => ({
    externalGuid: randomUUID(),
    taxId: cif,
    legalName: best.name,
    orgType: inferOrgType(best.name, cif),
    countryCode: countryOf(cif),
    ...AUDIT,
  }));
  console.log(`   3) Organizaciones nuevas a crear: ${toCreate.length} (descartados ${invalid} tax_id no plausibles)`);

  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const res = await prisma.organization.createMany({
      data: toCreate.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
    created += res.count;
    if ((i / BATCH_SIZE) % 20 === 0) process.stdout.write(`      orgs ${Math.min(i + BATCH_SIZE, toCreate.length)}/${toCreate.length}\r`);
  }
  console.log(`      orgs creadas: ${created} ✓`);

  // ── 4) Enlazar org_id de TODOS los clientes (solo donde es NULL) ──
  const allOrgs = await prisma.organization.findMany({ select: { orgId: true, taxId: true } });
  const fullOrgByCif = new Map(allOrgs.map(o => [o.taxId, o.orgId]));

  const pairs: Array<[number, number]> = [];
  for (const c of customers) {
    if (c.orgId !== null) continue;
    const norm = normCif(c.taxId);
    if (!norm) continue;
    const orgId = fullOrgByCif.get(norm);
    if (orgId !== undefined) pairs.push([c.customerId, orgId]);
  }
  console.log(`   4) Clientes a enlazar (org_id NULL → org): ${pairs.length}`);

  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS _org_backfill');
  await prisma.$executeRawUnsafe(
    'CREATE TABLE _org_backfill (customer_id INT NOT NULL PRIMARY KEY, org_id INT NOT NULL)'
  );
  for (let i = 0; i < pairs.length; i += STAGING_BATCH) {
    // customer_id/org_id son enteros generados por la BD; coerción numérica
    // defensiva para garantizar que solo entran enteros en el INSERT inline.
    const values = pairs.slice(i, i + STAGING_BATCH).map(([c, o]) => `(${Number(c)},${Number(o)})`).join(',');
    await prisma.$executeRawUnsafe(`INSERT IGNORE INTO _org_backfill (customer_id, org_id) VALUES ${values}`);
    if ((i / STAGING_BATCH) % 20 === 0) process.stdout.write(`      staging ${Math.min(i + STAGING_BATCH, pairs.length)}/${pairs.length}\r`);
  }
  const linked = await prisma.$executeRawUnsafe(
    'UPDATE customer_master c JOIN _org_backfill s ON s.customer_id = c.customer_id SET c.org_id = s.org_id WHERE c.org_id IS NULL'
  );
  await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS _org_backfill');
  console.log(`      ✔ customer_master.org_id enlazados: ${linked}`);

  // ── Resumen final ──
  // El CIF se normaliza ANTES de agrupar, y el join contra organizations es por
  // igualdad (usa la UK de tax_id). Un OR en el ON impediría el índice (escaneo 26k×196k).
  const [{ orgsTotal, withOrg, multiSinOrg }] = await prisma.$queryRaw<
    Array<{ orgsTotal: number | bigint; withOrg: number | bigint; multiSinOrg: number | bigint }>
  >`
    SELECT
      (SELECT COUNT(*) FROM organizations) AS orgsTotal,
      (SELECT COUNT(*) FROM customer_master WHERE org_id IS NOT NULL) AS withOrg,
      (SELECT COUNT(*) FROM (
         SELECT CASE WHEN cm.tax_id REGEXP '^ES[0-9A-Z]{9}$' THEN SUBSTRING(cm.tax_id, 3) ELSE cm.tax_id END AS norm
         FROM customer_master cm WHERE cm.tax_id IS NOT NULL
         GROUP BY norm HAVING COUNT(*) > 1
       ) t LEFT JOIN organizations o ON o.tax_id = t.norm
       WHERE o.org_id IS NULL) AS multiSinOrg`;
  console.log(`\n   ✔ Total organizaciones: ${orgsTotal} · clientes enlazados: ${withOrg} · CIFs multi-registro sin org: ${multiSinOrg}`);
}

if (require.main === module) {
  backfillOrganizations()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
