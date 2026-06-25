/**
 * Seed: CONTACTS desde clientesTotales0XXX-validated.xlsx (originales 71 cols).
 *
 * Política:
 *   1. Matching estricto: por KUNNR (sap_customer_code) → por NAME1 (legal_name UPPER+TRIM).
 *      Si ninguno, descarta. NO se crean customers stub.
 *   2. Dedupe por (customer_id, email): si la misma persona aparece varias veces para
 *      el mismo cliente, mantenemos el registro con MÁS campos no-null.
 *   3. Normalización de formato (lib/normalize.ts):
 *      - full_name, first_name, last_name → Title Case (sin título)
 *      - email → lowercase + trim
 *      - phone, mobile → libphonenumber-js (formato internacional, ES por defecto)
 *      - postal_code → 5 dígitos con padding
 *
 * Garantía UK: la tabla CONTACTS tiene UNIQUE (customer_id, email).
 */

import { prisma, SEED_AUDIT } from './lib/prisma';
import * as XLSX from 'xlsx';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  cleanStr,
  normalizePersonName,
  normalizeEmail,
  normalizePhone,
  normalizePostalCode,
} from './lib/normalize';

const DATA_DIR = resolve(__dirname, '../../../data/raw/CONTACTOS CRM');
const BATCH_SIZE = 1000;

const COL = {
  kunnr:       'ZTUEV_CONTACT_PERSON_STRUC-KUNNR',
  name1:       'BAPIBUS1006_CENTRAL_ORGAN-NAME1',
  title:       'ZTUEV_CONTACT_PERSON_STRUC-TITLE',
  firstName:   'BAPIBUS1006_CENTRAL_PERSON-FIRSTNAME',
  secondName:  'BAPIBUS1006_CENTRAL_PERSON-SECONDNAME',
  fullName:    'BAPIBUS1006_CENTRAL_PERSON-FULLNAME',
  position:    'ZTUEV_CONTACT_PERSON_STRUC-ABTNR_BEZ20',
  phone:       'ZTUEV_CONTACT_PERSON_STRUC-TELNR_LONG',
  mobile:      'ZTUEV_CONTACT_PERSON_STRUC-MOB_NUMBER',
  email:       'ZTUEV_CONTACT_PERSON_STRUC-SMTP_ADDRESS',
  emailValid:  'Email-Validacion',
  postalCode:  'BAPIBUS1006_ADDRESS-POSTL_COD1',
  consentEmail: 'ZTUEV_CONTACT_PERSON_STRUC-CONSENT_EMAIL',
  consentFax:   'ZTUEV_CONTACT_PERSON_STRUC-CONSENT_FAX',
  consentLet:   'ZTUEV_CONTACT_PERSON_STRUC-CONSENT_LET',
  consentTel:   'ZTUEV_CONTACT_PERSON_STRUC-CONSENT_TEL',
  consentSms:   'ZTUEV_CONTACT_PERSON_STRUC-CONSENT_SMS',
} as const;

// Códigos SAP verificados empíricamente contra el prefijo del FULLNAME:
//   1 → "Ms." (mujer), 2 → "Mr." (hombre). 3-5 hipotéticos, sin uso conocido en el dataset.
const TITLE_MAP: Record<string, string> = {
  '1': 'Ms.',
  '2': 'Mr.',
  '3': 'Mrs.',
  '4': 'Dr.',
  '5': 'Prof.',
};

const cleanBool = (v: unknown): boolean | null => {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (s === '') return null;
  return s === 'X' || s === 'Y' || s === 'TRUE' || s === '1';
};

const normalizeName = (s: string): string => s.toUpperCase().trim().replace(/\s+/g, ' ');

type ContactRow = {
  customerId: number;
  entityId: number | null;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  contactPosition: string | null;
  emailValidation: string | null;
  postalCode: string | null;
  consentEmail: boolean | null;
  consentFax: boolean | null;
  consentLetter: boolean | null;
  consentPhone: boolean | null;
  consentSms: boolean | null;
};

/** Cuenta campos no-null/non-empty para puntuar "completitud" del registro. */
function completeness(c: ContactRow): number {
  let s = 0;
  for (const k of Object.keys(c) as (keyof ContactRow)[]) {
    const v = c[k];
    if (v != null && v !== '' && v !== false) s++;
  }
  return s;
}

export async function seedContacts(): Promise<void> {
  console.log('👤 Seed CONTACTS — con dedupe + normalización');

  const allFiles = readdirSync(DATA_DIR).filter(f => /^clientestotales\d+/i.test(f));
  const byEntity = new Map<string, string>();
  for (const f of allFiles) {
    const entityMatch = f.match(/(\d+)/);
    if (!entityMatch) continue;
    const entity = entityMatch[1]!;
    if (f.toLowerCase().includes('-validated')) byEntity.set(entity, f);
    else if (!byEntity.has(entity) || !byEntity.get(entity)!.includes('validated')) byEntity.set(entity, f);
  }
  const files = [...byEntity.values()];
  console.log(`   Ficheros: ${files.join(', ')}`);

  console.log('\n🗺  Cargando mappings desde BD…');
  const customers = await prisma.customerMaster.findMany({
    select: { customerId: true, sapCustomerCode: true, legalName: true },
  });
  const byCode = new Map<string, number>();
  const byNameDB = new Map<string, number>();
  for (const c of customers) {
    if (c.sapCustomerCode) byCode.set(c.sapCustomerCode, c.customerId);
    byNameDB.set(normalizeName(c.legalName), c.customerId);
  }
  console.log(`   ${byCode.size} customers por code, ${byNameDB.size} por nombre`);

  const entities = await prisma.legalEntity.findMany();
  const entityIdByCode = new Map(entities.map(e => [e.sapCode, e.entityId]));

  // Acumulador deduplicado por (customer_id, email) — null emails NO se deduplican entre sí
  const dedupKeyToContact = new Map<string, ContactRow>();
  const contactsWithoutEmail: ContactRow[] = []; // los que no tienen email se insertan tal cual

  const totals = { totalRows: 0, matchedByCode: 0, matchedByName: 0, skippedNoCustomer: 0, skippedNoData: 0 };

  for (const f of files) {
    const entityMatch = f.match(/(\d+)/)!;
    const entitySap = entityMatch[1]!.padStart(4, '0');
    const entityId = entityIdByCode.get(entitySap) ?? null;
    console.log(`\n📂 ${f}  (entity=${entitySap})`);

    const wb = XLSX.readFile(resolve(DATA_DIR, f));
    const sheet = wb.Sheets[wb.SheetNames[0]!]!;
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    console.log(`   ${rows.length} filas leídas`);
    totals.totalRows += rows.length;

    for (const r of rows) {
      const code = cleanStr(r[COL.kunnr]);
      const name1 = cleanStr(r[COL.name1]);
      let customerId: number | undefined;
      if (code) customerId = byCode.get(code);
      if (!customerId && name1) {
        customerId = byNameDB.get(normalizeName(name1));
        if (customerId) totals.matchedByName++;
      } else if (customerId) {
        totals.matchedByCode++;
      }
      if (!customerId) { totals.skippedNoCustomer++; continue; }

      const fullNameRaw = cleanStr(r[COL.fullName]);
      const firstName = normalizePersonName(cleanStr(r[COL.firstName]));
      const lastName = normalizePersonName(cleanStr(r[COL.secondName]));
      const email = normalizeEmail(cleanStr(r[COL.email]));

      if (!fullNameRaw && !firstName && !lastName && !email) { totals.skippedNoData++; continue; }

      const titleRaw = cleanStr(r[COL.title]);
      const title = titleRaw ? TITLE_MAP[String(parseInt(titleRaw, 10))] ?? null : null;
      const fullName = normalizePersonName(fullNameRaw) ?? ([firstName, lastName].filter(Boolean).join(' ') || email!);

      const contactPositionRaw = cleanStr(r[COL.position]);
      const contact: ContactRow = {
        customerId,
        entityId,
        fullName,
        firstName,
        lastName,
        title,
        email,
        phone: normalizePhone(cleanStr(r[COL.phone])),
        mobile: normalizePhone(cleanStr(r[COL.mobile])),
        contactPosition: contactPositionRaw,
        emailValidation: cleanStr(r[COL.emailValid]),
        postalCode: normalizePostalCode(r[COL.postalCode]),
        consentEmail: cleanBool(r[COL.consentEmail]),
        consentFax: cleanBool(r[COL.consentFax]),
        consentLetter: cleanBool(r[COL.consentLet]),
        consentPhone: cleanBool(r[COL.consentTel]),
        consentSms: cleanBool(r[COL.consentSms]),
      };

      // Dedupe: si hay email, key por (customer, email). Si no, va a su lista aparte.
      if (email) {
        const key = `${customerId}|${email}`;
        const prev = dedupKeyToContact.get(key);
        if (!prev || completeness(contact) > completeness(prev)) {
          dedupKeyToContact.set(key, contact);
        }
      } else {
        contactsWithoutEmail.push(contact);
      }
    }
  }

  const allContacts = [...dedupKeyToContact.values(), ...contactsWithoutEmail];
  console.log(`\n📊 Tras dedupe:`);
  console.log(`   ${dedupKeyToContact.size} con email único (customer+email)`);
  console.log(`   ${contactsWithoutEmail.length} sin email (insertados tal cual)`);
  console.log(`   Total a insertar: ${allContacts.length}`);
  console.log(`   Matched por code:   ${totals.matchedByCode}`);
  console.log(`   Matched por nombre: ${totals.matchedByName}`);
  console.log(`   Skipped:            noCustomer=${totals.skippedNoCustomer}  noData=${totals.skippedNoData}`);

  console.log(`\n💾 Insertando en batches de ${BATCH_SIZE}…`);
  let inserted = 0;
  for (let i = 0; i < allContacts.length; i += BATCH_SIZE) {
    const batch = allContacts.slice(i, i + BATCH_SIZE).map(c => ({
      externalGuid: randomUUID(),
      ...c,
      ...SEED_AUDIT,
    }));
    const res = await prisma.contact.createMany({ data: batch, skipDuplicates: true });
    inserted += res.count;
    if ((i / BATCH_SIZE) % 10 === 0) process.stdout.write(`   ${inserted}/${allContacts.length}\r`);
  }
  console.log(`   ${inserted}/${allContacts.length} ✓`);
}

if (require.main === module) {
  seedContacts()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}