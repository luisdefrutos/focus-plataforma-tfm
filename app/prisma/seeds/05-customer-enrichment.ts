/**
 * Seed: enriquece CUSTOMER_MASTER y crea ADDRESSES.
 *
 * Fuente: data/raw/CUSTOMER_LIST/*.XLSX  (7 ficheros).
 *
 * Estrategia de identidad (refactor 2026-05-28):
 *   1. Match primario por `Customer` (sap_customer_code, UK en CUSTOMER_MASTER).
 *   2. Si no existe por SAP code, match secundario por VAT (taxId) — solo si VAT es CIF real.
 *   3. Si no existe por ninguno, se crea un cliente nuevo.
 *
 * Para cada fila del Excel:
 *   - Parsear `legal_name` para extraer status (ACTIVE / BLOCKED_DUP / BLOCKED_UNPAID / BLOCKED_OTHER),
 *     blockReason y supersededBySapCode (cuando el patrón "OK <sap_code>" aparece).
 *   - Limpiar `legal_name` quitando el sufijo "BLOCKED - ...".
 *   - Crear ADDRESS asociada (sin parsing de estado).
 *
 * Idempotente. Si el mismo cliente aparece en varios ficheros, el último wins.
 */

import { prisma, SEED_AUDIT } from './lib/prisma';
import { CustomerStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = resolve(__dirname, '../../../data/raw/CUSTOMER_LIST');
const BATCH_SIZE = 500;

type CustomerListRow = {
  Customer?: string | number;
  Name?: string;
  Name2?: string;
  Name3?: string;
  VAT?: string;
  'Tax 1'?: string;
  Street?: string;
  'House-num'?: string;
  'Street 2'?: string;
  'Street 3'?: string;
  Zip?: string | number;
  'Post Code'?: string | number;
  City?: string;
  District?: string;
  Tel?: string;
  Industry?: string;
};

const cleanStr = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** "Not assigned" y vacío → null. Cualquier otra cadena se conserva tal cual. */
const normalizeTaxId = (raw: string | null): string | null => {
  if (!raw) return null;
  if (raw.trim().toLowerCase() === 'not assigned') return null;
  return raw;
};

const buildFullAddress = (r: CustomerListRow): string | null => {
  const parts = [
    cleanStr(r.Street),
    cleanStr(r['House-num']),
    cleanStr(r['Street 2']),
    cleanStr(r['Street 3']),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
};

const buildLegalName = (r: CustomerListRow): string | null => {
  const parts = [cleanStr(r.Name), cleanStr(r.Name2), cleanStr(r.Name3)].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
};

type ParsedStatus = {
  status: CustomerStatus;
  cleanName: string;
  blockReason: string | null;
  supersededBySapCode: string | null;
};

/**
 * Detecta el patrón "BLOCKED [- separator] <reason> [OK <sap_code>]" en legal_name.
 * Devuelve el nombre limpio y los campos derivados de estado.
 */
function parseBlockedStatus(legalName: string): ParsedStatus {
  // "BLOCKED" en cualquier capitalización; separador opcional (espacio, "-", "–", ":").
  const match = legalName.match(/^(.*?)\s+BLOCKED\b[\s:\-–]*(.*)$/i);
  if (!match) {
    return {
      status: CustomerStatus.ACTIVE,
      cleanName: legalName.trim(),
      blockReason: null,
      supersededBySapCode: null,
    };
  }
  const cleanName = (match[1] ?? '').trim();
  const rest = (match[2] ?? '').trim();

  // Sucesor explícito: "OK <code>" o "ABSORBE <code>" — códigos SAP típicos: 8-12 chars alfanum.
  const supersededMatch = rest.match(/\b(?:OK|ABSORBE)\b[\s:\-–]*([A-Z0-9]{8,12})/i);
  const supersededBySapCode = supersededMatch?.[1] ?? null;

  if (/DUPLICAD|ABSORBE/i.test(rest) || supersededBySapCode) {
    return {
      status: CustomerStatus.BLOCKED_DUP,
      cleanName,
      blockReason: rest || null,
      supersededBySapCode,
    };
  }
  if (/IMPAGAD/i.test(rest)) {
    return {
      status: CustomerStatus.BLOCKED_UNPAID,
      cleanName,
      blockReason: rest,
      supersededBySapCode: null,
    };
  }
  return {
    status: CustomerStatus.BLOCKED_OTHER,
    cleanName,
    blockReason: rest || null,
    supersededBySapCode: null,
  };
}

type Stats = {
  created: number;
  updatedBySap: number;
  updatedByVat: number;
  noName: number;
  noIdentity: number;
  noAddress: number;
  addressesCreated: number;
  blockedActive: number;
  blockedDup: number;
  blockedUnpaid: number;
  blockedOther: number;
};

async function processFile(filename: string, stats: Stats): Promise<void> {
  const path = resolve(DATA_DIR, filename);
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows: CustomerListRow[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
  console.log(`\n📂 ${filename}: ${rows.length} filas`);

  // Pre-lookup masivo: existing customers por sap_customer_code y por taxId
  const sapCodes = rows.map(r => cleanStr(r.Customer)).filter((v): v is string => !!v);
  const vats = rows
    .map(r => normalizeTaxId(cleanStr(r.VAT)))
    .filter((v): v is string => !!v);

  const [existingBySapRows, existingByVatRows] = await Promise.all([
    prisma.customerMaster.findMany({
      where: { sapCustomerCode: { in: sapCodes } },
      select: { customerId: true, sapCustomerCode: true },
    }),
    prisma.customerMaster.findMany({
      where: { taxId: { in: vats }, sapCustomerCode: null },
      select: { customerId: true, taxId: true },
    }),
  ]);

  const existingBySap = new Map(existingBySapRows.map(c => [c.sapCustomerCode!, c.customerId]));
  // Para VAT solo guardamos los que NO tienen sap_customer_code (deduplicar entrada por VAT
  // a un cliente que ya está identificado por SAP code podría romper la UK).
  const existingByVat = new Map(existingByVatRows.map(c => [c.taxId!, c.customerId]));

  type CreatePayload = {
    externalGuid: string;
    sapCustomerCode: string | null;
    taxId: string | null;
    legalName: string;
    industryCode: string | null;
    phone: string | null;
    status: CustomerStatus;
    blockReason: string | null;
    supersededBySapCode: string | null;
    sourceSystem: string;
    etlRunId: bigint;
  };
  type UpdatePayload = {
    customerId: number;
    data: {
      legalName: string;
      sapCustomerCode?: string;
      taxId?: string | null;
      industryCode?: string;
      phone?: string;
      status: CustomerStatus;
      blockReason: string | null;
      supersededBySapCode: string | null;
    };
  };

  const toCreate: CreatePayload[] = [];
  const toUpdate: UpdatePayload[] = [];
  const addressesByKey: Array<{
    sapCode: string | null;
    taxId: string | null;
    data: { fullAddress: string; postalCode: string | null; city: string | null; province: string | null };
  }> = [];

  // Track lo que vamos creando en este fichero para no chocar con la UK
  const sapSeenInFile = new Set<string>();
  const vatSeenInFile = new Set<string>();

  for (const r of rows) {
    const rawLegalName = buildLegalName(r);
    if (!rawLegalName) { stats.noName++; continue; }

    const sapCustomerCode = cleanStr(r.Customer);
    const taxId = normalizeTaxId(cleanStr(r.VAT));

    if (!sapCustomerCode && !taxId) { stats.noIdentity++; continue; }

    const parsed = parseBlockedStatus(rawLegalName);
    const legalName = parsed.cleanName || rawLegalName;
    const industryCode = cleanStr(r.Industry);
    const phone = cleanStr(r.Tel);

    // Decisión de match
    let existingId: number | undefined;
    let matchedByVat = false;
    if (sapCustomerCode && existingBySap.has(sapCustomerCode)) {
      existingId = existingBySap.get(sapCustomerCode);
    } else if (taxId && existingByVat.has(taxId)) {
      existingId = existingByVat.get(taxId);
      matchedByVat = true;
    }

    if (existingId !== undefined) {
      toUpdate.push({
        customerId: existingId,
        data: {
          legalName,
          ...(sapCustomerCode ? { sapCustomerCode } : {}),
          taxId, // pasar siempre — null limpia "Not assigned" de cargas previas
          ...(industryCode ? { industryCode } : {}),
          ...(phone ? { phone } : {}),
          status: parsed.status,
          blockReason: parsed.blockReason,
          supersededBySapCode: parsed.supersededBySapCode,
        },
      });
      if (matchedByVat) stats.updatedByVat++;
      else stats.updatedBySap++;
    } else {
      // Crear nuevo — proteger contra duplicados intra-fichero
      if (sapCustomerCode && sapSeenInFile.has(sapCustomerCode)) continue;
      if (!sapCustomerCode && taxId && vatSeenInFile.has(taxId)) continue;

      toCreate.push({
        externalGuid: randomUUID(),
        sapCustomerCode,
        taxId,
        legalName,
        industryCode,
        phone,
        status: parsed.status,
        blockReason: parsed.blockReason,
        supersededBySapCode: parsed.supersededBySapCode,
        ...SEED_AUDIT,
      });
      if (sapCustomerCode) sapSeenInFile.add(sapCustomerCode);
      if (taxId) vatSeenInFile.add(taxId);
      stats.created++;
    }

    // Acumular contador por estado
    switch (parsed.status) {
      case CustomerStatus.ACTIVE: stats.blockedActive++; break;
      case CustomerStatus.BLOCKED_DUP: stats.blockedDup++; break;
      case CustomerStatus.BLOCKED_UNPAID: stats.blockedUnpaid++; break;
      case CustomerStatus.BLOCKED_OTHER: stats.blockedOther++; break;
    }

    const fullAddress = buildFullAddress(r);
    if (fullAddress) {
      addressesByKey.push({
        sapCode: sapCustomerCode,
        taxId,
        data: {
          fullAddress,
          postalCode: cleanStr(r.Zip) ?? cleanStr(r['Post Code']),
          city: cleanStr(r.City),
          province: cleanStr(r.District),
        },
      });
    } else {
      stats.noAddress++;
    }
  }

  // 1) Bulk create new customers
  if (toCreate.length > 0) {
    console.log(`   📥 Creando ${toCreate.length} clientes nuevos…`);
    for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
      await prisma.customerMaster.createMany({
        data: toCreate.slice(i, i + BATCH_SIZE),
        skipDuplicates: true,
      });
    }
  }

  // 2) Update existing customers (uno por uno — Prisma no soporta updateMany con datos distintos)
  if (toUpdate.length > 0) {
    console.log(`   🔄 Actualizando ${toUpdate.length} clientes…`);
    for (const { customerId, data } of toUpdate) {
      await prisma.customerMaster.update({ where: { customerId }, data });
    }
  }

  // 3) Refrescar mapping para resolver customerId de cada addr
  const sapCodesAfter = [...sapSeenInFile];
  const vatsAfter = [...vatSeenInFile];
  const [bySapAfter, byVatAfter] = await Promise.all([
    sapCodesAfter.length
      ? prisma.customerMaster.findMany({
          where: { sapCustomerCode: { in: sapCodesAfter } },
          select: { customerId: true, sapCustomerCode: true },
        })
      : Promise.resolve([]),
    vatsAfter.length
      ? prisma.customerMaster.findMany({
          where: { taxId: { in: vatsAfter } },
          select: { customerId: true, taxId: true },
        })
      : Promise.resolve([]),
  ]);
  // Merge con los lookups iniciales (que ya cubren updates)
  const sapToId = new Map([
    ...existingBySap,
    ...bySapAfter.map((c): [string, number] => [c.sapCustomerCode!, c.customerId]),
  ]);
  const vatToId = new Map([
    ...existingByVat,
    ...byVatAfter.map((c): [string, number] => [c.taxId!, c.customerId]),
  ]);

  // 4) Bulk insert addresses
  if (addressesByKey.length > 0) {
    console.log(`   🏠 Creando ${addressesByKey.length} direcciones…`);
    const addressRecords = addressesByKey
      .map(({ sapCode, taxId, data }) => {
        const customerId =
          (sapCode ? sapToId.get(sapCode) : undefined) ??
          (taxId ? vatToId.get(taxId) : undefined);
        if (!customerId) return null;
        return {
          externalGuid: randomUUID(),
          customerId,
          ...data,
          ...SEED_AUDIT,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    for (let i = 0; i < addressRecords.length; i += BATCH_SIZE) {
      const res = await prisma.address.createMany({
        data: addressRecords.slice(i, i + BATCH_SIZE),
        skipDuplicates: true,
      });
      stats.addressesCreated += res.count;
    }
  }
}

export async function seedCustomerEnrichment(): Promise<void> {
  const files = readdirSync(DATA_DIR)
    .filter(f => f.toUpperCase().endsWith('.XLSX'))
    .sort();
  console.log(`👥 Seed CUSTOMER_LIST — ${files.length} ficheros`);

  const stats: Stats = {
    created: 0,
    updatedBySap: 0,
    updatedByVat: 0,
    noName: 0,
    noIdentity: 0,
    noAddress: 0,
    addressesCreated: 0,
    blockedActive: 0,
    blockedDup: 0,
    blockedUnpaid: 0,
    blockedOther: 0,
  };

  for (const f of files) {
    await processFile(f, stats);
  }

  console.log(`\n✔ Totales:`);
  console.log(`   Clientes nuevos creados:           ${stats.created}`);
  console.log(`   Updates por sap_customer_code:     ${stats.updatedBySap}`);
  console.log(`   Updates por VAT (fallback):        ${stats.updatedByVat}`);
  console.log(`   Direcciones creadas:               ${stats.addressesCreated}`);
  console.log(`   Saltados: noName=${stats.noName}, noIdentity=${stats.noIdentity}, noAddress=${stats.noAddress}`);
  console.log(`   Estados parseados:`);
  console.log(`     ACTIVE:         ${stats.blockedActive}`);
  console.log(`     BLOCKED_DUP:    ${stats.blockedDup}`);
  console.log(`     BLOCKED_UNPAID: ${stats.blockedUnpaid}`);
  console.log(`     BLOCKED_OTHER:  ${stats.blockedOther}`);
}

if (require.main === module) {
  seedCustomerEnrichment()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
