/**
 * Queries del dashboard ejecutivo — ciclo de vida de clientes + Pareto de ventas.
 *
 * Todas las métricas se calculan a nivel de ORGANIZACIÓN (golden record por CIF):
 * los registros SAP duplicados (p.ej. gemelos T7) agrupan bajo la misma organización
 * y no generan falsos "nuevos"/"perdidos". Los clientes sin organización (CIF no
 * válido) cuentan como su propio grupo (clave negativa -customer_id).
 *
 * RLS: todas las funciones reciben `buIds` (alcance de facturación del usuario);
 * lista vacía = sin acceso = ceros. Forman parte de la clave de caché.
 */
import { prisma } from '@/lib/prisma';
import { cached } from '@/lib/cache';

/** Primer año con facturación cargada (los datos pre-2021 se eliminaron el 2026-06-15). */
const MIN_BILLING_YEAR = 2021;

/**
 * Año de referencia del dashboard: el último año CERRADO. El año en curso (parcial)
 * NO computa en los KPIs de clientes — a mitad de año generaría falsos "no fieles" /
 * "perdidos" (clientes que simplemente aún no han comprado este año).
 */
function refYear(): number {
  return new Date().getFullYear() - 1;
}

/** Clave de agrupación org-level: organización o, en su defecto, el propio registro. */
const ORG_KEY = `COALESCE(cm.org_id, -cm.customer_id)`;

function buFilter(buIds: number[]): string {
  const safe = buIds.map(Number).filter(Number.isFinite);
  return safe.length > 0 ? `AND br.bu_id IN (${safe.join(',')})` : `AND 1=0`;
}

export type LifecycleKpi = { count: number; amount: number };

// ─── Fieles / nuevos / recuperados (alcance global del usuario) ───

export type CustomerLifecycle = {
  /** Año de referencia (último cerrado) — las cifras de € de estos tres KPIs son las suyas. */
  year: number;
  /** Primer año de la ventana de fidelidad (factura todos los años desde aquí). */
  loyalFromYear: number;
  /** Facturan TODOS los años de la ventana [loyalFromYear..year]. */
  fieles: LifecycleKpi;
  /** Primera factura de su historia en el año de referencia. */
  nuevos: LifecycleKpi;
  /** Facturaron por última vez hace ≥2 años y volvieron en el año de referencia. */
  recuperados: LifecycleKpi;
};

async function _getCustomerLifecycle(buIds: number[]): Promise<CustomerLifecycle> {
  const year = refYear();
  const loyalFromYear = year - 3;
  const empty = { count: 0, amount: 0 };
  if (!buIds.length) return { year, loyalFromYear, fieles: empty, nuevos: empty, recuperados: empty };

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    WITH oy AS (
      SELECT ${ORG_KEY} AS okey, YEAR(br.invoice_date) AS y, SUM(br.invoice_amount) AS amt
      FROM billing_records br
      JOIN customer_master cm ON cm.customer_id = br.customer_id
      WHERE br.invoice_date IS NOT NULL AND br.invoice_amount IS NOT NULL
        AND YEAR(br.invoice_date) <= ${year} ${buFilter(buIds)}
      GROUP BY okey, y
    ),
    s AS (
      SELECT okey, MIN(y) AS first_y,
             MAX(y = ${loyalFromYear}) AS h3, MAX(y = ${loyalFromYear + 1}) AS h2,
             MAX(y = ${year - 1}) AS h1, MAX(y = ${year}) AS h0,
             SUM(CASE WHEN y = ${year} THEN amt ELSE 0 END) AS amt0
      FROM oy GROUP BY okey
    )
    SELECT
      SUM(h3 AND h2 AND h1 AND h0) AS fieles_n,
      SUM(CASE WHEN h3 AND h2 AND h1 AND h0 THEN amt0 ELSE 0 END) AS fieles_amt,
      SUM(first_y = ${year}) AS nuevos_n,
      SUM(CASE WHEN first_y = ${year} THEN amt0 ELSE 0 END) AS nuevos_amt,
      SUM(h0 AND NOT h1 AND first_y <= ${year - 2}) AS recup_n,
      SUM(CASE WHEN h0 AND NOT h1 AND first_y <= ${year - 2} THEN amt0 ELSE 0 END) AS recup_amt
    FROM s
  `);

  const r = rows[0] ?? {};
  const kpi = (n: string, amt: string): LifecycleKpi => ({
    count: Number(r[n] ?? 0),
    amount: Number(r[amt] ?? 0),
  });
  return {
    year,
    loyalFromYear,
    fieles: kpi('fieles_n', 'fieles_amt'),
    nuevos: kpi('nuevos_n', 'nuevos_amt'),
    recuperados: kpi('recup_n', 'recup_amt'),
  };
}

// ─── Perdidos por ámbito (sociedad o división): sin facturar ni el año pasado ni este ───

export type LostCustomers = LifecycleKpi & {
  /** Las cifras de € son lo facturado en el ámbito durante su último año activo. */
  lastActiveBefore: number;
};

/** Ámbito del bloque de negocio: una sociedad (sap_code) o una división (division_code). */
type LostScope = { entitySapCode: string } | { divisionCode: string };

async function _getLostCustomers(buIds: number[], scope: LostScope): Promise<LostCustomers> {
  const lastActiveBefore = refYear(); // perdido = no facturó el año de referencia (último activo anterior)
  if (!buIds.length) return { count: 0, amount: 0, lastActiveBefore };

  // El valor de ámbito va como parámetro `?` (no interpolado). Hoy los llamantes
  // pasan literales ('9999'/'MO'), pero parametrizar evita un SQLi latente si en el
  // futuro llegara de la request (CWE-89).
  const scopeVal = 'entitySapCode' in scope ? scope.entitySapCode : scope.divisionCode;
  const scopeJoin = 'entitySapCode' in scope
    ? `JOIN legal_entities sc ON sc.entity_id = bu.entity_id AND sc.sap_code = ?`
    : `JOIN divisions sc ON sc.division_id = bu.division_id AND sc.division_code = ?`;

  const rows = await prisma.$queryRawUnsafe<Array<{ n: unknown; amount: unknown }>>(`
    WITH oy AS (
      SELECT ${ORG_KEY} AS okey, YEAR(br.invoice_date) AS y, SUM(br.invoice_amount) AS amt
      FROM billing_records br
      JOIN business_units bu ON bu.bu_id = br.bu_id
      ${scopeJoin}
      JOIN customer_master cm ON cm.customer_id = br.customer_id
      WHERE br.invoice_date IS NOT NULL AND br.invoice_amount IS NOT NULL
        AND YEAR(br.invoice_date) <= ${lastActiveBefore} ${buFilter(buIds)}
      GROUP BY okey, y
    ),
    s AS (SELECT okey, MAX(y) AS last_y FROM oy GROUP BY okey)
    SELECT COUNT(*) AS n, SUM(la.amt) AS amount
    FROM s
    JOIN oy la ON la.okey = s.okey AND la.y = s.last_y
    WHERE s.last_y < ${lastActiveBefore} AND s.last_y >= ${MIN_BILLING_YEAR}
  `, scopeVal);

  return {
    count: Number(rows[0]?.n ?? 0),
    amount: Number(rows[0]?.amount ?? 0),
    lastActiveBefore,
  };
}

// ─── Perdidos TSA: próxima inspección vencida sin facturación TSA posterior ───

/** Sociedades del bloque TSA (INSPECCION_SA). Las inspecciones cargadas de TSA son de la 8888. */
const TSA_INSPECTION_ENTITY = '8888';
const TSA_BILLING_ENTITIES = ['8888', '0380'];

export type LostTsa = LifecycleKpi & {
  /** Organizaciones perdidas que nunca cruzaron con una factura TSA (volumen desconocido). */
  neverBilled: number;
};

async function _getLostTsaCustomers(buIds: number[]): Promise<LostTsa> {
  if (!buIds.length) return { count: 0, amount: 0, neverBilled: 0 };
  const entityList = TSA_BILLING_ENTITIES.map(e => `'${e}'`).join(',');
  // Foto a cierre del año de referencia: vencimientos y facturación hasta el 31/12.
  const cutoff = `'${refYear() + 1}-01-01'`;

  const rows = await prisma.$queryRawUnsafe<Array<{ n: unknown; never_billed: unknown; amount: unknown }>>(`
    WITH due AS (
      SELECT a.owner_org_id AS org_id, MAX(i.next_due_date) AS max_due
      FROM inspections i
      JOIN assets a ON a.asset_id = i.asset_id
      JOIN legal_entities le ON le.entity_id = i.legal_entity_id
      WHERE i.next_due_date IS NOT NULL AND a.owner_org_id IS NOT NULL
        AND le.sap_code = '${TSA_INSPECTION_ENTITY}'
      GROUP BY a.owner_org_id
    ),
    expired AS (SELECT org_id, max_due FROM due WHERE max_due < ${cutoff}),
    oy AS (
      SELECT cm.org_id, YEAR(br.invoice_date) AS y, MAX(br.invoice_date) AS last_inv_y, SUM(br.invoice_amount) AS amt
      FROM billing_records br
      JOIN business_units bu ON bu.bu_id = br.bu_id
      JOIN legal_entities le ON le.entity_id = bu.entity_id
      JOIN customer_master cm ON cm.customer_id = br.customer_id
      WHERE le.sap_code IN (${entityList}) AND br.invoice_date IS NOT NULL
        AND br.invoice_date < ${cutoff}
        AND br.invoice_amount IS NOT NULL AND cm.org_id IS NOT NULL ${buFilter(buIds)}
      GROUP BY cm.org_id, y
    ),
    tb AS (SELECT org_id, MAX(last_inv_y) AS last_inv, MAX(y) AS last_y FROM oy GROUP BY org_id),
    lost AS (
      SELECT e.org_id, tb.last_y
      FROM expired e
      LEFT JOIN tb ON tb.org_id = e.org_id
      WHERE tb.org_id IS NULL OR tb.last_inv < e.max_due
    )
    SELECT COUNT(*) AS n,
           SUM(l.last_y IS NULL) AS never_billed,
           SUM(la.amt) AS amount
    FROM lost l
    LEFT JOIN oy la ON la.org_id = l.org_id AND la.y = l.last_y
  `);

  return {
    count: Number(rows[0]?.n ?? 0),
    amount: Number(rows[0]?.amount ?? 0),
    neverBilled: Number(rows[0]?.never_billed ?? 0),
  };
}

// ─── Pareto de ventas por división ───

export type ParetoDivision = {
  division: string;
  /** Facturación del año del Pareto (solo clientes con neto > 0). */
  total: number;
  /** Nº de organizaciones con facturación neta positiva en la división. */
  clients: number;
  /** Nº de organizaciones (las mayores) que concentran el 80% de la facturación. */
  clients80: number;
};

export type ParetoByDivision = { year: number; divisions: ParetoDivision[] };

async function _getParetoByDivision(buIds: number[]): Promise<ParetoByDivision> {
  const year = refYear();
  if (!buIds.length) return { year, divisions: [] };

  const rows = await prisma.$queryRawUnsafe<
    Array<{ dc: string; total: unknown; clients: unknown; clients80: unknown }>
  >(`
    WITH od AS (
      SELECT d.division_code AS dc, ${ORG_KEY} AS okey, SUM(br.invoice_amount) AS amt
      FROM billing_records br
      JOIN business_units bu ON bu.bu_id = br.bu_id
      JOIN divisions d ON d.division_id = bu.division_id
      JOIN customer_master cm ON cm.customer_id = br.customer_id
      WHERE YEAR(br.invoice_date) = ${year} AND br.invoice_amount IS NOT NULL ${buFilter(buIds)}
      GROUP BY dc, okey
      HAVING amt > 0
    ),
    ranked AS (
      SELECT dc, amt,
             SUM(amt) OVER (PARTITION BY dc ORDER BY amt DESC ROWS UNBOUNDED PRECEDING) AS cum,
             SUM(amt) OVER (PARTITION BY dc) AS tot,
             ROW_NUMBER() OVER (PARTITION BY dc ORDER BY amt DESC) AS rn,
             COUNT(*) OVER (PARTITION BY dc) AS nclients
      FROM od
    )
    SELECT dc, MAX(tot) AS total, MAX(nclients) AS clients,
           MIN(CASE WHEN cum >= 0.8 * tot THEN rn END) AS clients80
    FROM ranked
    GROUP BY dc
    ORDER BY total DESC
  `);

  return {
    year,
    divisions: rows.map(r => ({
      division: r.dc,
      total: Number(r.total ?? 0),
      clients: Number(r.clients ?? 0),
      clients80: Number(r.clients80 ?? 0),
    })),
  };
}

// ─── Versiones cacheadas (tag 'billing', TTL 5 min). buIds forma parte de la clave. ───
export const getCustomerLifecycle = cached(_getCustomerLifecycle, ['dashboard:customerLifecycle']);
export const getLostCustomers = cached(_getLostCustomers, ['dashboard:lostCustomers']);
export const getLostTsaCustomers = cached(_getLostTsaCustomers, ['dashboard:lostTsaCustomers']);
export const getParetoByDivision = cached(_getParetoByDivision, ['dashboard:paretoByDivision']);
