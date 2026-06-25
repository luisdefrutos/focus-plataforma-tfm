/**
 * Motor genérico de carga de extractos de inspecciones (ASSETS + INSPECTIONS + ORGANIZATIONS).
 *
 * Todos los extractos comparten el mismo formato: cabecera jerárquica de 3 niveles
 * (bloques INSPECCION / EMPLAZAMIENTO-INSTALACIÓN / GESTOR / TITULAR), nombres de campo
 * reales en la fila índice 2 y datos desde la fila 3. Lo que cambia entre fuentes es el
 * mapa de columnas, el tipo de activo, la sociedad ejecutora, la unidad del plazo y la
 * estrategia de identidad del activo — todo ello parametrizado en InspectionSourceConfig.
 *
 * Identidad del activo:
 *   - REG_CODE: registro reglamentario (RAE en ascensores) + provincia.
 *   - HASH: las fuentes sin registro (AT/BT/GESAP) usan un hash determinista de
 *     (tipo + emplazamiento + instalación + dirección + CP) como reg_code sintético
 *     (reg_code_kind='HASH'), conservando la idempotencia del skipDuplicates; los
 *     nombres crudos se guardan en `attributes` JSON para trazabilidad.
 *
 * Plazo de próxima inspección:
 *   - 'years': el extracto lo trae en años (AS, 1-10) → ×12.
 *   - 'auto': unidad MIXTA dentro del mismo fichero (GESAP trae 36/72/144 meses y 1/2/5
 *     años). Regla validada contra las fechas reales (mediana de días por unidad):
 *     valor ≤ 10 → años (×12) · valor ≥ 12 → ya son meses.
 *
 * Carga HÍBRIDA (igual que el seed original de ascensores): las partes se guardan en
 * crudo (*_tax_id/_sap_code/_name) Y por FK a Organization resuelta por CIF.
 */

import { prisma } from './prisma';
import * as XLSX from 'xlsx';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const RAW_DIR = resolve(__dirname, '../../../../data/raw');
export const DATA_START_INDEX = 3;
const BATCH_SIZE = 1000;

// ───────── configuración por fuente ─────────

/** Sub-bloque CONTACTO de una parte (gestor o titular) — lo consume el seed 12. */
export type ContactCols = {
  tel: number; email: number; nombre: number; apellidos: number;
  tel1: number; email1: number; mobile?: number; fax?: number;
};

export type InspectionSourceConfig = {
  /** Clave corta para CLI/logs ('AS', 'AT', 'BT', 'GESAP_TSA', 'GESAP_TSI'). */
  key: string;
  label: string;
  /** Nombre del fichero dentro de data/raw. */
  file: string;
  sourceSystem: string;
  assetType: { code: string; name: string; regKind: string; regulated: boolean };
  /** sap_codes admitidos de la sociedad ejecutora (p.ej. ['0135','135']). */
  entitySapCodes: string[];
  plazoUnit: 'years' | 'auto';
  /** Identidad del activo: registro reglamentario (columna) o hash sintético. */
  assetKeyStrategy: { kind: 'REG_CODE'; col: number } | { kind: 'HASH' };
  cols: {
    cod: number; fIns: number; fProx: number; plazo: number;
    /** Nombre del emplazamiento (no existe en AS). */
    emplName?: number;
    instName: number; instAddr: number; instCp: number; instCity: number; instProv: number;
    offer: number; subject: number; orders: number;
    gSap: number; gCif: number; gName: number;
    tSap: number; tCif: number; tName: number;
    contact: { g: ContactCols; t: ContactCols };
  };
};

/**
 * Registro de fuentes. Validado contra los extractos reales (junio 2026):
 * layout de 40 columnas idéntico en AT/BT/GESAP_*; AS tiene bloques más anchos
 * (mobile/fax) y la columna RAE. Sociedades confirmadas cruzando los números de
 * factura con BILLING_RECORDS (AT/BT/TSA → 0135 · TSI → 0158).
 */
export const INSPECTION_SOURCES: InspectionSourceConfig[] = [
  {
    key: 'AS',
    label: 'Ascensores',
    file: 'Inspecciones_AS.xlsx',
    sourceSystem: 'INSPECCIONES_AS',
    assetType: { code: 'ASCENSOR', name: 'Ascensor / Aparato elevador', regKind: 'RAE', regulated: true },
    entitySapCodes: ['0135', '135'],
    plazoUnit: 'years',
    assetKeyStrategy: { kind: 'REG_CODE', col: 4 },
    cols: {
      cod: 0, fIns: 1, fProx: 2, plazo: 3,
      instName: 5, instAddr: 6, instCp: 7, instCity: 8, instProv: 9,
      offer: 10, subject: 11, orders: 12,
      gSap: 13, gCif: 14, gName: 15,
      tSap: 28, tCif: 29, tName: 30,
      contact: {
        g: { tel: 20, email: 21, nombre: 22, apellidos: 23, tel1: 24, mobile: 25, fax: 26, email1: 27 },
        t: { tel: 35, email: 36, nombre: 37, apellidos: 38, tel1: 39, mobile: 40, fax: 41, email1: 42 },
      },
    },
  },
  {
    key: 'AT',
    label: 'Alta tensión',
    file: 'Inspecciones_AT.xlsx',
    sourceSystem: 'INSPECCIONES_AT',
    assetType: { code: 'ALTA_TENSION', name: 'Instalación eléctrica de alta tensión', regKind: 'HASH', regulated: true },
    entitySapCodes: ['0135', '135'],
    plazoUnit: 'auto',
    assetKeyStrategy: { kind: 'HASH' },
    cols: {
      cod: 0, fIns: 1, fProx: 2, plazo: 3,
      emplName: 4, instName: 5, instAddr: 6, instCp: 7, instCity: 8, instProv: 9,
      offer: 10, subject: 11, orders: 12,
      gSap: 13, gCif: 14, gName: 15,
      tSap: 26, tCif: 27, tName: 28,
      contact: {
        g: { tel: 20, email: 21, nombre: 22, apellidos: 23, tel1: 24, email1: 25 },
        t: { tel: 33, email: 34, nombre: 35, apellidos: 36, tel1: 37, email1: 38 },
      },
    },
  },
  {
    key: 'BT',
    label: 'Baja tensión',
    file: 'Inspecciones_BT.xlsx',
    sourceSystem: 'INSPECCIONES_BT',
    assetType: { code: 'BAJA_TENSION', name: 'Instalación eléctrica de baja tensión', regKind: 'HASH', regulated: true },
    entitySapCodes: ['0135', '135'],
    plazoUnit: 'auto',
    assetKeyStrategy: { kind: 'HASH' },
    cols: {
      cod: 0, fIns: 1, fProx: 2, plazo: 3,
      emplName: 4, instName: 5, instAddr: 6, instCp: 7, instCity: 8, instProv: 9,
      offer: 10, subject: 11, orders: 12,
      gSap: 13, gCif: 14, gName: 15,
      tSap: 26, tCif: 27, tName: 28,
      contact: {
        g: { tel: 20, email: 21, nombre: 22, apellidos: 23, tel1: 24, email1: 25 },
        t: { tel: 33, email: 34, nombre: 35, apellidos: 36, tel1: 37, email1: 38 },
      },
    },
  },
  {
    key: 'GESAP_TSA',
    label: 'GESAP equipos a presión (ATISAE)',
    file: 'Inspecciones_GESAP_TSA.xlsx',
    sourceSystem: 'GESAP_TSA',
    assetType: { code: 'GESAP', name: 'GESAP (equipos a presión)', regKind: 'HASH', regulated: true },
    entitySapCodes: ['0135', '135'],
    plazoUnit: 'auto',
    assetKeyStrategy: { kind: 'HASH' },
    cols: {
      cod: 0, fIns: 1, fProx: 2, plazo: 3,
      emplName: 4, instName: 5, instAddr: 6, instCp: 7, instCity: 8, instProv: 9,
      offer: 10, subject: 11, orders: 12,
      gSap: 13, gCif: 14, gName: 15,
      tSap: 26, tCif: 27, tName: 28,
      contact: {
        g: { tel: 20, email: 21, nombre: 22, apellidos: 23, tel1: 24, email1: 25 },
        t: { tel: 33, email: 34, nombre: 35, apellidos: 36, tel1: 37, email1: 38 },
      },
    },
  },
  {
    key: 'GESAP_TSI',
    label: 'GESAP equipos a presión (TÜV SÜD Iberia)',
    file: 'Inspecciones_GESAP_TSI.xlsx',
    sourceSystem: 'GESAP_TSI',
    assetType: { code: 'GESAP', name: 'GESAP (equipos a presión)', regKind: 'HASH', regulated: true },
    entitySapCodes: ['0158', '158'],
    plazoUnit: 'auto',
    assetKeyStrategy: { kind: 'HASH' },
    cols: {
      cod: 0, fIns: 1, fProx: 2, plazo: 3,
      emplName: 4, instName: 5, instAddr: 6, instCp: 7, instCity: 8, instProv: 9,
      offer: 10, subject: 11, orders: 12,
      gSap: 13, gCif: 14, gName: 15,
      tSap: 26, tCif: 27, tName: 28,
      contact: {
        g: { tel: 20, email: 21, nombre: 22, apellidos: 23, tel1: 24, email1: 25 },
        t: { tel: 33, email: 34, nombre: 35, apellidos: 36, tel1: 37, email1: 38 },
      },
    },
  },
];

export const sourceByKey = (key: string): InspectionSourceConfig | undefined =>
  INSPECTION_SOURCES.find(s => s.key.toUpperCase() === key.toUpperCase());

// ───────── helpers compartidos ─────────

export function cleanStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

/** CIF/NIF normalizado (mayúsculas, sin separadores, sin prefijo país ES). */
export function normCif(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  let c = s.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (/^ES[0-9A-Z]{9}$/.test(c)) c = c.slice(2);
  return c || null;
}

/** Serial Excel → Date, descartando fechas fuera de rango (los extractos traen corruptas, p.ej. año 2211). */
export function excelDate(v: unknown, minY = 2000, maxY = 2100): Date | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date((n - 25569) * 86400 * 1000);
  const y = d.getUTCFullYear();
  return y < minY || y > maxY ? null : d;
}

/** NUM_ORDENES/NUM_FACTURAS llega como ";6464356367" y a veces multivalor → primer documento numérico. */
export function firstDoc(v: unknown): string | null {
  if (v == null) return null;
  const parts = String(v).split(/[;,\s]+/).map((x) => x.replace(/\D/g, '')).filter(Boolean);
  return parts[0] ?? null;
}

export function onlyDigits(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  return s.replace(/\D/g, '') || null;
}

/** Tipo de organización inferido del nombre/CIF (para segmentación posterior). */
export function inferOrgType(name: string | null, cif: string | null): string {
  const n = (name ?? '').toUpperCase();
  if (/C\.?\s?P\.?|COMUNIDAD|PROPIETARIOS|MANCOMUNIDAD/.test(n)) return 'COMUNIDAD_PROPIETARIOS';
  if (/ADMON|ADMINISTRAC|FINCAS/.test(n)) return 'ADMIN_FINCAS';
  if (cif && /^[0-9]{8}[A-Z]$/.test(cif)) return 'PERSONA_FISICA';
  if (cif && /^[XYZ][0-9]{7}[A-Z]$/.test(cif)) return 'PERSONA_FISICA';
  return 'EMPRESA';
}

/** PLAZO según la unidad de la fuente → meses (null si no es razonable). */
export function periodMonths(v: unknown, unit: 'years' | 'auto'): number | null {
  const n = typeof v === 'number' ? v : Number(cleanStr(v));
  if (!Number.isInteger(n) || n < 1) return null;
  if (unit === 'years') return n > 10 ? null : n * 12;
  // 'auto': ≤10 son años (validado: medianas ~365 días/unidad); ≥12 ya son meses (~30 días/unidad).
  if (n <= 10) return n * 12;
  return n > 240 ? null : n;
}

/** Componente normalizado para la clave sintética del activo. */
const hashPart = (v: string | null): string => (v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

/** reg_code sintético determinista para activos sin registro reglamentario. */
export function syntheticRegCode(typeCode: string, empl: string | null, inst: string | null, addr: string | null, cp: string | null): string | null {
  if (!empl && !inst && !addr) return null; // nada que identifique el activo
  const key = [typeCode, hashPart(empl), hashPart(inst), hashPart(addr), hashPart(cp)].join('|');
  return createHash('sha1').update(key, 'utf8').digest('hex').slice(0, 16).toUpperCase();
}

async function bulkInsert<T>(label: string, rows: T[], create: (batch: T[]) => Promise<{ count: number }>): Promise<number> {
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const res = await create(rows.slice(i, i + BATCH_SIZE));
    done += res.count;
    if ((i / BATCH_SIZE) % 10 === 0) process.stdout.write(`      ${label}: ${done}/${rows.length}\r`);
  }
  console.log(`      ${label}: ${done}/${rows.length} insertados ✓`);
  return done;
}

/** Lee la matriz cruda de un extracto (fila 2 = nombres de campo; datos desde la fila 3). */
export function readSourceMatrix(cfg: InspectionSourceConfig): (string | number | null)[][] {
  const wb = XLSX.readFile(resolve(RAW_DIR, cfg.file), { cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as (string | number | null)[][];
}

// ───────── motor de carga ─────────

export async function loadInspectionSource(cfg: InspectionSourceConfig, limit = Infinity): Promise<void> {
  const AUDIT = { sourceSystem: cfg.sourceSystem, etlRunId: BigInt(Date.now()) };
  console.log(`\n🔧 Seed INSPECCIONES — ${cfg.label} (${cfg.key})`);
  console.log(`   Fuente: ${resolve(RAW_DIR, cfg.file)}${Number.isFinite(limit) ? `  (LIMIT ${limit})` : ''}`);

  // 1) AssetType (catálogo)
  const assetType = await prisma.assetType.upsert({
    where: { typeCode: cfg.assetType.code },
    update: { typeName: cfg.assetType.name, regCodeKind: cfg.assetType.regKind, isRegulated: cfg.assetType.regulated },
    create: { typeCode: cfg.assetType.code, typeName: cfg.assetType.name, regCodeKind: cfg.assetType.regKind, isRegulated: cfg.assetType.regulated },
  });

  // 2) LegalEntity ejecutora
  const entity = await prisma.legalEntity.findFirst({ where: { sapCode: { in: cfg.entitySapCodes } } });
  const legalEntityId = entity?.entityId ?? null;
  console.log(`   AssetType=${assetType.assetTypeId} (${cfg.assetType.code})  Sociedad ${cfg.entitySapCodes[0]} entityId=${legalEntityId ?? '∅'}`);

  // 3) leer Excel
  const matrix = readSourceMatrix(cfg);
  console.log(`   ${matrix.length} filas crudas; datos desde la fila ${DATA_START_INDEX}.`);

  // 4) acumular en memoria (dedup)
  const C = cfg.cols;
  const orgs = new Map<string, { name: string; type: string }>();
  type AssetAcc = {
    regCode: string; province: string | null; name: string | null; addr: string | null; cp: string | null; city: string | null;
    ownerTaxId: string | null; ownerSap: string | null; ownerName: string | null; attributes: Record<string, string> | null;
  };
  const assets = new Map<string, AssetAcc>();
  type InspAcc = { cod: string; assetKey: string | null; fIns: Date | null; fProx: Date | null; months: number | null; mCif: string | null; mSap: string | null; mName: string | null; offer: string | null; subject: string | null; order: string | null };
  const insps: InspAcc[] = [];

  let skippedNoCod = 0;
  for (let i = DATA_START_INDEX; i < matrix.length && insps.length < limit; i++) {
    const r = matrix[i];
    if (!r) continue;
    const cod = cleanStr(r[C.cod]);
    if (!cod) { skippedNoCod++; continue; }

    const gCif = normCif(r[C.gCif]);
    const tCif = normCif(r[C.tCif]);
    const gName = cleanStr(r[C.gName]);
    const tName = cleanStr(r[C.tName]);

    if (gCif && !orgs.has(gCif)) orgs.set(gCif, { name: gName ?? gCif, type: inferOrgType(gName, gCif) });
    if (tCif && !orgs.has(tCif)) orgs.set(tCif, { name: tName ?? tCif, type: inferOrgType(tName, tCif) });

    // Identidad del activo según estrategia
    const province = cleanStr(r[C.instProv]);
    const instName = cleanStr(r[C.instName]);
    const emplName = C.emplName != null ? cleanStr(r[C.emplName]) : null;
    const addr = cleanStr(r[C.instAddr]);
    const cp = cleanStr(r[C.instCp]);

    let regCode: string | null = null;
    let attributes: Record<string, string> | null = null;
    if (cfg.assetKeyStrategy.kind === 'REG_CODE') {
      regCode = cleanStr(r[cfg.assetKeyStrategy.col]);
    } else {
      regCode = syntheticRegCode(cfg.assetType.code, emplName, instName, addr, cp);
      if (regCode) {
        attributes = {};
        if (emplName) attributes.emplazamiento = emplName;
        if (instName) attributes.instalacion = instName;
      }
    }

    let assetKey: string | null = null;
    if (regCode) {
      assetKey = `${regCode}|${province ?? ''}`;
      if (!assets.has(assetKey)) {
        assets.set(assetKey, {
          regCode, province,
          name: instName ?? emplName, addr, cp, city: cleanStr(r[C.instCity]),
          ownerTaxId: tCif, ownerSap: cleanStr(r[C.tSap]), ownerName: tName,
          attributes,
        });
      }
    }

    insps.push({
      cod, assetKey,
      fIns: excelDate(r[C.fIns]), fProx: excelDate(r[C.fProx]),
      months: periodMonths(r[C.plazo], cfg.plazoUnit),
      mCif: gCif, mSap: cleanStr(r[C.gSap]), mName: gName,
      offer: onlyDigits(r[C.offer]), subject: onlyDigits(r[C.subject]), order: firstDoc(r[C.orders]),
    });
  }
  console.log(`   Acumulado → orgs:${orgs.size}  assets:${assets.size}  inspecciones:${insps.length}  (sin código: ${skippedNoCod})`);

  // 5) ORGANIZATIONS
  const orgArr = [...orgs].map(([taxId, d]) => ({ externalGuid: randomUUID(), taxId, legalName: d.name.slice(0, 255), orgType: d.type, ...AUDIT }));
  await bulkInsert('organizations', orgArr, (b) => prisma.organization.createMany({ data: b, skipDuplicates: true }));
  const orgRows = await prisma.organization.findMany({ select: { orgId: true, taxId: true } });
  const orgIdByTax = new Map(orgRows.map((o) => [o.taxId, o.orgId]));

  // 6) ASSETS (resolviendo titular → ownerOrgId)
  // Pre-filtramos los ya existentes: la UK (kind, reg_code, province) no salta cuando
  // province es NULL (MySQL admite NULLs repetidos), así que skipDuplicates solo no basta.
  const existingAssets = await prisma.asset.findMany({ where: { assetTypeId: assetType.assetTypeId }, select: { regCode: true, province: true } });
  const existingKeys = new Set(existingAssets.map((a) => `${a.regCode}|${a.province ?? ''}`));
  const assetArr = [...assets.entries()]
    .filter(([key]) => !existingKeys.has(key))
    .map(([, a]) => ({
      externalGuid: randomUUID(),
      assetTypeId: assetType.assetTypeId,
      regCode: a.regCode, regCodeKind: cfg.assetType.regKind,
      assetName: a.name?.slice(0, 255) ?? null,
      fullAddress: a.addr?.slice(0, 500) ?? null,
      postalCode: a.cp?.slice(0, 16) ?? null, city: a.city?.slice(0, 128) ?? null, province: a.province?.slice(0, 128) ?? null,
      ownerOrgId: a.ownerTaxId ? orgIdByTax.get(a.ownerTaxId) ?? null : null,
      ownerTaxId: a.ownerTaxId, ownerSapCode: a.ownerSap, ownerName: a.ownerName?.slice(0, 255) ?? null,
      attributes: a.attributes ?? undefined,
      ...AUDIT,
    }));
  await bulkInsert('assets', assetArr, (b) => prisma.asset.createMany({ data: b, skipDuplicates: true }));
  const assetRows = await prisma.asset.findMany({ where: { assetTypeId: assetType.assetTypeId }, select: { assetId: true, regCode: true, province: true } });
  const assetIdByKey = new Map(assetRows.map((a) => [`${a.regCode}|${a.province ?? ''}`, a.assetId]));

  // 7) INSPECTIONS (resolviendo asset y mantenedor/gestor)
  const inspArr = insps.map((x) => ({
    externalGuid: randomUUID(),
    assetId: x.assetKey ? assetIdByKey.get(x.assetKey) ?? null : null,
    codIndustria: x.cod,
    inspectionType: 'PERIODICA',
    inspectionDate: x.fIns, nextDueDate: x.fProx, periodicityMonths: x.months,
    maintainerOrgId: x.mCif ? orgIdByTax.get(x.mCif) ?? null : null,
    maintainerTaxId: x.mCif, maintainerSapCode: x.mSap, maintainerName: x.mName?.slice(0, 255) ?? null,
    offerNumber: x.offer?.slice(0, 32) ?? null, subjectNumber: x.subject?.slice(0, 32) ?? null, orderNumber: x.order?.slice(0, 32) ?? null,
    legalEntityId,
    ...AUDIT,
  }));
  await bulkInsert('inspections', inspArr, (b) => prisma.inspection.createMany({ data: b, skipDuplicates: true }));

  // 8) resumen
  const [nOrg, nAsset, nInsp] = await Promise.all([prisma.organization.count(), prisma.asset.count(), prisma.inspection.count()]);
  console.log(`   ✔ Totales en BD → ORGANIZATIONS=${nOrg}  ASSETS=${nAsset}  INSPECTIONS=${nInsp}`);
}
