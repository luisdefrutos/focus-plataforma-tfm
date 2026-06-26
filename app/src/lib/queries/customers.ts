/**
 * Queries del Buscador 360 — búsqueda + filtros + paginación server-side.
 *
 * Devuelve clientes enriquecidos con métricas agregadas de facturación.
 * Para 171k clientes paginados de 25 en 25, hacemos una query JOIN agregada
 * con LIMIT/OFFSET. Una segunda query rápida da el COUNT total.
 */

import { prisma } from '@/lib/prisma';
import { cached } from '@/lib/cache';
import { type AllowedFilters, FORCED_EMPTY } from '@/lib/access';
import {
  pc2CodesForCcaa, pc2CodesForProvince, sqlRangeCase, AMOUNT_RANGES,
  SQL_ENTITY_TYPE_EXPR, SQL_INTERCOMPANY_EXPR,
  PROVINCE_BY_PC2, CCAA_BY_PROVINCE,
  CCAAS, PROVINCES, ENTITY_TYPES
} from '@/lib/spain';
import { PROFIT_CENTERS } from '@/lib/profit-centers';
import { MATERIALS } from '@/lib/materials';
import { escapeLike } from '@/lib/sql';
import { resolveIncompatibilities, type IncompatibilityPair } from './incompatibilities';

export type SortField = 'legalName' | 'totalAmount' | 'lastInvoiceDate' | 'invoiceCount';
export type SortDir = 'asc' | 'desc';

export type CustomerSearchFilters = {
  /** Texto libre: matchea tax_id o legal_name (LIKE %s%) */
  search?: string;
  /** sap_codes de entidad legal (8888, 9999, ...) — multi; filtra billing en esas empresas */
  entitySapCodes?: string[];
  /** division_codes (II, MO, NON, BA, PS) — multi; filtra billing en esas divisiones */
  divisionCodes?: string[];
  /** Importe acumulado mínimo */
  minAmount?: number;
  /** Solo clientes con facturación en últimos 12 meses */
  onlyActive12m?: boolean;
  /** Excluir clientes BLOCKED por SAP */
  hideBlocked?: boolean;
  /** Filtro intercompany: '1'=solo, '0'=excluir, undefined=todos */
  intercompany?: '0' | '1';
  /** Tipos de entidad (letra del CIF / NIF / NIE / EXTRANJERO / NA) — multi */
  entityTypes?: string[];
  /** Comunidades autónomas (sobre la 1ª address) — multi */
  ccaas?: string[];
  /** Provincias (sobre la 1ª address) — multi */
  provinces?: string[];
  /** Códigos de rango del agg.total_amount (r0, r1k_5k, etc.) — multi */
  amountRanges?: string[];
  /** Solo clientes recurrentes (≥2 años con facturas) */
  recurringOnly?: boolean;
  /** Código postal (prefijo) — clientes con AL MENOS una dirección que empieza por él */
  postalCode?: string;
  /** Centros de coste (profit center) — multi; clientes que facturan en ALGUNO */
  profitCenterCodes?: string[];
  /** Centros de coste (profit center) — multi; clientes que NO facturan en NINGUNO */
  excludeProfitCenterCodes?: string[];
  /** Materiales/servicios (material_code) — multi; clientes que facturan ALGUNO */
  materialCodes?: string[];
  /** Materiales/servicios (material_code) — multi; clientes que NO facturan NINGUNO */
  excludeMaterialCodes?: string[];
  /** Material/catalog específico: clientes que SÍ facturan ese material */
  hasCatalogId?: number;
  /** Material/catalog específico: clientes que NO facturan ese material */
  missingCatalogId?: number;
  /** Años de facturación (YEAR(invoice_date)) — multi; acota la facturación contada a esos años */
  fiscalYears?: number[];
  /** Divisiones CNAE (cnae_code) — multi; clientes clasificados en ALGUNA */
  cnaeCodes?: string[];
  /** Divisiones CNAE (cnae_code) — multi; clientes NO clasificados en NINGUNA */
  excludeCnaeCodes?: string[];
  /**
   * (DERIVADOS de materialCodes vía resolveIncompatibilities — no los rellena la UI.)
   * Materiales con incompatibilidad legal TOTAL frente a la selección: la ENTIDAD
   * (organización completa) que facture alguno queda excluida del resultado.
   */
  incompatibleTotalCodes?: string[];
  /** Ídem PARCIAL: la entidad se muestra, marcada con warning (no filtra el WHERE). */
  incompatiblePartialCodes?: string[];
};

export type CustomerSearchOpts = CustomerSearchFilters & {
  page?: number;
  pageSize?: number;
  sortField?: SortField;
  sortDir?: SortDir;
  buIds?: number[];
  allowedFilters?: AllowedFilters;
  /** Agrupación de filas: 'org' (Golden Record, por CIF — por defecto) o 'sap' (un registro SAP por fila). */
  group?: 'org' | 'sap';
  /** Bandera para obviar el LIMIT 15000 en exportaciones masivas */
  exportAll?: boolean;
};

export type CustomerSearchRow = {
  /** Id del registro SAP representante (para el enlace en modo 'sap' / fallback). */
  customerId: number;
  /** Clave de entidad de negocio: 'O'+orgId (organización) o 'C'+customerId (registro SAP suelto). */
  entityKey: string;
  /** Id de organización si la fila es una org agrupada; null si es un registro SAP suelto. */
  orgId: number | null;
  /** Nº de registros SAP unificados bajo esta fila (1 en modo 'sap' o entidad sin duplicados). */
  sapCount: number;
  legalName: string;
  taxId: string;
  sapCustomerCode: string | null;
  city: string | null;
  province: string | null;
  ccaa: string | null;
  invoiceCount: number;
  totalAmount: number;
  lastInvoiceDate: Date | null;
  buCount: number;
  yearsActive: number;
  entityType: string;
  isIntercompany: boolean;
  isBlocked: boolean;
  /** true si la entidad factura algún material con incompatibilidad PARCIAL frente a la selección. */
  hasPartialConflict?: boolean;
};

/** Efecto de las incompatibilidades legales sobre la búsqueda (solo con filtro de material). */
export type CustomerSearchIncompatibility = {
  /** Entidades que cumplían el resto de filtros y se excluyen por conflicto TOTAL. */
  excludedCount: number;
  /** Pares aplicados (TOTAL para el banner de exclusión, PARCIAL para la leyenda del warning). */
  pairs: IncompatibilityPair[];
};

export type CustomerSearchResult = {
  rows: CustomerSearchRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Suma de facturación de TODOS los clientes filtrados (no solo la página). */
  sumAmount: number;
  /** Presente cuando la selección de materiales activa pares de la matriz de conflictos. */
  incompatibility?: CustomerSearchIncompatibility;
};

// ─── Modo whitespot (vista agregada por sociedad → BU del conjunto filtrado) ───

/** Una BU dentro de una sociedad, con su facturación agregada de la cartera filtrada. */
export type PortfolioBu = {
  buId: number;
  buName: string;
  buCode: string;
  divisionCode: string;
  /** Facturación de los clientes filtrados en esta BU. */
  total: number;
  /** Nº de clientes (distintos) del conjunto filtrado que facturan en esta BU. */
  customers: number;
  /** Nº de líneas de factura. */
  count: number;
  /** true si hay facturación (>0); false = whitespot (hueco / oportunidad). */
  isActive: boolean;
};

/** Una sociedad (legal entity) con sus BUs. */
export type PortfolioSociety = {
  sapCode: string;
  legalName: string;
  total: number;
  /** BUs con facturación dentro de esta sociedad. */
  activeCount: number;
  /** BUs totales mostradas (activas + whitespots) dentro del alcance del usuario. */
  totalBus: number;
  bus: PortfolioBu[];
};

export type PortfolioWhitespots = {
  societies: PortfolioSociety[];
  grandTotal: number;
  activeBus: number;
  totalBus: number;
};

/** Helper interno: condiciones sobre `customer_master` (no billing). */
function buildCustomerWhere(
  f: CustomerSearchFilters,
  group: 'org' | 'sap' = 'sap',
): { clause: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  // En modo 'org' la búsqueda es sobre el nombre/CIF de la ENTIDAD (la organización si
  // existe, si no el propio registro SAP). Requiere que la query tenga el JOIN a `organizations o`.
  const nameExpr = group === 'org' ? `COALESCE(o.legal_name, c.legal_name)` : `c.legal_name`;
  const taxExpr = group === 'org' ? `COALESCE(o.tax_id, c.tax_id)` : `c.tax_id`;
  if (f.search) {
    parts.push(`(${nameExpr} LIKE ? OR ${taxExpr} LIKE ?)`);
    const likeSearch = `%${escapeLike(f.search)}%`;
    params.push(likeSearch, likeSearch);
  }
  if (f.hideBlocked) {
    parts.push(`c.legal_name NOT LIKE '%BLOCKED%' AND c.tax_id != 'Not assigned'`);
  }
  if (f.intercompany === '1') {
    parts.push(`(${SQL_INTERCOMPANY_EXPR}) = 1`);
  } else if (f.intercompany === '0') {
    parts.push(`(${SQL_INTERCOMPANY_EXPR}) = 0`);
  }
  if (f.entityTypes && f.entityTypes.length > 0) {
    parts.push(`(${SQL_ENTITY_TYPE_EXPR}) IN (${f.entityTypes.map(() => '?').join(',')})`);
    params.push(...f.entityTypes);
  }
  // Filtro geográfico — vía EXISTS contra addresses (cliente tiene AL MENOS
  // una dirección en alguna de las CCAA/provincias seleccionadas). Multi → unión
  // de los códigos postales (PC2) de todas las seleccionadas.
  if (f.ccaas && f.ccaas.length > 0) {
    const codes = [...new Set(f.ccaas.flatMap(c => pc2CodesForCcaa(c)))];
    if (codes.length > 0) {
      parts.push(`EXISTS (
        SELECT 1 FROM addresses a2
         WHERE a2.customer_id = c.customer_id
           AND LEFT(a2.postal_code, 2) IN (${codes.map(() => '?').join(',')})
      )`);
      params.push(...codes);
    }
  }
  if (f.provinces && f.provinces.length > 0) {
    const codes = [...new Set(f.provinces.flatMap(p => pc2CodesForProvince(p)))];
    if (codes.length > 0) {
      parts.push(`EXISTS (
        SELECT 1 FROM addresses a3
         WHERE a3.customer_id = c.customer_id
           AND LEFT(a3.postal_code, 2) IN (${codes.map(() => '?').join(',')})
      )`);
      params.push(...codes);
    }
  }
  // Código postal — prefijo sobre la dirección (cliente con AL MENOS una que empieza así).
  if (f.postalCode) {
    parts.push(`EXISTS (
      SELECT 1 FROM addresses a4
       WHERE a4.customer_id = c.customer_id
         AND a4.postal_code LIKE ?
    )`);
    params.push(`${escapeLike(f.postalCode)}%`);
  }
  // Centros de coste (profit center) — multi, coincidencia exacta. Positivo
  // (factura en alguno) y negativo (no factura en ninguno).
  if (f.profitCenterCodes && f.profitCenterCodes.length > 0) {
    parts.push(`EXISTS (
      SELECT 1 FROM billing_records br_pc
       WHERE br_pc.customer_id = c.customer_id
         AND br_pc.profit_center_code IN (${f.profitCenterCodes.map(() => '?').join(',')})
    )`);
    params.push(...f.profitCenterCodes);
  }
  if (f.excludeProfitCenterCodes && f.excludeProfitCenterCodes.length > 0) {
    parts.push(`NOT EXISTS (
      SELECT 1 FROM billing_records br_pcx
       WHERE br_pcx.customer_id = c.customer_id
         AND br_pcx.profit_center_code IN (${f.excludeProfitCenterCodes.map(() => '?').join(',')})
    )`);
    params.push(...f.excludeProfitCenterCodes);
  }
  // Materiales/servicios (material_code de product_catalog) — multi, exacto.
  // Positivo (factura alguno) y negativo (no factura ninguno).
  if (f.materialCodes && f.materialCodes.length > 0) {
    parts.push(`EXISTS (
      SELECT 1 FROM billing_records br_m
        JOIN product_catalog pcat_m ON pcat_m.catalog_id = br_m.catalog_id
       WHERE br_m.customer_id = c.customer_id
         AND pcat_m.material_code IN (${f.materialCodes.map(() => '?').join(',')})
    )`);
    params.push(...f.materialCodes);
  }
  if (f.excludeMaterialCodes && f.excludeMaterialCodes.length > 0) {
    parts.push(`NOT EXISTS (
      SELECT 1 FROM billing_records br_mx
        JOIN product_catalog pcat_mx ON pcat_mx.catalog_id = br_mx.catalog_id
       WHERE br_mx.customer_id = c.customer_id
         AND pcat_mx.material_code IN (${f.excludeMaterialCodes.map(() => '?').join(',')})
    )`);
    params.push(...f.excludeMaterialCodes);
  }
  // Incompatibilidades legales TOTALES (matriz de conflictos OC): se excluye la
  // ENTIDAD COMPLETA — si CUALQUIER registro SAP de la organización facturó un material
  // incompatible, ningún registro de esa organización puede aparecer (cumplimiento
  // legal; a diferencia de excludeMaterialCodes, que opera registro a registro).
  // Dos NOT EXISTS: el del propio registro (cubre los sueltos, org_id NULL) y el de
  // cualquier hermano de la organización.
  if (f.incompatibleTotalCodes && f.incompatibleTotalCodes.length > 0) {
    const ph = f.incompatibleTotalCodes.map(() => '?').join(',');
    parts.push(`NOT EXISTS (
      SELECT 1 FROM billing_records br_ict
        JOIN product_catalog pcat_ict ON pcat_ict.catalog_id = br_ict.catalog_id
       WHERE br_ict.customer_id = c.customer_id
         AND pcat_ict.material_code IN (${ph})
    )`);
    params.push(...f.incompatibleTotalCodes);
    parts.push(`NOT EXISTS (
      SELECT 1 FROM customer_master c_ict
        JOIN billing_records br_ict2 ON br_ict2.customer_id = c_ict.customer_id
        JOIN product_catalog pcat_ict2 ON pcat_ict2.catalog_id = br_ict2.catalog_id
       WHERE c_ict.org_id = c.org_id
         AND pcat_ict2.material_code IN (${ph})
    )`);
    params.push(...f.incompatibleTotalCodes);
  }
  // Divisiones CNAE (customer_cnae × cnae_catalog) — multi, exacto.
  // Positivo (clasificado en alguna) y negativo (no clasificado en ninguna; los
  // clientes SIN CNAE también pasan el negativo, igual que en materiales/CC).
  if (f.cnaeCodes && f.cnaeCodes.length > 0) {
    parts.push(`EXISTS (
      SELECT 1 FROM customer_cnae cc_cn
        JOIN cnae_catalog cat_cn ON cat_cn.cnae_id = cc_cn.cnae_id
       WHERE cc_cn.customer_id = c.customer_id
         AND cat_cn.cnae_code IN (${f.cnaeCodes.map(() => '?').join(',')})
    )`);
    params.push(...f.cnaeCodes);
  }
  if (f.excludeCnaeCodes && f.excludeCnaeCodes.length > 0) {
    parts.push(`NOT EXISTS (
      SELECT 1 FROM customer_cnae cc_cnx
        JOIN cnae_catalog cat_cnx ON cat_cnx.cnae_id = cc_cnx.cnae_id
       WHERE cc_cnx.customer_id = c.customer_id
         AND cat_cnx.cnae_code IN (${f.excludeCnaeCodes.map(() => '?').join(',')})
    )`);
    params.push(...f.excludeCnaeCodes);
  }
  return {
    clause: parts.length > 0 ? `WHERE ${parts.join(' AND ')}` : '',
    params,
  };
}

/**
 * Aplica el alcance RLS de `allowedFilters` (listas blancas por dimensión)
 * intersectándolo con los filtros pedidos por el usuario. Devuelve un objeto
 * NUEVO (no muta el argumento, que además es la clave de caché de la función).
 * El sentinela `FORCED_EMPTY` (ver lib/access) fuerza un resultado vacío cuando el
 * usuario no tiene acceso a ningún valor de los pedidos.
 */
function applyAllowedFilters(opts: CustomerSearchOpts): CustomerSearchOpts {
  const f: AllowedFilters | undefined = opts.allowedFilters;
  if (!f) return opts;
  const o: CustomerSearchOpts = { ...opts };
  // Cada dimensión: si el usuario pidió valores, se intersecan con la lista blanca;
  // si no pidió nada, se restringe a la lista blanca (salvo acceso total). Si la
  // intersección queda vacía, se inyecta el sentinela para forzar 0 resultados.
  if (f.ccaas !== undefined) {
    const allowed = f.ccaas;
    const isFullAccess = allowed.length === CCAAS.length;
    o.ccaas = o.ccaas ? o.ccaas.filter(c => allowed.includes(c)) : (isFullAccess ? undefined : allowed);
    if (o.ccaas && o.ccaas.length === 0) o.ccaas = [FORCED_EMPTY];
  }
  if (f.provinces !== undefined) {
    const allowed = f.provinces;
    const isFullAccess = allowed.length === PROVINCES.length;
    o.provinces = o.provinces ? o.provinces.filter(p => allowed.includes(p)) : (isFullAccess ? undefined : allowed);
    if (o.provinces && o.provinces.length === 0) o.provinces = [FORCED_EMPTY];
  }
  if (f.entityTypes !== undefined) {
    const allowed = f.entityTypes;
    const isFullAccess = allowed.length === ENTITY_TYPES.length;
    o.entityTypes = o.entityTypes ? o.entityTypes.filter(e => allowed.includes(e)) : (isFullAccess ? undefined : allowed);
    if (o.entityTypes && o.entityTypes.length === 0) o.entityTypes = [FORCED_EMPTY];
  }
  if (f.profitCenters !== undefined) {
    const allowed = f.profitCenters;
    const isFullAccess = allowed.length === PROFIT_CENTERS.length;
    o.profitCenterCodes = o.profitCenterCodes ? o.profitCenterCodes.filter(p => allowed.includes(p)) : (isFullAccess ? undefined : allowed);
    if (o.profitCenterCodes && o.profitCenterCodes.length === 0) o.profitCenterCodes = [FORCED_EMPTY];
  }
  if (f.materials !== undefined) {
    const allowed = f.materials;
    const isFullAccess = allowed.length === MATERIALS.length;
    o.materialCodes = o.materialCodes ? o.materialCodes.filter(m => allowed.includes(m)) : (isFullAccess ? undefined : allowed);
    if (o.materialCodes && o.materialCodes.length === 0) o.materialCodes = [FORCED_EMPTY];
  }
  if (f.amountRanges !== undefined) {
    const allowed = f.amountRanges;
    const isFullAccess = allowed.length === AMOUNT_RANGES.length;
    o.amountRanges = o.amountRanges ? o.amountRanges.filter(r => allowed.includes(r)) : (isFullAccess ? undefined : allowed);
    if (o.amountRanges && o.amountRanges.length === 0) o.amountRanges = [FORCED_EMPTY];
  }
  if (f.intercompany !== undefined) {
    const allowed = f.intercompany; // p.ej. ['0', '1']
    if (o.intercompany) {
      if (!allowed.includes(o.intercompany)) o.intercompany = FORCED_EMPTY as '0' | '1';
    } else if (allowed.length === 1) {
      o.intercompany = allowed[0];
    } else if (allowed.length === 0) {
      o.intercompany = FORCED_EMPTY as '0' | '1';
    }
  }
  return o;
}

/**
 * Piezas SQL del lado de facturación (sub-agregado por cliente) compartidas por el
 * Buscador 360 y el modo whitespot: filtros de billing (sociedad/división/activos/
 * material/BU/años), JOIN al árbol organizativo cuando hace falta, y HAVING
 * (minAmount/recurring). Extraído para que ambas vistas no puedan divergir.
 * El orden en que se empujan los parámetros se corresponde con el orden textual
 * de los `?` en `billingFilterClause`.
 */
function buildBillingAggParts(opts: CustomerSearchOpts): {
  billingJoin: string;
  billingFilterClause: string;
  billingParams: unknown[];
  havingSql: string;
  hasBillingFilter: boolean;
} {
  const billingWhere: string[] = [];
  const billingParams: unknown[] = [];

  if (opts.entitySapCodes && opts.entitySapCodes.length > 0) {
    billingWhere.push(`le.sap_code IN (${opts.entitySapCodes.map(() => '?').join(',')})`);
    billingParams.push(...opts.entitySapCodes);
  }
  if (opts.divisionCodes && opts.divisionCodes.length > 0) {
    billingWhere.push(`d.division_code IN (${opts.divisionCodes.map(() => '?').join(',')})`);
    billingParams.push(...opts.divisionCodes);
  }
  if (opts.onlyActive12m) {
    const cutoff = new Date(new Date().getFullYear() - 1, 0, 1);
    billingWhere.push(`br.invoice_date >= ?`);
    billingParams.push(cutoff);
  }
  if (opts.hasCatalogId) {
    billingWhere.push(`br.catalog_id = ?`);
    billingParams.push(opts.hasCatalogId);
  }
  if (opts.buIds && opts.buIds.length > 0) {
    billingWhere.push(`br.bu_id IN (${opts.buIds.map(() => '?').join(',')})`);
    billingParams.push(...opts.buIds);
  } else if (opts.buIds && opts.buIds.length === 0) {
    billingWhere.push(`1 = 0`); // Sin acceso a ninguna BU
  }
  if (opts.fiscalYears && opts.fiscalYears.length > 0) {
    billingWhere.push(`YEAR(br.invoice_date) IN (${opts.fiscalYears.map(() => '?').join(',')})`);
    billingParams.push(...opts.fiscalYears);
  }

  const billingJoin = (opts.entitySapCodes?.length || opts.divisionCodes?.length)
    ? `JOIN business_units bu ON bu.bu_id = br.bu_id
       JOIN legal_entities le ON le.entity_id = bu.entity_id
       JOIN divisions d ON d.division_id = bu.division_id`
    : '';
  const billingFilterClause = billingWhere.length > 0 ? `WHERE ${billingWhere.join(' AND ')}` : '';

  // minAmount/recurring se interpolan como literales numéricos (no parámetros).
  const havingParts: string[] = [];
  if (opts.minAmount && opts.minAmount > 0) havingParts.push(`total_amount >= ${Number(opts.minAmount)}`);
  if (opts.recurringOnly) havingParts.push(`years_active >= 2`);
  const havingSql = havingParts.length > 0 ? `HAVING ${havingParts.join(' AND ')}` : '';

  const hasBillingFilter = !!(
    opts.entitySapCodes?.length || opts.divisionCodes?.length || opts.minAmount ||
    opts.onlyActive12m || opts.hasCatalogId || opts.recurringOnly || opts.buIds ||
    opts.fiscalYears?.length
  );

  return { billingJoin, billingFilterClause, billingParams, havingSql, hasBillingFilter };
}

/**
 * Cláusulas finales compartidas: "missing catalog" (NOT EXISTS) y filtro de rango(s)
 * sobre el total efectivo de la entidad. Devuelve fragmentos prefijados con `AND `
 * (los compone `composeWhereTail`). `missingParams` sigue al resto de parámetros.
 */
function buildTailParts(opts: CustomerSearchOpts): {
  missingClause: string;
  missingParams: unknown[];
  rangeClause: string;
} {
  const missingClause = opts.missingCatalogId
    ? `AND NOT EXISTS (
         SELECT 1 FROM billing_records br_mc
          WHERE br_mc.customer_id = c.customer_id AND br_mc.catalog_id = ?
       )`
    : '';
  const missingParams = opts.missingCatalogId ? [opts.missingCatalogId] : [];

  const validRangeCodes = new Set(AMOUNT_RANGES.map(r => r.code));
  const selectedRanges = (opts.amountRanges ?? []).filter(r => validRangeCodes.has(r));
  const rangeClause = selectedRanges.length > 0
    ? `AND (${sqlRangeCase('COALESCE(agg.total_amount, 0)')}) IN (${selectedRanges.map(r => `'${r}'`).join(',')})`
    : '';

  return { missingClause, missingParams, rangeClause };
}

/** Compone la cola de filtros sobre `customer_master c`: where + missing + range,
 *  promoviendo el primer fragmento a `WHERE` y encadenando el resto con `AND`. */
function composeWhereTail(whereClause: string, missingClause: string, rangeClause: string): string {
  return `
    ${whereClause}
    ${missingClause ? (whereClause ? missingClause : `WHERE ${missingClause.replace(/^AND /, '')}`) : ''}
    ${rangeClause ? (whereClause || missingClause ? rangeClause : `WHERE ${rangeClause.replace(/^AND /, '')}`) : ''}
  `;
}

/**
 * Construye el SELECT del CONJUNTO de clientes filtrados (mismos criterios que el
 * buscador: customer-where + agg de billing + HAVING minAmount/recurring + rango +
 * missing). Devuelve un `SELECT c.customer_id ...` reutilizable como subconsulta.
 *
 * Lo usa el "modo whitespot" para agregar EXACTAMENTE la misma cartera que muestra
 * la tabla. Comparte las piezas sensibles (applyAllowedFilters + buildCustomerWhere),
 * así que filtros y RLS no pueden divergir entre ambas vistas. El armado del agg/
 * HAVING/rango se mantiene en paralelo con `_searchCustomers` (si cambia uno, el otro).
 */
function buildFilteredCustomerIds(rawOpts: CustomerSearchOpts): { sql: string; params: unknown[] } {
  const opts = applyAllowedFilters(rawOpts);
  const where = buildCustomerWhere(opts);
  const { billingJoin, billingFilterClause, billingParams, havingSql, hasBillingFilter } = buildBillingAggParts(opts);
  const { missingClause, missingParams, rangeClause } = buildTailParts(opts);

  // Solo necesitamos total_amount (rango/minAmount) y years_active (recurring) en el agg.
  const aggSubquery = `
    SELECT
      br.customer_id,
      SUM(br.invoice_amount) AS total_amount,
      COUNT(DISTINCT YEAR(br.invoice_date)) AS years_active
    FROM billing_records br
    ${billingJoin}
    ${billingFilterClause}
    GROUP BY br.customer_id
    ${havingSql}
  `;
  const aggJoinType = hasBillingFilter ? 'INNER JOIN' : 'LEFT JOIN';

  const sql = `
    SELECT c.customer_id
    FROM customer_master c
    ${aggJoinType} (${aggSubquery}) agg ON agg.customer_id = c.customer_id
    ${composeWhereTail(where.clause, missingClause, rangeClause)}
  `;
  const params = [...billingParams, ...where.params, ...missingParams];
  return { sql, params };
}

async function _getCustomersAggregates(opts: CustomerSearchOpts): Promise<{ total: number; sumAmount: number }> {
  opts = applyAllowedFilters(opts);
  const group: 'org' | 'sap' = opts.group ?? 'org';
  const EK = (a: string) => `COALESCE(CONCAT('O', ${a}.org_id), CONCAT('C', ${a}.customer_id))`;

  const where = buildCustomerWhere(opts, group);
  const { billingJoin, billingFilterClause, billingParams, havingSql, hasBillingFilter } = buildBillingAggParts(opts);

  const aggKeySelect = group === 'org' ? `${EK('cm')} AS agg_key` : `br.customer_id AS agg_key`;
  const aggKeyGroupBy = group === 'org' ? EK('cm') : `br.customer_id`;
  const aggCustomerJoin = group === 'org' ? `JOIN customer_master cm ON cm.customer_id = br.customer_id` : '';
  const aggSubquery = `
    SELECT
      ${aggKeySelect},
      COUNT(br.billing_id) AS invoice_count,
      SUM(br.invoice_amount) AS total_amount,
      MAX(br.invoice_date) AS last_invoice_date,
      COUNT(DISTINCT br.bu_id) AS bu_count,
      COUNT(DISTINCT YEAR(br.invoice_date)) AS years_active
    FROM billing_records br
    ${aggCustomerJoin}
    ${billingJoin}
    ${billingFilterClause}
    GROUP BY ${aggKeyGroupBy}
    ${havingSql}
  `;

  const aggJoinType = hasBillingFilter ? 'INNER JOIN' : 'LEFT JOIN';
  const aggJoinOn = group === 'org' ? `agg.agg_key = ${EK('c')}` : `agg.agg_key = c.customer_id`;
  const orgJoin = group === 'org' ? `LEFT JOIN organizations o ON o.org_id = c.org_id` : '';

  const { missingClause, missingParams, rangeClause } = buildTailParts(opts);
  const whereTail = composeWhereTail(where.clause, missingClause, rangeClause);

  let countSql: string;
  let countParams: unknown[];
  let sumSql: string;

  if (group === 'org') {
    const entitySet = `
      SELECT ${EK('c')} AS ek, COALESCE(MAX(agg.total_amount), 0) AS total_amount
      FROM customer_master c
      ${orgJoin}
      ${aggJoinType} (${aggSubquery}) agg ON ${aggJoinOn}
      ${whereTail}
      GROUP BY ${EK('c')}
    `;
    countSql = `SELECT COUNT(*) AS total FROM (${entitySet}) t`;
    sumSql = `SELECT COALESCE(SUM(t.total_amount), 0) AS sum_amount FROM (${entitySet}) t`;
    countParams = [...billingParams, ...where.params, ...missingParams];
  } else {
    if (hasBillingFilter || rangeClause || opts.missingCatalogId) {
      countSql = `
        SELECT COUNT(*) AS total FROM customer_master c
        ${aggJoinType} (${aggSubquery}) agg ON ${aggJoinOn}
        ${whereTail}
      `;
      countParams = [...billingParams, ...where.params, ...missingParams];
    } else {
      countSql = `SELECT COUNT(*) AS total FROM customer_master c ${where.clause}`;
      countParams = where.params;
    }
    sumSql = `
      SELECT COALESCE(SUM(COALESCE(agg.total_amount, 0)), 0) AS sum_amount
      FROM customer_master c
      ${aggJoinType} (${aggSubquery}) agg ON ${aggJoinOn}
      ${whereTail}
    `;
  }
  const sumParams = [...billingParams, ...where.params, ...missingParams];

  const [countRows, sumRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ total: number | bigint }>>(countSql, ...countParams),
    prisma.$queryRawUnsafe<Array<{ sum_amount: number | string | bigint }>>(sumSql, ...sumParams),
  ]);

  return {
    total: Number(countRows[0]?.total ?? 0),
    sumAmount: Number(sumRows[0]?.sum_amount ?? 0),
  };
}


import crypto from 'crypto';
const RAM_CACHE = new Map<string, { expires: number; data: unknown }>();
const PENDING_PROMISES = new Map<string, Promise<unknown>>();
// Cota de entradas por proceso: cada (función × combinación de filtros) es una entrada
// y algunas guardan listas grandes (hasta 15k ids). Sin tope, el Map crecía sin límite
// (solo expiraba al re-acceder a una clave) → fuga de memoria. Con cota + LRU + purga de
// expiradas, la memoria queda acotada sin perder el efecto anti-stampede.
const RAM_CACHE_MAX = 200;

function nativeCached<A extends unknown[], R>(fn: (...args: A) => Promise<R>, explicitKey: string): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const hash = crypto.createHash('md5').update(JSON.stringify(args)).digest('hex');
    const key = `${explicitKey}_${hash}`;
    const now = Date.now();
    const hit = RAM_CACHE.get(key);
    if (hit) {
      if (hit.expires > now) {
        // LRU: re-inserta para marcar la entrada como la más reciente (orden del Map).
        RAM_CACHE.delete(key);
        RAM_CACHE.set(key, hit);
        return hit.data as R;
      }
      RAM_CACHE.delete(key); // expirada → fuera
    }

    if (PENDING_PROMISES.has(key)) {
      return PENDING_PROMISES.get(key) as Promise<R>;
    }

    const promise = fn(...args).then(data => {
      RAM_CACHE.set(key, { expires: Date.now() + 300 * 1000, data });
      // Expulsa las entradas más antiguas (las primeras del Map) hasta respetar la cota.
      while (RAM_CACHE.size > RAM_CACHE_MAX) {
        const oldest = RAM_CACHE.keys().next().value;
        if (oldest === undefined) break;
        RAM_CACHE.delete(oldest);
      }
      PENDING_PROMISES.delete(key);
      return data;
    }).catch(err => {
      PENDING_PROMISES.delete(key);
      throw err;
    });

    PENDING_PROMISES.set(key, promise);
    return promise;
  };
}

export const getCustomersAggregates = nativeCached(_getCustomersAggregates, 'getCustomersAggregates');



async function _getSortedCustomerIds(opts: CustomerSearchOpts): Promise<string[]> {
  opts = applyAllowedFilters(opts);
  const group: 'org' | 'sap' = opts.group ?? 'org';
  const EK = (a: string) => `COALESCE(CONCAT('O', ${a}.org_id), CONCAT('C', ${a}.customer_id))`;

  const sortField: SortField = opts.sortField ?? 'totalAmount';
  const sortDir: SortDir = opts.sortDir ?? 'desc';

  const sortColumnSql: Record<SortField, string> = group === 'org'
    ? { legalName: 'legal_name', totalAmount: 'total_amount', lastInvoiceDate: 'last_invoice_date', invoiceCount: 'invoice_count' }
    : { legalName: 'c.legal_name', totalAmount: 'agg.total_amount', lastInvoiceDate: 'agg.last_invoice_date', invoiceCount: 'agg.invoice_count' };

  const where = buildCustomerWhere(opts, group);
  const { billingJoin, billingFilterClause, billingParams, havingSql, hasBillingFilter } = buildBillingAggParts(opts);

  const aggKeySelect = group === 'org' ? `COALESCE(cm.org_id, -br.customer_id) AS agg_key` : `br.customer_id AS agg_key`;
  const aggKeyGroupBy = group === 'org' ? `COALESCE(cm.org_id, -br.customer_id)` : `br.customer_id`;
  const aggCustomerJoin = group === 'org' ? `JOIN customer_master cm ON cm.customer_id = br.customer_id` : '';
  const aggSubquery = `
    SELECT
      ${aggKeySelect},
      COUNT(*) AS invoice_count,
      SUM(br.invoice_amount) AS total_amount,
      MAX(br.invoice_date) AS last_invoice_date,
      COUNT(DISTINCT br.bu_id) AS bu_count,
      COUNT(DISTINCT YEAR(br.invoice_date)) AS years_active
    FROM billing_records br
    ${aggCustomerJoin}
    ${billingJoin}
    ${billingFilterClause}
    GROUP BY ${aggKeyGroupBy}
    ${havingSql}
  `;

  const { missingClause, missingParams, rangeClause } = buildTailParts(opts);
  const whereTail = composeWhereTail(where.clause, missingClause, rangeClause);

  // idAggSubquery groups directly by br.customer_id to leverage index and avoid massive string hashing.
  // Incluye years_active porque havingSql lo referencia cuando se filtra "recurrentes".
  const idAggSubquery = `
    SELECT
      br.customer_id,
      COUNT(*) AS invoice_count,
      SUM(br.invoice_amount) AS total_amount,
      MAX(br.invoice_date) AS last_invoice_date,
      COUNT(DISTINCT YEAR(br.invoice_date)) AS years_active
    FROM billing_records br
    ${billingJoin}
    ${billingFilterClause}
    GROUP BY br.customer_id
    ${havingSql}
  `;

  const aggJoinType = hasBillingFilter ? 'INNER JOIN' : 'LEFT JOIN';

  let idSql: string;

  if (group === 'org') {
    // En modo org el orden/HAVING debe ser sobre el total de la ENTIDAD COMPLETA
    // (lo que muestra la columna "Facturado" y lo que cuenta _getCustomersAggregates),
    // no sobre los registros que pasan los filtros: por eso se usa el agg por entidad
    // (aggSubquery, con clave NUMÉRICA COALESCE(org_id, -customer_id) — sin hashing de
    // strings) y MAX() en el SELECT (todas las filas del grupo llevan el mismo agg).
    idSql = `
      SELECT
        ${EK('c')} AS id,
        MAX(COALESCE(o.legal_name, c.legal_name)) AS legal_name,
        COALESCE(MAX(agg.total_amount), 0) AS total_amount,
        MAX(agg.last_invoice_date) AS last_invoice_date,
        COALESCE(MAX(agg.invoice_count), 0) AS invoice_count
      FROM customer_master c
      LEFT JOIN organizations o ON o.org_id = c.org_id
      ${aggJoinType} (${aggSubquery}) agg ON agg.agg_key = COALESCE(c.org_id, -c.customer_id)
      ${whereTail}
      GROUP BY ${EK('c')}
      ORDER BY ${sortColumnSql[sortField]} ${sortDir === 'asc' ? 'ASC' : 'DESC'}
      ${opts.exportAll ? '' : 'LIMIT 15000'}
    `;
  } else {
    idSql = `
      SELECT
        CAST(c.customer_id AS CHAR) AS id,
        c.legal_name,
        COALESCE(agg.total_amount, 0) AS total_amount,
        agg.last_invoice_date,
        COALESCE(agg.invoice_count, 0) AS invoice_count,
        SUM(COALESCE(agg.total_amount, 0)) OVER(PARTITION BY COALESCE(c.org_id, -c.customer_id)) AS org_total_amount,
        MAX(c.legal_name) OVER(PARTITION BY COALESCE(c.org_id, -c.customer_id)) AS org_legal_name,
        MAX(agg.last_invoice_date) OVER(PARTITION BY COALESCE(c.org_id, -c.customer_id)) AS org_last_invoice_date,
        SUM(COALESCE(agg.invoice_count, 0)) OVER(PARTITION BY COALESCE(c.org_id, -c.customer_id)) AS org_invoice_count
      FROM customer_master c
      ${aggJoinType} (${idAggSubquery}) agg ON agg.customer_id = c.customer_id
      ${whereTail}
      ORDER BY 
        org_${sortColumnSql[sortField].replace('c.', '').replace('agg.', '')} ${sortDir === 'asc' ? 'ASC' : 'DESC'}, 
        ${sortColumnSql[sortField]} ${sortDir === 'asc' ? 'ASC' : 'DESC'}
      ${opts.exportAll ? '' : 'LIMIT 15000'}
    `;
  }

  const idParams = [...billingParams, ...where.params, ...missingParams];
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string | number }>>(idSql, ...idParams);
  return rows.map(r => String(r.id));
}

export const getSortedCustomerIds = nativeCached(_getSortedCustomerIds, 'getSortedCustomerIds');

/**
 * Query principal del buscador 360.
 *
 * Estrategia: subquery con agregaciones por customer_id + paginación + JOIN con customer_master
 * + addresses (LEFT) para datos de dirección.
 */
export async function searchCustomersUncached(opts: CustomerSearchOpts): Promise<CustomerSearchResult> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(1_000_000, Math.max(1, opts.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const sortField: SortField = opts.sortField ?? 'totalAmount';
  const sortDir: SortDir = opts.sortDir ?? 'desc';

  // Aplica el alcance RLS de allowedFilters (devuelve copia; no muta el opts original).
  opts = applyAllowedFilters(opts);

  // Incompatibilidades legales (matriz de conflictos OC): derivadas de los materiales
  // EFECTIVOS (post-RLS). Los códigos derivados viajan dentro de opts → forman parte
  // de las claves de caché de las funciones internas.
  const inc = await resolveIncompatibilities(opts.materialCodes?.filter(m => m !== FORCED_EMPTY));
  if (inc) {
    opts = {
      ...opts,
      incompatibleTotalCodes: inc.totalCodes.length > 0 ? inc.totalCodes : undefined,
      incompatiblePartialCodes: inc.partialCodes.length > 0 ? inc.partialCodes : undefined,
    };
  }

  // Modo de agrupación: 'org' (Golden Record, por defecto) agrupa los registros SAP de un
  // mismo CIF en una sola fila; 'sap' mantiene una fila por registro SAP.
  const group: 'org' | 'sap' = opts.group ?? 'org';
  // Clave de entidad de negocio: organización (si org_id) o registro SAP suelto.
  const EK = (a: string) => `COALESCE(CONCAT('O', ${a}.org_id), CONCAT('C', ${a}.customer_id))`;

  // En modo 'org' el ORDER BY usa los alias del SELECT agregado; en 'sap' las columnas crudas.
  const sortColumnSql: Record<SortField, string> = group === 'org'
    ? { legalName: 'legal_name', totalAmount: 'total_amount', lastInvoiceDate: 'last_invoice_date', invoiceCount: 'invoice_count' }
    : { legalName: 'c.legal_name', totalAmount: 'agg.total_amount', lastInvoiceDate: 'agg.last_invoice_date', invoiceCount: 'agg.invoice_count' };

  // Construir filtros del lado de customers
  const where = buildCustomerWhere(opts, group);

  // ─── Piezas del lado de billing (compartidas con el modo whitespot). ───
  // El rango NO va en el HAVING: se aplica fuera, sobre COALESCE(agg.total_amount,0),
  // para que multi-rango y 'r0' (sin facturar) convivan sin conflicto INNER/LEFT.
  const { billingJoin, billingFilterClause, billingParams, havingSql, hasBillingFilter } = buildBillingAggParts(opts);

  // Subquery: agregado de billing. La clave depende del modo:
  //  - 'sap': por customer_id (índice de cobertura, rápido).
  //  - 'org': por entity_key (requiere JOIN a customer_master para resolver org_id).
  const aggKeySelect = group === 'org' ? `${EK('cm')} AS agg_key` : `br.customer_id AS agg_key`;
  const aggKeyGroupBy = group === 'org' ? EK('cm') : `br.customer_id`;
  const aggCustomerJoin = group === 'org' ? `JOIN customer_master cm ON cm.customer_id = br.customer_id` : '';
  const aggSubquery = `
    SELECT
      ${aggKeySelect},
      COUNT(br.billing_id) AS invoice_count,
      SUM(br.invoice_amount) AS total_amount,
      MAX(br.invoice_date) AS last_invoice_date,
      COUNT(DISTINCT br.bu_id) AS bu_count,
      COUNT(DISTINCT YEAR(br.invoice_date)) AS years_active
    FROM billing_records br
    ${aggCustomerJoin}
    ${billingJoin}
    ${billingFilterClause}
    GROUP BY ${aggKeyGroupBy}
    ${havingSql}
  `;

  // Si hay filtros de billing/agg, sólo mostramos clientes con billing match → INNER JOIN.
  const aggJoinType = hasBillingFilter ? 'INNER JOIN' : 'LEFT JOIN';
  const aggJoinOn = group === 'org' ? `agg.agg_key = ${EK('c')}` : `agg.agg_key = c.customer_id`;
  // En modo 'org' se necesita la organización para resolver nombre/CIF de la entidad.
  const orgJoin = group === 'org' ? `LEFT JOIN organizations o ON o.org_id = c.org_id` : '';

  // ─── Missing catalog (NOT EXISTS) + rango sobre el total efectivo (compartidas). ───
  const { page: _p2, pageSize: _ps2, ...idOpts } = opts;
  const { page: _p, pageSize: _ps, sortField: _sf, sortDir: _sd, ...aggOpts } = opts;

  // Conteo del banner de incompatibilidades: cuántas entidades cumplían el resto de
  // filtros pero caen por el conflicto TOTAL = total SIN exclusión − total CON exclusión.
  const hasExclusion = !!(inc && inc.totalCodes.length > 0);
  const { incompatibleTotalCodes: _it, incompatiblePartialCodes: _ip, ...baseAggOpts } = aggOpts;

  // Obtenemos los totales agregados y toda la proyección de IDs ordenados
  const [{ total, sumAmount }, allIds, baseAgg] = await Promise.all([
    getCustomersAggregates(aggOpts as CustomerSearchOpts),
    getSortedCustomerIds(idOpts as CustomerSearchOpts),
    hasExclusion ? getCustomersAggregates(baseAggOpts as CustomerSearchOpts) : Promise.resolve(null),
  ]);

  const incompatibility: CustomerSearchIncompatibility | undefined = inc
    ? { excludedCount: baseAgg ? Math.max(0, baseAgg.total - total) : 0, pairs: inc.pairs }
    : undefined;

  const pageIds = allIds.slice(offset, offset + pageSize);

  if (pageIds.length === 0) {
    return { rows: [], total, page, pageSize, sumAmount, incompatibility };
  }

  const ekInList = pageIds.map(id => `'${id}'`).join(',');
  const idInList = pageIds.join(',');

  const orgIds = pageIds.filter(id => id.startsWith('O')).map(id => id.slice(1));
  const sapIds = pageIds.filter(id => id.startsWith('C')).map(id => id.slice(1));
  
  const cmOrgCond = orgIds.length > 0 ? `cm.org_id IN (${orgIds.join(',')})` : '1=0';
  const cmSapCond = sapIds.length > 0 ? `(cm.org_id IS NULL AND cm.customer_id IN (${sapIds.join(',')}))` : '1=0';

  // CONDITIONAL PUSHDOWN: we inject the ID filter INSIDE the grouping subquery!
  const pushdownFilter = group === 'org' ? `(${cmOrgCond} OR ${cmSapCond})` : `br.customer_id IN (${idInList})`;
  const pushdownClause = hasBillingFilter 
    ? `AND ${pushdownFilter}` 
    : `WHERE ${pushdownFilter}`;

  const addrOrgCond = orgIds.length > 0 ? `c_addr.org_id IN (${orgIds.join(',')})` : '1=0';
  const addrSapCond = sapIds.length > 0 ? `(c_addr.org_id IS NULL AND c_addr.customer_id IN (${sapIds.join(',')}))` : '1=0';

  const addrPushdownFilter = group === 'org' ? `(${addrOrgCond} OR ${addrSapCond})` : `c_addr.customer_id IN (${idInList})`;
  const addrSubquery = `
    SELECT a.customer_id, MIN(a.address_id) AS first_addr_id
    FROM addresses a
    INNER JOIN customer_master c_addr ON c_addr.customer_id = a.customer_id
    WHERE ${addrPushdownFilter}
    GROUP BY a.customer_id
  `;

  const dataAggSubquery = `
    SELECT
      ${aggKeySelect},
      COUNT(*) AS invoice_count,
      SUM(br.invoice_amount) AS total_amount,
      MAX(br.invoice_date) AS last_invoice_date,
      COUNT(DISTINCT br.bu_id) AS bu_count,
      COUNT(DISTINCT YEAR(br.invoice_date)) AS years_active
    FROM billing_records br
    ${aggCustomerJoin}
    ${billingJoin}
    ${billingFilterClause}
    ${pushdownClause}
    GROUP BY ${aggKeyGroupBy}
    ${havingSql}
  `;

  let dataSql: string;
  const dataParams: unknown[] = [...billingParams]; // Ya no necesitamos whereParams ni missingParams para la db, el ID restringe todo

  if (group === 'org') {
    dataSql = `
      SELECT
        MIN(c.customer_id) AS customer_id,
        ${EK('c')} AS entity_key,
        MAX(c.org_id) AS org_id,
        COUNT(DISTINCT c.customer_id) AS sap_count,
        MAX(COALESCE(o.legal_name, c.legal_name)) AS legal_name,
        MAX(COALESCE(o.tax_id, c.tax_id)) AS tax_id,
        CASE WHEN MAX(c.org_id) IS NOT NULL THEN NULL ELSE MAX(c.sap_customer_code) END AS sap_customer_code,
        MAX(addr.city) AS city,
        MAX(addr.postal_code) AS postal_code,
        COALESCE(MAX(agg.invoice_count), 0) AS invoice_count,
        COALESCE(MAX(agg.total_amount), 0) AS total_amount,
        MAX(agg.last_invoice_date) AS last_invoice_date,
        COALESCE(MAX(agg.bu_count), 0) AS bu_count,
        COALESCE(MAX(agg.years_active), 0) AS years_active,
        MAX(${SQL_ENTITY_TYPE_EXPR}) AS entity_type,
        MAX(${SQL_INTERCOMPANY_EXPR}) AS is_intercompany,
        CASE WHEN MAX(COALESCE(o.legal_name, c.legal_name)) LIKE '%BLOCKED%'
                  OR MAX(COALESCE(o.tax_id, c.tax_id)) = 'Not assigned' THEN 1 ELSE 0 END AS is_blocked
      FROM customer_master c
      ${orgJoin}
      ${aggJoinType} (${dataAggSubquery}) agg ON ${aggJoinOn}
      LEFT JOIN (${addrSubquery}) addr_pick ON addr_pick.customer_id = c.customer_id
      LEFT JOIN addresses addr ON addr.address_id = addr_pick.first_addr_id
      WHERE ${orgIds.length > 0 ? `c.org_id IN (${orgIds.join(',')})` : '1=0'} OR ${sapIds.length > 0 ? `(c.org_id IS NULL AND c.customer_id IN (${sapIds.join(',')}))` : '1=0'}
      GROUP BY ${EK('c')}
      ORDER BY ${sortColumnSql[sortField]} ${sortDir === 'asc' ? 'ASC' : 'DESC'}
    `;
  } else {
    dataSql = `
      SELECT
        c.customer_id,
        ${EK('c')} AS entity_key,
        c.org_id,
        1 AS sap_count,
        c.legal_name,
        c.tax_id,
        c.sap_customer_code,
        addr.city,
        addr.postal_code,
        COALESCE(agg.invoice_count, 0) AS invoice_count,
        COALESCE(agg.total_amount, 0) AS total_amount,
        agg.last_invoice_date,
        COALESCE(agg.bu_count, 0) AS bu_count,
        COALESCE(agg.years_active, 0) AS years_active,
        (${SQL_ENTITY_TYPE_EXPR}) AS entity_type,
        (${SQL_INTERCOMPANY_EXPR}) AS is_intercompany,
        CASE WHEN c.legal_name LIKE '%BLOCKED%' OR c.tax_id = 'Not assigned' THEN 1 ELSE 0 END AS is_blocked
      FROM customer_master c
      ${aggJoinType} (${dataAggSubquery}) agg ON ${aggJoinOn}
      LEFT JOIN (${addrSubquery}) addr_pick ON addr_pick.customer_id = c.customer_id
      LEFT JOIN addresses addr ON addr.address_id = addr_pick.first_addr_id
      WHERE c.customer_id IN (${idInList})
      ORDER BY ${sortColumnSql[sortField]} ${sortDir === 'asc' ? 'ASC' : 'DESC'}
    `;
  }

  type Raw = {
    customer_id: number | bigint;
    entity_key: string;
    org_id: number | bigint | null;
    sap_count: number | bigint;
    legal_name: string;
    tax_id: string | null;
    sap_customer_code: string | null;
    city: string | null;
    postal_code: string | null;
    invoice_count: number | bigint;
    total_amount: number | string;
    last_invoice_date: Date | null;
    bu_count: number | bigint;
    years_active: number | bigint;
    entity_type: string;
    is_intercompany: number | bigint;
    is_blocked: number | bigint;
  };

  const rawRows = await prisma.$queryRawUnsafe<Raw[]>(dataSql, ...dataParams);

  // Marca de incompatibilidad PARCIAL por fila: entidades de la página que facturan
  // algún material con conflicto parcial (a nivel organización, igual que la exclusión).
  let partialEks: Set<string> | null = null;
  if (inc && inc.partialCodes.length > 0) {
    const ph = inc.partialCodes.map(() => '?').join(',');
    const orgCond = orgIds.length > 0 ? `c_par.org_id IN (${orgIds.join(',')})` : '1=0';
    const sapCond = sapIds.length > 0 ? `(c_par.org_id IS NULL AND c_par.customer_id IN (${sapIds.join(',')}))` : '1=0';
    const partialRows = await prisma.$queryRawUnsafe<Array<{ ek: string }>>(`
      SELECT DISTINCT COALESCE(CONCAT('O', c_par.org_id), CONCAT('C', c_par.customer_id)) AS ek
        FROM billing_records br_par
        JOIN product_catalog pcat_par ON pcat_par.catalog_id = br_par.catalog_id
        JOIN customer_master c_par ON c_par.customer_id = br_par.customer_id
       WHERE pcat_par.material_code IN (${ph})
         AND (${orgCond} OR ${sapCond})
    `, ...inc.partialCodes);
    partialEks = new Set(partialRows.map(r => r.ek));
  }

  const rows: CustomerSearchRow[] = rawRows.map(r => {
    const pc2 = r.postal_code ? r.postal_code.slice(0, 2) : null;
    const province = pc2 ? (PROVINCE_BY_PC2[pc2] ?? null) : null;
    const ccaa = province ? (CCAA_BY_PROVINCE[province] ?? null) : null;
    return {
      customerId: Number(r.customer_id),
      entityKey: r.entity_key,
      orgId: r.org_id != null ? Number(r.org_id) : null,
      sapCount: Number(r.sap_count),
      legalName: r.legal_name,
      taxId: r.tax_id ?? '',
      sapCustomerCode: r.sap_customer_code,
      city: r.city,
      province,
      ccaa,
      invoiceCount: Number(r.invoice_count),
      totalAmount: Number(r.total_amount),
      lastInvoiceDate: r.last_invoice_date,
      buCount: Number(r.bu_count),
      yearsActive: Number(r.years_active),
      entityType: r.entity_type,
      isIntercompany: Number(r.is_intercompany) === 1,
      isBlocked: Number(r.is_blocked) === 1,
      ...(partialEks ? { hasPartialConflict: partialEks.has(r.entity_key) } : {}),
    };
  });

  return {
    rows,
    total,
    page,
    pageSize,
    sumAmount,
    incompatibility,
  };
}

/**
 * Modo whitespot del buscador: facturación agregada por sociedad → BU sobre TODO
 * el conjunto de clientes filtrados (no solo la página).
 *
 * Parte del catálogo de BUs (dentro del alcance del usuario) y le hace LEFT JOIN
 * con la facturación de los clientes filtrados → las BUs sin facturación quedan a 0
 * y se muestran como whitespots (oportunidad de cross-sell de la cartera).
 *
 * La facturación contada respeta los mismos filtros que la tabla: sociedad/división
 * (acotan qué BUs se muestran) y "activos 12m" (acota qué facturación suma), de modo
 * que los totales cuadran con la columna "Facturado" del buscador.
 */
async function _getPortfolioWhitespots(opts: CustomerSearchOpts): Promise<PortfolioWhitespots> {
  const resolved = applyAllowedFilters(opts);

  // Incompatibilidades legales: la cartera del whitespot excluye también a los clientes
  // con conflicto TOTAL (no se sugiere cross-sell legalmente prohibido).
  const inc = await resolveIncompatibilities(resolved.materialCodes?.filter(m => m !== FORCED_EMPTY));
  if (inc && inc.totalCodes.length > 0) {
    opts = { ...opts, incompatibleTotalCodes: inc.totalCodes };
  }

  // Subconsulta: los clientes que pasan TODOS los filtros (misma cartera que la tabla).
  const filtered = buildFilteredCustomerIds(opts);

  // ─── Lado catálogo de BUs: alcance (RLS por bu_id) + sociedad/división seleccionadas ───
  const catWhere: string[] = [];
  const catParams: unknown[] = [];
  if (resolved.buIds && resolved.buIds.length > 0) {
    catWhere.push(`bu.bu_id IN (${resolved.buIds.map(() => '?').join(',')})`);
    catParams.push(...resolved.buIds);
  } else if (resolved.buIds && resolved.buIds.length === 0) {
    catWhere.push(`1 = 0`); // sin acceso a ninguna BU
  }
  if (resolved.entitySapCodes && resolved.entitySapCodes.length > 0) {
    catWhere.push(`le.sap_code IN (${resolved.entitySapCodes.map(() => '?').join(',')})`);
    catParams.push(...resolved.entitySapCodes);
  }
  if (resolved.divisionCodes && resolved.divisionCodes.length > 0) {
    catWhere.push(`d.division_code IN (${resolved.divisionCodes.map(() => '?').join(',')})`);
    catParams.push(...resolved.divisionCodes);
  }
  const catWhereClause = catWhere.length > 0 ? `WHERE ${catWhere.join(' AND ')}` : '';

  // "Activos 12m" acota qué facturación suma (en el ON, para no perder la BU como whitespot).
  const activeExtra: string[] = [];
  const activeParams: unknown[] = [];
  if (resolved.onlyActive12m) {
    const cutoff = new Date(new Date().getFullYear() - 1, 0, 1);
    activeExtra.push(`AND br.invoice_date >= ?`);
    activeParams.push(cutoff);
  }

  const sql = `
    SELECT
      le.sap_code,
      le.legal_name,
      bu.bu_id,
      bu.bu_name,
      bu.bu_code,
      d.division_code,
      COALESCE(SUM(br.invoice_amount), 0) AS total,
      COUNT(br.billing_id) AS n,
      COUNT(DISTINCT br.customer_id) AS customers
    FROM business_units bu
    JOIN legal_entities le ON le.entity_id = bu.entity_id
    JOIN divisions d ON d.division_id = bu.division_id
    LEFT JOIN (
      SELECT br_i.bu_id, br_i.invoice_amount, br_i.billing_id, br_i.customer_id
      FROM billing_records br_i
      JOIN (${filtered.sql}) f ON br_i.customer_id = f.customer_id
      ${activeExtra.length > 0 ? 'WHERE ' + activeExtra.map(s => s.replace(/^AND\s+/i, '')).join(' AND ') : ''}
    ) br ON br.bu_id = bu.bu_id
    ${catWhereClause}
    GROUP BY le.sap_code, le.legal_name, bu.bu_id, bu.bu_name, bu.bu_code, d.division_code
    ORDER BY le.sap_code ASC, total DESC
  `;

  // Orden de params = orden textual de los '?': subconsulta filtrada → activos12m → catálogo.
  const params = [...filtered.params, ...activeParams, ...catParams];

  type Raw = {
    sap_code: string;
    legal_name: string;
    bu_id: number | bigint;
    bu_name: string;
    bu_code: string;
    division_code: string;
    total: number | string;
    n: number | bigint;
    customers: number | bigint;
  };

  const raw = await prisma.$queryRawUnsafe<Raw[]>(sql, ...params);

  // Agrupar por sociedad.
  const map = new Map<string, PortfolioSociety>();
  for (const r of raw) {
    const total = Number(r.total);
    const isActive = total > 0;
    let soc = map.get(r.sap_code);
    if (!soc) {
      soc = { sapCode: r.sap_code, legalName: r.legal_name, total: 0, activeCount: 0, totalBus: 0, bus: [] };
      map.set(r.sap_code, soc);
    }
    soc.bus.push({
      buId: Number(r.bu_id),
      buName: r.bu_name,
      buCode: r.bu_code,
      divisionCode: r.division_code,
      total,
      customers: Number(r.customers),
      count: Number(r.n),
      isActive,
    });
    soc.total += total;
    soc.totalBus += 1;
    if (isActive) soc.activeCount += 1;
  }

  const societies = [...map.values()]
    .map(s => ({ ...s, bus: s.bus.sort((a, b) => b.total - a.total) }))
    .sort((a, b) => b.total - a.total);

  return {
    societies,
    grandTotal: societies.reduce((s, x) => s + x.total, 0),
    activeBus: societies.reduce((s, x) => s + x.activeCount, 0),
    totalBus: societies.reduce((s, x) => s + x.totalBus, 0),
  };
}

/** Catálogos para los selects de filtros (cacheable). */
async function _getFilterCatalogs(buIds?: number[], allowedFilters?: AllowedFilters) {
  const buFilter = buIds && buIds.length > 0 ? { businessUnits: { some: { buId: { in: buIds } } } } : {};
  const buIdFilter = buIds && buIds.length > 0 ? { buId: { in: buIds } } : {};
  
  const [entities, divisions, buRelations, yearRows, cnaeRows] = await Promise.all([
    prisma.legalEntity.findMany({
      where: buFilter,
      select: { sapCode: true, legalName: true },
      orderBy: { sapCode: 'asc' },
    }),
    prisma.division.findMany({
      where: buFilter,
      select: { divisionCode: true, divisionName: true },
      orderBy: { divisionCode: 'asc' },
    }),
    // Mapa sociedad→divisiones para filtrado en cascada
    prisma.businessUnit.findMany({
      where: buIdFilter,
      select: {
        entity: { select: { sapCode: true } },
        division: { select: { divisionCode: true } },
      },
    }),
    // Años con facturación (dimensión temporal global; no se acota por BU).
    // DISTINCT YEAR sobre ~935k filas apoyado en idx invoice_date; cacheado con el resto.
    prisma.$queryRaw<Array<{ year: number | bigint }>>`
      SELECT DISTINCT YEAR(invoice_date) AS year
      FROM BILLING_RECORDS
      WHERE invoice_date IS NOT NULL
      ORDER BY year DESC
    `,
    // Divisiones CNAE-2009 para el filtro sectorial.
    prisma.cnaeCatalog.findMany({
      select: { cnaeCode: true, cnaeName: true },
      orderBy: { cnaeCode: 'asc' },
    }),
  ]);

  // CNAE: divisiones reales en orden; '96' (mayoritariamente default de SAP) y '999'
  // (sin clasificar) al final y señaladas, para que quien filtre sepa qué selecciona.
  const cnaes: Array<{ code: string; name: string }> = [
    ...cnaeRows.filter(c => c.cnaeCode !== '96' && c.cnaeCode !== '999')
      .map(c => ({ code: c.cnaeCode, name: c.cnaeName })),
    ...cnaeRows.filter(c => c.cnaeCode === '96')
      .map(c => ({ code: c.cnaeCode, name: `${c.cnaeName} (⚠ posible default SAP)` })),
    ...cnaeRows.filter(c => c.cnaeCode === '999')
      .map(c => ({ code: c.cnaeCode, name: c.cnaeName })),
  ];
  
  // Construir mapa: { "8888": ["II","MO","NON"], "0136": ["BA","II","NON"], ... }
  const entityDivisionMap: Record<string, string[]> = {};
  for (const bu of buRelations) {
    const sapCode = bu.entity.sapCode;
    const divCode = bu.division.divisionCode;
    if (!entityDivisionMap[sapCode]) entityDivisionMap[sapCode] = [];
    if (!entityDivisionMap[sapCode].includes(divCode)) {
      entityDivisionMap[sapCode].push(divCode);
    }
  }
  
  const f: AllowedFilters = allowedFilters ?? {};
  const years = yearRows.map(r => Number(r.year));
  return {
    entities,
    divisions,
    entityDivisionMap,
    years,
    cnaes,
    ccaas: f.ccaas ? CCAAS.filter(c => f.ccaas!.includes(c)) : CCAAS,
    provinces: f.provinces ? PROVINCES.filter(p => f.provinces!.includes(p)) : PROVINCES,
    entityTypes: f.entityTypes ? ENTITY_TYPES.filter(e => f.entityTypes!.includes(e.code)) : ENTITY_TYPES,
    profitCenters: f.profitCenters ? PROFIT_CENTERS.filter(p => f.profitCenters!.includes(p.code)) : PROFIT_CENTERS,
    materials: f.materials ? MATERIALS.filter(m => f.materials!.includes(m.code)) : MATERIALS,
    amountRanges: f.amountRanges ?? AMOUNT_RANGES.map(r => r.code),
    intercompany: f.intercompany ?? ['0', '1'],
  };
}

// ─── Versiones cacheadas (tag 'billing', TTL 5 min). ───
const antiStampedeSearchCustomers = nativeCached(searchCustomersUncached, 'searchCustomersUncached');
export const searchCustomers = cached(antiStampedeSearchCustomers, ['customers:searchCustomers']);

export const getFilterCatalogs = cached(_getFilterCatalogs, ['customers:getFilterCatalogs']);
export const getPortfolioWhitespots = cached(_getPortfolioWhitespots, ['customers:getPortfolioWhitespots']);

export type OpportunityMatrixResult = {
  rows: {
    entityKey: string;
    customerId: number;
    legalName: string;
    taxId: string | null;
    sapCustomerCode: string | null;
    amounts: Record<string, number>;
    total: number;
  }[];
  materialColumns: { materialCode: string; description: string; totalAmount: number }[];
  total: number;
  page: number;
  pageSize: number;
  sumAmount: number;
};

async function _getOpportunitiesMatrix(rawOpts: CustomerSearchOpts): Promise<OpportunityMatrixResult> {
  const opts = applyAllowedFilters(rawOpts);
  const page = opts.page || 1;
  const pageSize = opts.pageSize || 100;
  
  const group: 'org' | 'sap' = opts.group ?? 'org';

  const { page: _p, pageSize: _ps, sortField: _sf, sortDir: _sd, ...aggOpts } = opts;
  const idOpts = { ...aggOpts, sortField: opts.sortField, sortDir: opts.sortDir };

  const [{ total, sumAmount }, allIds] = await Promise.all([
    getCustomersAggregates(aggOpts as CustomerSearchOpts),
    getSortedCustomerIds(idOpts as CustomerSearchOpts),
  ]);

  const offset = (page - 1) * pageSize;
  const pageIds = allIds.slice(offset, offset + pageSize);

  if (pageIds.length === 0) {
    return { rows: [], materialColumns: [], total, page, pageSize, sumAmount };
  }

  let orgIds: number[] = [];
  let sapIds: number[] = [];

  if (group === 'org') {
    orgIds = pageIds.filter(id => id.startsWith('O')).map(id => Number(id.slice(1))).filter(n => !isNaN(n));
    sapIds = pageIds.filter(id => id.startsWith('C')).map(id => Number(id.slice(1))).filter(n => !isNaN(n));
  } else {
    sapIds = pageIds.map(Number).filter(n => !isNaN(n));
  }

  // Resolvemos la información de cliente primero, para aislar los customer_ids
  // y forzar a MySQL a usar el índice de customer_id en la tabla billing_records.
  const cmRows = await prisma.customerMaster.findMany({
    where: group === 'org' ? {
      OR: [
        { orgId: { in: orgIds.length > 0 ? orgIds : [0] } },
        { AND: [ { orgId: null }, { customerId: { in: sapIds.length > 0 ? sapIds : [0] } } ] }
      ]
    } : {
      customerId: { in: sapIds.length > 0 ? sapIds : [0] }
    },
    // include fijo (no condicional) para que Prisma tipe la relación `org`;
    // en modo 'sap' el LEFT JOIN extra es inocuo.
    include: { org: { select: { legalName: true, taxId: true } } },
  });

  const customerIds = cmRows.map(r => r.customerId);

  if (customerIds.length === 0) {
    return { rows: [], materialColumns: [], total, page, pageSize, sumAmount };
  }

  const { billingJoin, billingFilterClause, billingParams } = buildBillingAggParts(opts);
  const baseWhere = billingFilterClause ? billingFilterClause.replace('WHERE', '') + ' AND ' : '';

  const dataSql = `
    SELECT
      br.customer_id,
      p.material_code,
      MAX(p.description_en) AS material_name,
      SUM(br.invoice_amount) AS total_amount
    FROM billing_records br
    JOIN product_catalog p ON p.catalog_id = br.catalog_id
    ${billingJoin}
    WHERE ${baseWhere} br.customer_id IN (${customerIds.join(',')})
    GROUP BY br.customer_id, p.material_code
    HAVING SUM(br.invoice_amount) > 0
  `;

  const flatRows = await prisma.$queryRawUnsafe<Array<{
    customer_id: number;
    material_code: string;
    material_name: string;
    total_amount: number | string;
  }>>(dataSql, ...billingParams);

  const rowMap = new Map<string, OpportunityMatrixResult['rows'][0]>();
  const matMap = new Map<string, { materialCode: string, description: string, totalAmount: number }>();

  for (const cm of cmRows) {
    const ek = group === 'org' 
      ? (cm.orgId ? `O${cm.orgId}` : `C${cm.customerId}`)
      : `${cm.customerId}`;

    const legalName = group === 'org' && cm.org
      ? cm.org.legalName
      : cm.legalName;

    if (!rowMap.has(ek)) {
      rowMap.set(ek, {
        entityKey: ek,
        customerId: cm.customerId,
        legalName: legalName,
        taxId: group === 'org' && 'org' in cm && cm.org ? cm.org.taxId : cm.taxId,
        sapCustomerCode: group === 'org' && 'org' in cm && cm.org ? null : cm.sapCustomerCode,
        amounts: {},
        total: 0
      });
    }
  }

  for (const row of flatRows) {
    const cm = cmRows.find(c => c.customerId === row.customer_id);
    if (!cm) continue;

    const ek = group === 'org' 
      ? (cm.orgId ? `O${cm.orgId}` : `C${cm.customerId}`)
      : `${cm.customerId}`;

    const amount = Number(row.total_amount);
    
    const customerRow = rowMap.get(ek)!;
    customerRow.amounts[row.material_code] = (customerRow.amounts[row.material_code] || 0) + amount;
    customerRow.total += amount;

    if (!matMap.has(row.material_code)) {
      matMap.set(row.material_code, {
        materialCode: row.material_code,
        description: row.material_name || row.material_code,
        totalAmount: 0
      });
    }
    matMap.get(row.material_code)!.totalAmount += amount;
  }

  const sortedRows = pageIds.map(id => rowMap.get(id)).filter(Boolean) as OpportunityMatrixResult['rows'][0][];
  const materialColumns = Array.from(matMap.values()).sort((a, b) => a.description.localeCompare(b.description));

  return {
    rows: sortedRows,
    materialColumns,
    total,
    page,
    pageSize,
    sumAmount
  };
}

export const getOpportunitiesMatrix = _getOpportunitiesMatrix;
export const getOpportunitiesMatrixUncached = _getOpportunitiesMatrix;