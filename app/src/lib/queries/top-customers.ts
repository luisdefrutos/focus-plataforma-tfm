/**
 * Top N de clientes por facturación — equivalente a las páginas
 * "TOP % DE CLIENTES" y "TOP Nº DE CLIENTES" del .pbix.
 *
 * Devuelve los N clientes con mayor facturación dentro de los filtros aplicados,
 * con porcentaje individual y acumulado sobre el total.
 */

import { prisma } from '@/lib/prisma';
import { cached } from '@/lib/cache';

export type TopCustomerFilters = {
  entitySapCode?: string;
  divisionCode?: string;
  year?: number;
  excludeIntercompany?: boolean;
};

export type TopCustomerRow = {
  rank: number;
  customerId: number;
  legalName: string;
  taxId: string;
  totalAmount: number;
  pctOfTotal: number;
  pctCumulative: number;
};

export type TopCustomersResult = {
  rows: TopCustomerRow[];
  grandTotalAmount: number;
  grandTotalCustomers: number;
  topNTotal: number;
  topNCustomers: number;
  pctRevenueConcentrated: number;
};

async function _getTopCustomers(opts: {
  topN: number;
  filters: TopCustomerFilters;
}): Promise<TopCustomersResult> {
  const N = Math.min(100, Math.max(1, opts.topN));
  const f = opts.filters;

  const billingWhere: string[] = [];
  const params: unknown[] = [];

  if (f.entitySapCode) {
    billingWhere.push(`le.sap_code = ?`);
    params.push(f.entitySapCode);
  }
  if (f.divisionCode) {
    billingWhere.push(`d.division_code = ?`);
    params.push(f.divisionCode);
  }
  if (f.year) {
    billingWhere.push(`YEAR(br.invoice_date) = ?`);
    params.push(f.year);
  }
  // Intercompany: filtro sobre cm.legal_name (siempre unido en el agg) → va al mismo WHERE.
  if (f.excludeIntercompany) {
    billingWhere.push(
      `c.legal_name NOT LIKE '%TÜV%'`,
      `c.legal_name NOT LIKE '%TUV %'`,
      `c.legal_name NOT LIKE '%INSPECCION_SA%'`,
      `c.legal_name NOT LIKE '%Swissi%'`,
      `c.legal_name NOT LIKE '%Ctva Ingenieria%'`,
    );
  }
  const billingJoin = (f.entitySapCode || f.divisionCode)
    ? `JOIN business_units bu ON bu.bu_id = br.bu_id
       JOIN legal_entities le ON le.entity_id = bu.entity_id
       JOIN divisions d ON d.division_id = bu.division_id`
    : '';
  const whereClause = billingWhere.length > 0 ? `WHERE ${billingWhere.join(' AND ')}` : '';

  // UNA sola pasada (antes eran dos agregaciones completas: gran total + top N).
  // Agrega por ENTIDAD con clave NUMÉRICA COALESCE(org_id, -customer_id) (sin hashing
  // de strings) y deriva el gran total + nº de clientes con ventanas OVER() sobre el
  // conjunto completo, devolviendo solo el top N.
  const sql = `
    WITH agg AS (
      SELECT
        MIN(br.customer_id) AS customer_id,
        MAX(COALESCE(o.legal_name, c.legal_name)) AS legal_name,
        MAX(COALESCE(o.tax_id, c.tax_id)) AS tax_id,
        SUM(br.invoice_amount) AS total_amount
      FROM billing_records br
      JOIN customer_master c ON c.customer_id = br.customer_id
      LEFT JOIN organizations o ON o.org_id = c.org_id
      ${billingJoin}
      ${whereClause}
      GROUP BY COALESCE(c.org_id, -c.customer_id)
      HAVING total_amount > 0
    )
    SELECT customer_id, legal_name, tax_id, total_amount,
           SUM(total_amount) OVER () AS grand_total,
           COUNT(*)          OVER () AS grand_n
    FROM agg
    ORDER BY total_amount DESC
    LIMIT ${N}
  `;

  const topRows = await prisma.$queryRawUnsafe<Array<{
    customer_id: bigint | number;
    legal_name: string;
    tax_id: string;
    total_amount: number | string;
    grand_total: number | string;
    grand_n: bigint | number;
  }>>(sql, ...params);

  const grandTotalAmount = Number(topRows[0]?.grand_total ?? 0);
  const grandTotalCustomers = Number(topRows[0]?.grand_n ?? 0);

  let cum = 0;
  const rows: TopCustomerRow[] = topRows.map((r, i) => {
    const amt = Number(r.total_amount);
    cum += amt;
    return {
      rank: i + 1,
      customerId: Number(r.customer_id),
      legalName: r.legal_name,
      taxId: r.tax_id,
      totalAmount: amt,
      pctOfTotal: grandTotalAmount > 0 ? (amt / grandTotalAmount) * 100 : 0,
      pctCumulative: grandTotalAmount > 0 ? (cum / grandTotalAmount) * 100 : 0,
    };
  });

  const topNTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  return {
    rows,
    grandTotalAmount,
    grandTotalCustomers,
    topNTotal,
    topNCustomers: rows.length,
    pctRevenueConcentrated: grandTotalAmount > 0 ? (topNTotal / grandTotalAmount) * 100 : 0,
  };
}
// ─── Versión cacheada (tag 'billing', TTL 5 min). ───
export const getTopCustomers = cached(_getTopCustomers, ['top:getTopCustomers']);
