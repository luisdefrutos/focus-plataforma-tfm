/**
 * Segmentación por facturación — equivalente a la página "SEGMENTACION POR FACT." del .pbix.
 *
 * Calcula buckets de facturación (Table_RANGES en PBI) con totales y %.
 */

import { prisma } from '@/lib/prisma';
import { AMOUNT_RANGES, sqlRangeCase } from '@/lib/spain';
import { cached } from '@/lib/cache';

export type SegmentationFilters = {
  /** sap_codes de las sociedades legales (multi) */
  entitySapCodes?: string[];
  /** codigos de división (multi) */
  divisionCodes?: string[];
  /** Años concretos (YYYY) (multi) */
  years?: number[];
  /** Excluir clientes intercompany */
  excludeIntercompany?: boolean;
};

export type RangeBucket = {
  code: string;
  label: string;
  customerCount: number;
  totalAmount: number;
  pctCustomers: number;
  pctAmount: number;
};

async function _getSegmentation(f: SegmentationFilters): Promise<RangeBucket[]> {
  const billingWhere: string[] = [];
  const params: unknown[] = [];

  if (f.entitySapCodes?.length) {
    billingWhere.push(`le.sap_code IN (${f.entitySapCodes.map(() => '?').join(',')})`);
    params.push(...f.entitySapCodes);
  }
  if (f.divisionCodes?.length) {
    billingWhere.push(`d.division_code IN (${f.divisionCodes.map(() => '?').join(',')})`);
    params.push(...f.divisionCodes);
  }
  if (f.years?.length) {
    billingWhere.push(`YEAR(br.invoice_date) IN (${f.years.map(() => '?').join(',')})`);
    params.push(...f.years);
  }
  // Intercompany se filtra ahora dentro del agg (sobre cm.legal_name) para poder agrupar por entidad.
  if (f.excludeIntercompany) {
    billingWhere.push(`cm.legal_name NOT LIKE '%TÜV%'`);
    billingWhere.push(`cm.legal_name NOT LIKE '%TUV %'`);
    billingWhere.push(`cm.legal_name NOT LIKE '%INSPECCION_SA%'`);
    billingWhere.push(`cm.legal_name NOT LIKE '%Swissi%'`);
    billingWhere.push(`cm.legal_name NOT LIKE '%Ctva Ingenieria%'`);
  }
  const billingJoin = (f.entitySapCodes?.length || f.divisionCodes?.length)
    ? `JOIN business_units bu ON bu.bu_id = br.bu_id
       JOIN legal_entities le ON le.entity_id = bu.entity_id
       JOIN divisions d ON d.division_id = bu.division_id`
    : '';
  const billingFilterClause = billingWhere.length > 0 ? `WHERE ${billingWhere.join(' AND ')}` : '';

  // Agregado por ENTIDAD (organización por CIF, o registro SAP suelto): los tramos cuentan
  // entidades reales, no registros SAP duplicados del mismo cliente.
  // Clave de entidad NUMÉRICA (org_id, o -customer_id para sueltos): evita el hashing
  // de strings de CONCAT() al agrupar ~935k filas. El entity_key no se usa fuera del
  // agg (el SELECT externo solo trocea por total_amount), así que el número basta.
  const aggSubquery = `
    SELECT COALESCE(cm.org_id, -cm.customer_id) AS entity_key,
           SUM(br.invoice_amount) AS total_amount
    FROM billing_records br
    JOIN customer_master cm ON cm.customer_id = br.customer_id
    ${billingJoin}
    ${billingFilterClause}
    GROUP BY COALESCE(cm.org_id, -cm.customer_id)
  `;

  const rows = await prisma.$queryRawUnsafe<Array<{ range_code: string; n: number | bigint; total: number | string }>>(
    `SELECT
       (${sqlRangeCase('agg.total_amount')}) AS range_code,
       COUNT(*) AS n,
       COALESCE(SUM(agg.total_amount), 0) AS total
     FROM (${aggSubquery}) agg
     GROUP BY range_code`,
    ...params,
  );

  const byCode = new Map(rows.map(r => [r.range_code, { n: Number(r.n), total: Number(r.total) }]));
  const totalCust = rows.reduce((s, r) => s + Number(r.n), 0);
  const totalAmt = rows.reduce((s, r) => s + Number(r.total), 0);

  return AMOUNT_RANGES.map(r => {
    const hit = byCode.get(r.code) ?? { n: 0, total: 0 };
    return {
      code: r.code,
      label: r.label,
      customerCount: hit.n,
      totalAmount: hit.total,
      pctCustomers: totalCust > 0 ? (hit.n / totalCust) * 100 : 0,
      pctAmount: totalAmt > 0 ? (hit.total / totalAmt) * 100 : 0,
    };
  });
}

export type BreakdownSlice = {
  key: string;
  label: string;
  total: number;
};

export type Breakdown = {
  byDivision: BreakdownSlice[];
  byEntity: BreakdownSlice[];
  byBu: BreakdownSlice[];
};

/**
 * Facturación agrupada por División, Sociedad y BU — respeta los mismos filtros
 * que getSegmentation. Una sola consulta a nivel BU; División/Sociedad se derivan en JS.
 */
async function _getBreakdown(f: SegmentationFilters): Promise<Breakdown> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (f.entitySapCodes?.length) {
    where.push(`le.sap_code IN (${f.entitySapCodes.map(() => '?').join(',')})`);
    params.push(...f.entitySapCodes);
  }
  if (f.divisionCodes?.length) {
    where.push(`d.division_code IN (${f.divisionCodes.map(() => '?').join(',')})`);
    params.push(...f.divisionCodes);
  }
  if (f.years?.length) {
    where.push(`YEAR(br.invoice_date) IN (${f.years.map(() => '?').join(',')})`);
    params.push(...f.years);
  }
  if (f.excludeIntercompany) {
    where.push(`c.legal_name NOT LIKE '%TÜV%'`);
    where.push(`c.legal_name NOT LIKE '%TUV %'`);
    where.push(`c.legal_name NOT LIKE '%INSPECCION_SA%'`);
    where.push(`c.legal_name NOT LIKE '%Swissi%'`);
    where.push(`c.legal_name NOT LIKE '%Ctva Ingenieria%'`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      entity_code: string;
      entity_name: string;
      div_code: string;
      div_name: string;
      bu_id: number | bigint;
      bu_name: string | null;
      total: number | string;
    }>
  >(
    `SELECT
       le.sap_code        AS entity_code,
       le.legal_name      AS entity_name,
       d.division_code    AS div_code,
       d.division_name    AS div_name,
       bu.bu_id           AS bu_id,
       bu.bu_name         AS bu_name,
       COALESCE(SUM(br.invoice_amount), 0) AS total
     FROM billing_records br
     JOIN business_units bu  ON bu.bu_id = br.bu_id
     JOIN legal_entities le  ON le.entity_id = bu.entity_id
     JOIN divisions d        ON d.division_id = bu.division_id
     JOIN customer_master c  ON c.customer_id = br.customer_id
     ${whereClause}
     GROUP BY le.sap_code, le.legal_name, d.division_code, d.division_name, bu.bu_id, bu.bu_name`,
    ...params,
  );

  const divMap = new Map<string, BreakdownSlice>();
  const entMap = new Map<string, BreakdownSlice>();
  const buList: BreakdownSlice[] = [];

  for (const r of rows) {
    const total = Number(r.total);
    if (total <= 0) continue;

    const dKey = r.div_code;
    const d = divMap.get(dKey);
    if (d) d.total += total;
    else divMap.set(dKey, { key: dKey, label: `${r.div_code} — ${r.div_name}`, total });

    const eKey = r.entity_code;
    const e = entMap.get(eKey);
    if (e) e.total += total;
    else entMap.set(eKey, { key: eKey, label: `${r.entity_code} — ${r.entity_name}`, total });

    buList.push({
      key: String(r.bu_id),
      label: r.bu_name ?? `BU ${r.bu_id}`,
      total,
    });
  }

  const sortDesc = (a: BreakdownSlice, b: BreakdownSlice) => b.total - a.total;

  return {
    byDivision: [...divMap.values()].sort(sortDesc),
    byEntity: [...entMap.values()].sort(sortDesc),
    byBu: buList.sort(sortDesc),
  };
}

async function _getYears(): Promise<number[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ y: number | bigint }>>(
    `SELECT DISTINCT YEAR(invoice_date) AS y
       FROM billing_records
      WHERE invoice_date IS NOT NULL
      ORDER BY y DESC`,
  );
  return rows.map(r => Number(r.y));
}
// ─── Versiones cacheadas (tag 'billing', TTL 5 min). ───
export const getSegmentation = cached(_getSegmentation, ['segmentacion:getSegmentation']);
export const getBreakdown = cached(_getBreakdown, ['segmentacion:getBreakdown']);
export const getYears = cached(_getYears, ['segmentacion:getYears']);
