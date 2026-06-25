/**
 * Queries para la ficha de cliente / organización (/clientes/[id]).
 *
 * La ficha trabaja con un CONJUNTO de registros SAP (customer_master):
 *  - vista de ORGANIZACIÓN (por defecto): todos los registros del mismo CIF (org_id).
 *  - vista de REGISTRO suelto (?sap=1 o cliente sin org): un único customer_id.
 * `getEntityContext` resuelve ese conjunto; el resto de queries aceptan `customerIds[]`.
 *
 * RLS: las consultas de facturación aceptan `buIds`:
 *   - `undefined` → sin filtro (admin global)
 *   - `[]`        → sin acceso → no devuelve nada
 *   - `[id, …]`   → restringe a esas BU
 */

import { prisma } from '@/lib/prisma';

/** Cláusula de alcance RLS por BU para añadir a un WHERE ya existente. */
function buScope(buIds: number[] | undefined, alias = 'br'): { sql: string; params: number[] } {
  if (buIds === undefined) return { sql: '', params: [] };
  if (buIds.length === 0) return { sql: ' AND 1 = 0', params: [] };
  return { sql: ` AND ${alias}.bu_id IN (${buIds.map(() => '?').join(',')})`, params: buIds };
}

/** Placeholders `(?,?,…)` para un IN sobre customer_id (nunca vacío → '(NULL)'). */
function idIn(ids: number[]): string {
  return ids.length > 0 ? `(${ids.map(() => '?').join(',')})` : '(NULL)';
}

export type EntityRecord = { customerId: number; sapCustomerCode: string | null; legalName: string };

export type EntityContext = {
  /** true si la ficha agrega varios registros SAP bajo una organización (Golden Record). */
  isOrg: boolean;
  orgId: number | null;
  legalName: string;
  taxId: string;
  industryCode: string | null;
  phone: string | null;
  isBlocked: boolean;
  /** customer_ids que componen la entidad (1 si es registro suelto). */
  customerIds: number[];
  /** Registros SAP individuales (para listarlos en la ficha). */
  records: EntityRecord[];
};

/**
 * Resuelve la entidad a mostrar a partir de un customer_id.
 * Si el registro pertenece a una organización y `forceSap` es false → agrega todos
 * los registros SAP de esa organización. Si no → sólo ese registro.
 */
export async function getEntityContext(customerId: number, forceSap = false): Promise<EntityContext | null> {
  const c = await prisma.customerMaster.findUnique({
    where: { customerId },
    select: {
      customerId: true, orgId: true, legalName: true, taxId: true, sapCustomerCode: true,
      industryCode: true, phone: true,
      org: { select: { orgId: true, legalName: true, taxId: true } },
    },
  });
  if (!c) return null;

  if (!forceSap && c.orgId != null) {
    const recs = await prisma.customerMaster.findMany({
      where: { orgId: c.orgId },
      select: { customerId: true, sapCustomerCode: true, legalName: true, phone: true, industryCode: true },
      orderBy: { customerId: 'asc' },
    });
    return {
      isOrg: true,
      orgId: c.orgId,
      legalName: c.org?.legalName ?? c.legalName,
      taxId: c.org?.taxId ?? c.taxId ?? '',
      industryCode: recs.find(r => r.industryCode)?.industryCode ?? null,
      phone: recs.find(r => r.phone)?.phone ?? null,
      isBlocked: false,
      customerIds: recs.map(r => r.customerId),
      records: recs.map(r => ({ customerId: r.customerId, sapCustomerCode: r.sapCustomerCode, legalName: r.legalName })),
    };
  }

  return {
    isOrg: false,
    orgId: null,
    legalName: c.legalName,
    taxId: c.taxId ?? '',
    industryCode: c.industryCode,
    phone: c.phone,
    isBlocked: c.legalName.includes('BLOCKED') || c.taxId === 'Not assigned',
    customerIds: [c.customerId],
    records: [{ customerId: c.customerId, sapCustomerCode: c.sapCustomerCode, legalName: c.legalName }],
  };
}

export async function getCustomerAddresses(customerIds: number[]) {
  if (customerIds.length === 0) return [];
  return prisma.address.findMany({
    where: { customerId: { in: customerIds } },
    select: { addressId: true, fullAddress: true, postalCode: true, city: true, province: true },
    orderBy: { addressId: 'asc' },
  });
}

/** Contactos CRM (tabla `contacts`) de los registros SAP de la entidad. */
async function getCustomerContacts(customerIds: number[]) {
  if (customerIds.length === 0) return [];
  return prisma.contact.findMany({
    where: { customerId: { in: customerIds } },
    select: {
      contactId: true, fullName: true, title: true, contactPosition: true,
      email: true, phone: true, mobile: true, emailValidation: true,
      consentEmail: true, consentPhone: true,
      entity: { select: { sapCode: true, legalName: true } },
    },
    orderBy: [{ fullName: 'asc' }],
  });
}

/** Contactos del gestor/titular (tabla `organization_contacts`) de la organización. */
async function getOrganizationContacts(orgId: number | null) {
  if (orgId == null) return [];
  return prisma.organizationContact.findMany({
    where: { orgId },
    select: {
      orgContactId: true, role: true, fullName: true,
      email: true, phone: true, mobile: true, fax: true, emailValidation: true,
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  });
}

// ─── Contactos unificados (CRM + gestor/titular) con deduplicación de personas ───

export type ContactSource = 'CRM' | 'GESTOR' | 'TITULAR';

export type UnifiedContact = {
  /** Clave estable para React (id del registro representante). */
  key: string;
  fullName: string;
  title: string | null;
  position: string | null;
  email: string | null;
  /** Email validado (CRM 'Válido' / inspecciones 'VALIDO' = dominio B2B propio). */
  emailVerified: boolean;
  phone: string | null;
  mobile: string | null;
  /** Sociedad del grupo desde la que se gestiona (solo contactos CRM). */
  entitySapCode: string | null;
  consentEmail: boolean | null;
  consentPhone: boolean | null;
  /** Orígenes en los que aparece esta persona (CRM / GESTOR / TITULAR). */
  sources: ContactSource[];
  /** Nº de registros crudos unificados bajo esta persona. */
  mergedCount: number;
};

/** Nombre normalizado para comparar personas: sin título, sin acentos, minúsculas, espacios colapsados. */
function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(mr|ms|mrs|sr|sra|srta|d|dña|don|doña)[.\s]+/i, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/** Distancia de edición ≤ 1 (una letra cambiada, sobrante o faltante) — para erratas tipo "Antonio/Antonia". */
function editDistanceLeq1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  // Asegurar a = la más corta.
  if (la > lb) return editDistanceLeq1(b, a);
  let i = 0, j = 0, edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (la === lb) { i++; j++; } // sustitución
    else j++;                    // inserción en b
  }
  return edits + (lb - j) + (la - i) <= 1;
}

type RawUnified = Omit<UnifiedContact, 'sources' | 'mergedCount'> & { source: ContactSource };

/** Funde `src` dentro de `dst` (rellena huecos; el nombre más largo suele ser el más completo). */
function mergeInto(dst: UnifiedContact, src: RawUnified): void {
  if (src.fullName.length > dst.fullName.length) { dst.fullName = src.fullName; dst.title = src.title ?? dst.title; }
  dst.title ??= src.title;
  dst.position ??= src.position;
  dst.email ??= src.email;
  dst.emailVerified = dst.emailVerified || src.emailVerified;
  dst.phone ??= src.phone;
  dst.mobile ??= src.mobile;
  dst.entitySapCode ??= src.entitySapCode;
  dst.consentEmail ??= src.consentEmail;
  dst.consentPhone ??= src.consentPhone;
  if (!dst.sources.includes(src.source)) dst.sources.push(src.source);
  dst.mergedCount += 1;
}

/**
 * Une los contactos CRM y los del gestor/titular en una sola lista deduplicada.
 * Deduplicación NO destructiva (solo de presentación), en tres pasadas:
 *   1. mismo email (case-insensitive) → misma persona;
 *   2. mismo nombre normalizado → misma persona;
 *   3. nombre a distancia de edición ≤ 1 (erratas: "Antonio/Antonia Mª Hidalgo")
 *      cuando el registro huérfano no aporta email propio.
 */
export async function getUnifiedContacts(customerIds: number[], orgId: number | null): Promise<UnifiedContact[]> {
  const [crm, org] = await Promise.all([
    getCustomerContacts(customerIds),
    getOrganizationContacts(orgId),
  ]);

  const raws: RawUnified[] = [
    ...crm.map((c): RawUnified => ({
      key: `crm-${c.contactId}`,
      fullName: c.fullName,
      title: c.title,
      position: c.contactPosition,
      email: c.email,
      emailVerified: c.emailValidation === 'Válido',
      phone: c.phone,
      mobile: c.mobile,
      entitySapCode: c.entity?.sapCode ?? null,
      consentEmail: c.consentEmail,
      consentPhone: c.consentPhone,
      source: 'CRM',
    })),
    ...org.map((c): RawUnified => ({
      key: `org-${c.orgContactId}`,
      fullName: c.fullName ?? '—',
      title: null,
      position: null,
      email: c.email,
      emailVerified: c.emailValidation === 'VALIDO',
      phone: c.phone,
      mobile: c.mobile,
      entitySapCode: null,
      consentEmail: null,
      consentPhone: null,
      source: c.role === 'TITULAR' ? 'TITULAR' : 'GESTOR',
    })),
  ];

  const unified: UnifiedContact[] = [];
  const byEmail = new Map<string, UnifiedContact>();
  const byName = new Map<string, UnifiedContact>();

  const register = (u: UnifiedContact) => {
    unified.push(u);
    if (u.email) byEmail.set(u.email.toLowerCase(), u);
    const n = normName(u.fullName);
    if (n && !byName.has(n)) byName.set(n, u);
  };

  // Pasadas 1 y 2: email exacto, luego nombre normalizado exacto.
  const leftovers: RawUnified[] = [];
  for (const r of raws) {
    const emailKey = r.email?.toLowerCase();
    const nameKey = normName(r.fullName);
    const target = (emailKey && byEmail.get(emailKey)) || byName.get(nameKey);
    if (target) {
      mergeInto(target, r);
      if (target.email) byEmail.set(target.email.toLowerCase(), target);
      const n2 = normName(target.fullName);
      if (n2 && !byName.has(n2)) byName.set(n2, target);
    } else if (!emailKey) {
      leftovers.push(r); // sin email: darle opción a la pasada fuzzy
    } else {
      register({ ...r, sources: [r.source], mergedCount: 1 });
    }
  }

  // Pasada 3: huérfanos sin email → erratas a distancia 1 contra nombres ya registrados.
  for (const r of leftovers) {
    const nameKey = normName(r.fullName);
    let target = byName.get(nameKey);
    if (!target && nameKey.length >= 10) {
      for (const [n, u] of byName) {
        if (editDistanceLeq1(nameKey, n)) { target = u; break; }
      }
    }
    if (target) mergeInto(target, r);
    else register({ ...r, sources: [r.source], mergedCount: 1 });
  }

  const sourceOrder: Record<ContactSource, number> = { CRM: 0, GESTOR: 1, TITULAR: 2 };
  for (const u of unified) u.sources.sort((a, b) => sourceOrder[a] - sourceOrder[b]);
  // Titular y gestor (mantenedor) siempre arriba — son los contactos operativos clave.
  const rank = (u: UnifiedContact) =>
    u.sources.includes('TITULAR') ? 0 : u.sources.includes('GESTOR') ? 1 : 2;
  return unified.sort((a, b) =>
    rank(a) - rank(b) || a.fullName.localeCompare(b.fullName, 'es'));
}

/** Totales agregados por año (para el timeline). */
export async function getBillingByYear(customerIds: number[], buIds?: number[]) {
  if (customerIds.length === 0) return [];
  const scope = buScope(buIds);
  const rows = await prisma.$queryRawUnsafe<
    Array<{ year: number | bigint; total: number | bigint; n: number | bigint }>
  >(
    `SELECT YEAR(br.invoice_date) AS year,
            SUM(br.invoice_amount) AS total,
            COUNT(*) AS n
       FROM billing_records br
      WHERE br.customer_id IN ${idIn(customerIds)} AND br.invoice_date IS NOT NULL${scope.sql}
      GROUP BY YEAR(br.invoice_date)
      ORDER BY year DESC`,
    ...customerIds,
    ...scope.params,
  );
  return rows.map(r => ({ year: Number(r.year), total: Number(r.total), count: Number(r.n) }));
}

/** Desglose por BU para mostrar dónde factura la entidad. */
export async function getBillingByBu(customerIds: number[], buIds?: number[]) {
  if (customerIds.length === 0) return [];
  const scope = buScope(buIds);
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      bu_id: number | bigint; bu_name: string; bu_code: string; division_code: string;
      sap_code: string; legal_name: string; total: number | bigint; n: number | bigint; last_date: Date | null;
    }>
  >(
    `SELECT
       br.bu_id, bu.bu_name, bu.bu_code, d.division_code, le.sap_code, le.legal_name,
       SUM(br.invoice_amount) AS total, COUNT(*) AS n, MAX(br.invoice_date) AS last_date
     FROM billing_records br
     JOIN business_units bu ON bu.bu_id = br.bu_id
     JOIN divisions d ON d.division_id = bu.division_id
     JOIN legal_entities le ON le.entity_id = bu.entity_id
     WHERE br.customer_id IN ${idIn(customerIds)}${scope.sql}
     GROUP BY br.bu_id, bu.bu_name, bu.bu_code, d.division_code, le.sap_code, le.legal_name
     ORDER BY total DESC`,
    ...customerIds,
    ...scope.params,
  );
  return rows.map(r => ({
    buId: Number(r.bu_id), buName: r.bu_name, buCode: r.bu_code, divisionCode: r.division_code,
    sapCode: r.sap_code, legalName: r.legal_name, total: Number(r.total), count: Number(r.n), lastDate: r.last_date,
  }));
}

/** White spots: BUs donde la entidad NO factura (con RLS, dentro del alcance del usuario). */
export async function getWhiteSpots(customerIds: number[], buIds?: number[]) {
  if (customerIds.length === 0) return [];
  const scope = buScope(buIds, 'bu');
  const rows = await prisma.$queryRawUnsafe<
    Array<{ bu_id: number | bigint; bu_name: string; bu_code: string; division_code: string; sap_code: string; legal_name: string }>
  >(
    `SELECT bu.bu_id, bu.bu_name, bu.bu_code, d.division_code, le.sap_code, le.legal_name
       FROM business_units bu
       JOIN divisions d ON d.division_id = bu.division_id
       JOIN legal_entities le ON le.entity_id = bu.entity_id
      WHERE bu.bu_id NOT IN (
        SELECT DISTINCT bu_id FROM billing_records WHERE customer_id IN ${idIn(customerIds)}
      )${scope.sql}
      ORDER BY le.sap_code, d.division_code, bu.bu_code`,
    ...customerIds,
    ...scope.params,
  );
  return rows.map(r => ({
    buId: Number(r.bu_id), buName: r.bu_name, buCode: r.bu_code,
    divisionCode: r.division_code, sapCode: r.sap_code, legalName: r.legal_name,
  }));
}

/**
 * Facturas de la entidad agrupadas por número de factura (paginadas, filtro opcional por año).
 */
export async function getCustomerBillings(opts: {
  customerIds: number[];
  year?: number;
  page?: number;
  pageSize?: number;
  buIds?: number[];
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  if (opts.customerIds.length === 0) {
    return { rows: [], total: 0, page, pageSize };
  }

  const whereParts: string[] = [`br.customer_id IN ${idIn(opts.customerIds)}`];
  const params: unknown[] = [...opts.customerIds];
  if (opts.year) {
    whereParts.push(`YEAR(br.invoice_date) = ?`);
    params.push(opts.year);
  }
  if (opts.buIds !== undefined) {
    if (opts.buIds.length === 0) {
      whereParts.push('1 = 0');
    } else {
      whereParts.push(`br.bu_id IN (${opts.buIds.map(() => '?').join(',')})`);
      params.push(...opts.buIds);
    }
  }
  const whereSql = `WHERE ${whereParts.join(' AND ')}`;
  const groupKey = `COALESCE(br.invoice_number, CONCAT('#', br.billing_id))`;

  type Raw = {
    invoice_key: string; invoice_number: string | null; invoice_date: Date | null;
    total_amount: number | string | null; line_count: number | bigint; material_count: number | bigint;
    description: string | null; material_codes: string | null; bu_names: string | null;
    sap_codes: string | null; profit_centers: string | null;
  };

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<Raw[]>(
      `SELECT
          ${groupKey} AS invoice_key,
          MAX(br.invoice_number) AS invoice_number,
          MAX(br.invoice_date) AS invoice_date,
          SUM(br.invoice_amount) AS total_amount,
          COUNT(*) AS line_count,
          COUNT(DISTINCT br.catalog_id) AS material_count,
          GROUP_CONCAT(DISTINCT br.invoice_description SEPARATOR ' · ') AS description,
          GROUP_CONCAT(DISTINCT pc.material_code SEPARATOR ', ') AS material_codes,
          GROUP_CONCAT(DISTINCT bu.bu_name SEPARATOR ' · ') AS bu_names,
          GROUP_CONCAT(DISTINCT le.sap_code SEPARATOR ', ') AS sap_codes,
          GROUP_CONCAT(DISTINCT br.profit_center_code SEPARATOR ', ') AS profit_centers
         FROM billing_records br
         JOIN business_units bu ON bu.bu_id = br.bu_id
         JOIN legal_entities le ON le.entity_id = bu.entity_id
         JOIN product_catalog pc ON pc.catalog_id = br.catalog_id
         ${whereSql}
        GROUP BY ${groupKey}
        ORDER BY invoice_date DESC, invoice_key DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
      ...params,
    ),
    prisma.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(DISTINCT ${groupKey}) AS total FROM billing_records br ${whereSql}`,
      ...params,
    ),
  ]);

  return {
    rows: rows.map(r => ({
      invoiceKey: r.invoice_key,
      invoiceNumber: r.invoice_number,
      invoiceDate: r.invoice_date,
      totalAmount: r.total_amount != null ? Number(r.total_amount) : null,
      lineCount: Number(r.line_count),
      materialCount: Number(r.material_count),
      description: r.description,
      materialCodes: r.material_codes,
      buNames: r.bu_names,
      sapCodes: r.sap_codes,
      profitCenters: r.profit_centers,
    })),
    total: Number(countRows[0]?.total ?? 0),
    page,
    pageSize,
  };
}
