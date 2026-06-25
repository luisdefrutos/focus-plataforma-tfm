/**
 * Catálogo de servicios — vista buscable de PRODUCT_CATALOG.
 */

import { searchCatalog, getCatalogCategories } from '@/lib/queries/catalog';
import { getIncompatibilityMap, type MaterialConflict } from '@/lib/queries/incompatibilities';
import { CatalogFilter } from '@/components/catalogo/catalog-filter';
import { formatNumber } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Catálogo | Focus' };
export const dynamic = 'force-dynamic';

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/login');
  }

  const [rows, categories, incompatMap] = await Promise.all([
    searchCatalog({ search: sp.search, category: sp.category }),
    getCatalogCategories(),
    getIncompatibilityMap(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Catálogo de servicios
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          {formatNumber(rows.length)}{rows.length !== 1 ? ' servicios' : ' servicio'} · ordenados por uso (facturas que los referencian).
        </p>
      </div>

      <CatalogFilter categories={categories} />

      {/* Tabla */}
      <div
        className="overflow-hidden rounded-lg border"
        style={{
          background: 'var(--ts-semantic-color-surface-default)',
          borderColor: 'var(--ts-semantic-color-border-base-default)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead
              className="border-b"
              style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
            >
              <tr>
                <Th>Material</Th>
                <Th>Descripción</Th>
                <Th>Producto TÜV</Th>
                <Th>Categoría</Th>
                <Th>Incompatibilidades</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(c => (
                <tr
                  key={c.catalogId}
                  className="border-b transition-colors hover:bg-[var(--ts-semantic-color-background-base-hover)]"
                  style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 align-top">
                    <span
                      className="font-mono text-xs font-medium"
                      style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
                    >
                      {c.materialCode}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
                    >
                      {c.descriptionEs ?? c.descriptionEn}
                    </p>
                    {c.descriptionEs && c.descriptionEn !== c.descriptionEs && (
                      <p
                        className="mt-0.5 text-xs italic"
                        style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                      >
                        EN: {c.descriptionEn}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    {c.productCode ? (
                      <>
                        <p
                          className="font-mono text-xs"
                          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
                        >
                          {c.productCode}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                        >
                          {c.productName}
                        </p>
                      </>
                    ) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 align-top">
                    {c.category && (
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: 'var(--ts-semantic-color-background-primary-subtle-default)',
                          color: 'var(--ts-semantic-color-text-link-default)',
                        }}
                      >
                        {c.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <ConflictChips conflicts={incompatMap.get(c.materialCode) ?? []} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm"
                    style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                  >
                    No hay servicios que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const MAX_CONFLICT_CHIPS = 3;

const SEVERITY_STYLE = {
  TOTAL: {
    symbol: '⛔',
    label: 'total',
    bg: 'var(--ts-semantic-color-background-danger-subtle-default)',
    fg: 'var(--ts-semantic-color-text-danger-default)',
  },
  PARCIAL: {
    symbol: '⚠',
    label: 'parcial',
    bg: 'var(--ts-semantic-color-background-warning-subtle-default)',
    fg: 'var(--ts-semantic-color-text-warning-default)',
  },
} as const;

function conflictTitle(c: MaterialConflict): string {
  return `Incompatibilidad ${SEVERITY_STYLE[c.severity].label.toUpperCase()} con ${c.code}${c.description ? ` — ${c.description}` : ''}`;
}

/** Chips de materiales incompatibles (rojo = TOTAL, ámbar = PARCIAL), con "+N" si hay más. */
function ConflictChips({ conflicts }: { conflicts: MaterialConflict[] }) {
  if (conflicts.length === 0) {
    return <span style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>—</span>;
  }
  const visible = conflicts.slice(0, MAX_CONFLICT_CHIPS);
  const rest = conflicts.slice(MAX_CONFLICT_CHIPS);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map(c => {
        const s = SEVERITY_STYLE[c.severity];
        return (
          <span
            key={c.code}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11px] font-medium"
            style={{ background: s.bg, color: s.fg }}
            title={conflictTitle(c)}
          >
            {s.symbol} {c.code}
          </span>
        );
      })}
      {rest.length > 0 && (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: 'var(--ts-semantic-color-background-neutral-subtle-default)',
            color: 'var(--ts-semantic-color-text-secondary-default)',
          }}
          title={rest.map(conflictTitle).join('\n')}
        >
          +{rest.length}
        </span>
      )}
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
    >
      {children}
    </th>
  );
}