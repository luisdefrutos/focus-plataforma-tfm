/**
 * Queries para /catalogo — exploración del catálogo de servicios.
 */

import { prisma } from '@/lib/prisma';
import { cached } from '@/lib/cache';
import { escapeLike } from '@/lib/sql';

export type CatalogRow = {
  catalogId: number;
  materialCode: string;
  descriptionEn: string;
  descriptionEs: string | null;
  category: string | null;
  serviceCode: string | null;
  serviceName: string | null;
  productCode: string | null;
  productName: string | null;
  /** Cuántas veces se ha facturado este material (proxy de popularidad) */
  usageCount: number;
};

async function _searchCatalog(opts: {
  search?: string;
  category?: string;
}): Promise<CatalogRow[]> {
  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (opts.search) {
    const like = `%${escapeLike(opts.search)}%`;
    whereParts.push(`(
      pc.material_code LIKE ?
      OR pc.description_en LIKE ?
      OR pc.description_es LIKE ?
      OR pc.service_name LIKE ?
      OR pc.product_name LIKE ?
    )`);
    params.push(like, like, like, like, like);
  }
  if (opts.category) {
    whereParts.push(`pc.category = ?`);
    params.push(opts.category);
  }
  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

  type Raw = {
    catalog_id: number | bigint;
    material_code: string;
    description_en: string;
    description_es: string | null;
    category: string | null;
    service_code: string | null;
    service_name: string | null;
    product_code: string | null;
    product_name: string | null;
    usage_count: number | bigint;
  };

  const rows = await prisma.$queryRawUnsafe<Raw[]>(
    `SELECT
       pc.catalog_id, pc.material_code,
       pc.description_en, pc.description_es,
       pc.category, pc.service_code, pc.service_name,
       pc.product_code, pc.product_name,
       COALESCE(u.n, 0) AS usage_count
     FROM product_catalog pc
     LEFT JOIN (
       SELECT catalog_id, COUNT(*) AS n
       FROM billing_records
       GROUP BY catalog_id
     ) u ON u.catalog_id = pc.catalog_id
     ${whereSql}
     ORDER BY usage_count DESC, pc.material_code ASC`,
    ...params,
  );

  return rows.map(r => ({
    catalogId: Number(r.catalog_id),
    materialCode: r.material_code,
    descriptionEn: r.description_en,
    descriptionEs: r.description_es,
    category: r.category,
    serviceCode: r.service_code,
    serviceName: r.service_name,
    productCode: r.product_code,
    productName: r.product_name,
    usageCount: Number(r.usage_count),
  }));
}

async function _getCatalogCategories(): Promise<Array<{ category: string; count: number }>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ category: string; n: number | bigint }>>(
    `SELECT category, COUNT(*) AS n
       FROM product_catalog
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY category`,
  );
  return rows.map(r => ({ category: r.category, count: Number(r.n) }));
}
// ─── Versiones cacheadas (tag 'billing', TTL 5 min). ───
export const searchCatalog = cached(_searchCatalog, ['catalog:searchCatalog']);
export const getCatalogCategories = cached(_getCatalogCategories, ['catalog:getCatalogCategories']);
