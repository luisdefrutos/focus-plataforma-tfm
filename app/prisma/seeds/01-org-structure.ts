/**
 * Seed: LEGAL_ENTITIES + DIVISIONS + BUSINESS_UNITS (estructura organizativa).
 *
 * Fuente única: data/raw/Profit centers.xls (MHTML SAP export).
 * Crea 4 entidades legales operativas, 5 divisiones y ~32 instancias empresa×BU.
 *
 * Idempotente: usa upsert por sap_code / division_code / (entity_id+bu_code).
 */

import { prisma, SEED_AUDIT } from './lib/prisma';
import { parseProfitCenters, type ProfitCenterRow } from './lib/parse-profit-centers';
import { resolve } from 'node:path';

// Sociedades EXCLUIDAS del modelo (además de K999, que descarta el parser):
//   0359 Swissi España · 0442 CTVA Ingeniería — solo existen por histórico de
//   facturación en SAP, que NO está cargado en Focus (0 facturas aquí). Se excluyen
//   para que no aparezcan como whitespots ni en los filtros (decisión 2026-06-10).
//   Si algún día se carga su histórico, basta quitarlas de aquí y re-seedear.
const EXCLUDED_COMPANIES = new Set(['0359', '0442']);

// Nombres legibles para las 5 divisiones SAP (hipótesis razonable; ajustable luego con UPDATE)
const DIVISION_NAMES: Record<string, string> = {
  II: 'Industrial Inspection',
  MO: 'Mobility',
  NON: 'Non-Group / Others',
  BA: 'Business Assurance',
  PS: 'Product Service',
};

/** El SAP export trae cosas como "NON - Rest"; nos quedamos con el primer token (NON, II, MO…). */
const normalizeDivisionCode = (raw: string): string => raw.split(/[\s-]+/, 1)[0]!.trim();

export async function seedOrgStructure(): Promise<void> {
  const profitCentersPath = resolve(__dirname, '../../../data/raw/Profit centers.xls');
  console.log(`📂 Leyendo ${profitCentersPath}…`);
  const allRows = parseProfitCenters(profitCentersPath);
  const rows = allRows.filter(r => !EXCLUDED_COMPANIES.has(r.companyCode));
  console.log(`   ${rows.length} profit centers operativos leídos (K999 excluida; ${allRows.length - rows.length} de sociedades históricas ${[...EXCLUDED_COMPANIES].join('/')} descartados).`);

  // Auto-saneamiento: si las sociedades excluidas existen de una carga anterior, se retiran
  // de BD (asignaciones IAM → BUs → entidad). Guarda de seguridad: si tuvieran facturación,
  // NO se borran (se avisa para revisarlo a mano). Idempotente: en BD ya limpia no hace nada.
  for (const sap of EXCLUDED_COMPANIES) {
    const ent = await prisma.legalEntity.findUnique({
      where: { sapCode: sap },
      include: { businessUnits: { select: { buId: true } } },
    });
    if (!ent) continue;
    const buIds = ent.businessUnits.map(b => b.buId);
    const billed = buIds.length > 0
      ? await prisma.billingRecord.count({ where: { buId: { in: buIds } } })
      : 0;
    if (billed > 0) {
      console.warn(`   ⚠ ${sap} tiene ${billed} facturas cargadas — NO se elimina. Revisar a mano.`);
      continue;
    }
    if (buIds.length > 0) {
      await prisma.appUserRole.deleteMany({ where: { buId: { in: buIds } } });
      await prisma.businessUnit.deleteMany({ where: { buId: { in: buIds } } });
    }
    await prisma.legalEntity.delete({ where: { entityId: ent.entityId } });
    console.log(`   🗑 Sociedad histórica ${sap} retirada de BD (${buIds.length} BUs).`);
  }

  // ───── 1) LEGAL_ENTITIES ─────
  const entitiesMap = new Map<string, ProfitCenterRow>();
  for (const r of rows) if (!entitiesMap.has(r.companyCode)) entitiesMap.set(r.companyCode, r);

  console.log(`\n🏢 Cargando ${entitiesMap.size} LEGAL_ENTITIES…`);
  for (const [sap_code, r] of entitiesMap) {
    await prisma.legalEntity.upsert({
      where: { sapCode: sap_code },
      update: {
        legalName: r.companyName,
        countryCode: r.countryCode,
        countryName: r.countryName,
      },
      create: {
        sapCode: sap_code,
        legalName: r.companyName,
        countryCode: r.countryCode,
        countryName: r.countryName,
        ...SEED_AUDIT,
      },
    });
    console.log(`   ✔ ${sap_code}  ${r.companyName}`);
  }

  // ───── 2) DIVISIONS ─────
  const divisionCodes = new Set(rows.map(r => normalizeDivisionCode(r.divisionCode)));
  console.log(`\n🏷  Cargando ${divisionCodes.size} DIVISIONS…`);
  for (const code of divisionCodes) {
    const name = DIVISION_NAMES[code] ?? code;
    await prisma.division.upsert({
      where: { divisionCode: code },
      update: { divisionName: name },
      create: { divisionCode: code, divisionName: name },
    });
    console.log(`   ✔ ${code}  ${name}`);
  }

  // ───── 3) BUSINESS_UNITS (instancia empresa × BU funcional) ─────
  // Una fila por combinación (entity, bu_name). Tomamos bu_code de la business_line "principal"
  // (la primera que aparece). En la doc futura podremos refinar este criterio.
  console.log(`\n🧩 Cargando BUSINESS_UNITS (instancias empresa × BU)…`);
  const buInstances = new Map<string, ProfitCenterRow>(); // key = `${company}|${bu_name}`
  for (const r of rows) {
    const key = `${r.companyCode}|${r.businessUnit}`;
    if (!buInstances.has(key)) buInstances.set(key, r);
  }

  const entitiesByCode = await prisma.legalEntity.findMany();
  const entityIdByCode = new Map(entitiesByCode.map(e => [e.sapCode, e.entityId]));
  const divisionsByCode = await prisma.division.findMany();
  const divisionIdByCode = new Map(divisionsByCode.map(d => [d.divisionCode, d.divisionId]));

  let created = 0;
  for (const [key, r] of buInstances) {
    const entityId = entityIdByCode.get(r.companyCode);
    const divisionId = divisionIdByCode.get(normalizeDivisionCode(r.divisionCode));
    if (!entityId || !divisionId) {
      console.warn(`   ⚠ saltando ${key}: entity/division no encontrada`);
      continue;
    }
    // bu_code: tomamos la business_line (más específica que solo el código de división)
    const buCode = r.businessLine;

    await prisma.businessUnit.upsert({
      where: { uk_bu_entity_code: { entityId, buCode } },
      update: { buName: r.businessUnit, divisionId },
      create: {
        entityId,
        divisionId,
        buCode,
        buName: r.businessUnit,
        ...SEED_AUDIT,
      },
    });
    created++;
  }
  console.log(`   ✔ ${created} business units cargadas`);
}

if (require.main === module) {
  seedOrgStructure()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}