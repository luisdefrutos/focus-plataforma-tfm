/**
 * Buscador 360 — lista paginada de clientes con filtros y ordenación server-side.
 *
 * Todos los filtros viven en la URL (?search=&entity=&division=&minAmount=&active12m=...&sort=&dir=&page=)
 * para que la página sea linkable y compartible.
 */

import {
  searchCustomers, getFilterCatalogs, getPortfolioWhitespots,
  type SortField, type SortDir, type CustomerSearchOpts,
} from '@/lib/queries/customers';
import { CustomersTable } from '@/components/buscador/customers-table';
import { FilterBar } from '@/components/buscador/filter-bar';
import { IncompatibilityBanner } from '@/components/buscador/incompatibility-banner';
import { Pagination } from '@/components/buscador/pagination';
import { ViewToggle } from '@/components/buscador/view-toggle';
import { PortfolioWhitespotMap } from '@/components/buscador/portfolio-whitespots';
import { Icon } from '@/components/ui/icon';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';

export const metadata = { title: 'Buscador 360 | Focus' };
export const dynamic = 'force-dynamic';

const VALID_SORTS = new Set<SortField>(['legalName', 'totalAmount', 'lastInvoiceDate', 'invoiceCount']);

// Claves de URL que disparan una búsqueda. Sin ninguna de ellas (entrada limpia)
// NO se ejecuta la query pesada: el buscador se carga vacío y solo consulta al buscar.
const QUERY_KEYS = [
  'search', 'entity', 'division', 'ccaa', 'province', 'entityType', 'range',
  'cp', 'pc', 'pcMode', 'mat', 'matMode', 'cnae', 'cnaeMode', 'intercompany', 'minAmount',
  'active12m', 'recurring', 'hideBlocked', 'year', 'sort', 'dir', 'page', 'view',
];

function parseSearchParams(sp: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  // Filtros multi-valor: el valor llega como lista separada por comas en la URL.
  // Se limita el nº de valores (anti-DoS: listas IN(...) gigantes, CWE-1284).
  const getMulti = (k: string): string[] | undefined => {
    const v = get(k);
    if (!v) return undefined;
    const arr = v.split(',').map(s => s.trim()).filter(Boolean).slice(0, 500);
    return arr.length > 0 ? arr : undefined;
  };

  const sortRaw = (get('sort') ?? 'totalAmount') as SortField;
  const sortField: SortField = VALID_SORTS.has(sortRaw) ? sortRaw : 'totalAmount';
  const sortDir: SortDir = get('dir') === 'asc' ? 'asc' : 'desc';

  const ic = get('intercompany');
  const intercompany: '0' | '1' | undefined = ic === '0' ? '0' : ic === '1' ? '1' : undefined;
  // Años: lista de enteros en la URL (?year=2024,2025). Filtramos valores no válidos.
  const fiscalYears = getMulti('year')?.map(Number).filter(n => Number.isInteger(n) && n > 1900);
  return {
    search: get('search') ?? undefined,
    entitySapCodes: getMulti('entity'),
    divisionCodes: getMulti('division'),
    ccaas: getMulti('ccaa'),
    provinces: getMulti('province'),
    entityTypes: getMulti('entityType'),
    amountRanges: getMulti('range'),
    postalCode: get('cp') ?? undefined,
    // Centro de coste (multi) y material: código(s) + modo incluir/excluir.
    profitCenterCodes: getMulti('pc') && get('pcMode') !== 'exclude' ? getMulti('pc') : undefined,
    excludeProfitCenterCodes: getMulti('pc') && get('pcMode') === 'exclude' ? getMulti('pc') : undefined,
    materialCodes: getMulti('mat') && get('matMode') !== 'exclude' ? getMulti('mat') : undefined,
    excludeMaterialCodes: getMulti('mat') && get('matMode') === 'exclude' ? getMulti('mat') : undefined,
    cnaeCodes: getMulti('cnae') && get('cnaeMode') !== 'exclude' ? getMulti('cnae') : undefined,
    excludeCnaeCodes: getMulti('cnae') && get('cnaeMode') === 'exclude' ? getMulti('cnae') : undefined,
    intercompany,
    fiscalYears: fiscalYears && fiscalYears.length > 0 ? fiscalYears : undefined,
    minAmount: get('minAmount') ? Number(get('minAmount')) : undefined,
    onlyActive12m: get('active12m') === '1',
    recurringOnly: get('recurring') === '1',
    hideBlocked: get('hideBlocked') === '1',
    page: Math.max(1, Number(get('page')) || 1),
    pageSize: 25,
    sortField,
    sortDir,
    // Agrupación: 'org' (Golden Record, por defecto) o 'sap' (un registro SAP por fila).
    group: (get('group') === 'sap' ? 'sap' : 'org') as 'org' | 'sap',
  };
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getServerSession(authOptions);
  const buIds = session?.user?.buIds ?? [];
  const allowedFilters = session?.user?.allowedFilters ?? undefined;
  
  const opts: CustomerSearchOpts = parseSearchParams(sp);
  opts.buIds = buIds;
  opts.allowedFilters = allowedFilters;

  // URL preservando filtros, cambiando sólo el modo de agrupación (org / sap).
  const mkGroupUrl = (g: 'org' | 'sap') => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v == null) continue;
      p.set(k, Array.isArray(v) ? (v[0] ?? '') : v);
    }
    p.set('group', g);
    p.set('page', '1');
    return `?${p.toString()}`;
  };

  // Solo consultamos si hay búsqueda/filtros activos. En la entrada limpia evitamos
  // la agregación masiva sobre todo el Golden Record (271k clientes).
  const hasQuery = QUERY_KEYS.some(k => {
    const v = sp[k];
    return v != null && v !== '';
  });

  // Modo de vista: tabla (por defecto) o whitespot (vista agregada por sociedad/BU).
  const viewRaw = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const view: 'table' | 'whitespot' = viewRaw === 'whitespot' ? 'whitespot' : 'table';

  // Catálogo de filtros (ligero) + búsqueda (solo si hay filtros) en PARALELO. Antes
  // iban en serie (catálogo → búsqueda), añadiendo una ida-y-vuelta extra a cada carga.
  // En modo whitespot cargamos la cartera SIEMPRE (incluso sin filtros activos) para que
  // el grid global sea visible. La tabla solo se consulta si hay filtros activos.
  const hasTableQuery = hasQuery && view !== 'whitespot' || (hasQuery && view === 'whitespot');
  const [catalogs, [result, whitespots]] = await Promise.all([
    getFilterCatalogs(buIds, allowedFilters),
    Promise.all([
      hasQuery ? searchCustomers(opts) : Promise.resolve(null),
      view === 'whitespot' ? getPortfolioWhitespots(opts) : Promise.resolve(null),
    ]),
  ]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Buscador 360
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          {result
            ? `${formatNumber(result.total)} clientes encontrados · ajusta los filtros y vuelve a aplicar.`
            : 'Aplica filtros o escribe una búsqueda para consultar el Golden Record.'}
        </p>
      </div>

      {/* Filtros */}
      <FilterBar 
        entities={catalogs.entities} 
        divisions={catalogs.divisions} 
        entityDivisionMap={catalogs.entityDivisionMap}
        ccaas={catalogs.ccaas}
        provinces={catalogs.provinces}
        entityTypes={catalogs.entityTypes}
        cnaes={catalogs.cnaes}
        amountRanges={catalogs.amountRanges}
        intercompany={catalogs.intercompany}
        years={catalogs.years}
      />

      {/* Conmutador tabla/whitespot — siempre visible una vez que hay resultados o estamos en modo whitespot */}
      {(result || view === 'whitespot') && (
        <div className="flex items-center justify-between gap-2">
          {view === 'table' && result ? (
            <div
              className="inline-flex overflow-hidden rounded-md border text-sm"
              style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
            >
              <Link
                href={mkGroupUrl('org')}
                className="px-3 py-1.5 font-medium transition-colors"
                style={opts.group === 'org'
                  ? { background: 'var(--ts-semantic-color-background-primary-default)', color: '#fff' }
                  : { color: 'var(--ts-semantic-color-text-secondary-default)' }}
                title="Agrupa los registros SAP del mismo CIF en una sola fila (Golden Record)"
              >
                Por organización
              </Link>
              <Link
                href={mkGroupUrl('sap')}
                className="px-3 py-1.5 font-medium transition-colors"
                style={opts.group === 'sap'
                  ? { background: 'var(--ts-semantic-color-background-primary-default)', color: '#fff' }
                  : { color: 'var(--ts-semantic-color-text-secondary-default)' }}
                title="Una fila por cada registro de cliente en SAP"
              >
                Registros SAP
              </Link>
            </div>
          ) : (
            <div />
          )}
          <ViewToggle current={view} />
        </div>
      )}

      {view === 'whitespot' ? (
        <>
          {/* Resumen de la cartera filtrada — solo si hay resultado de búsqueda */}
          {result && (
            <p
              className="px-1 text-sm"
              style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
            >
              <strong>{formatNumber(result.total)}</strong> clientes · Facturación total:{' '}
              <strong style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
                {formatCurrency(result.sumAmount)}
              </strong>
            </p>
          )}

          {whitespots && whitespots.societies.length > 0 ? (
            <PortfolioWhitespotMap data={whitespots} />
          ) : (
            <div
              className="rounded-lg border-2 border-dashed py-12 text-center text-sm"
              style={{
                borderColor: 'var(--ts-semantic-color-border-base-default)',
                color: 'var(--ts-semantic-color-text-tertiary-default)',
              }}
            >
              No hay facturación que mostrar para los filtros aplicados.
            </div>
          )}
        </>
      ) : result ? (
        <>
          {/* Incompatibilidades legales */}
          {result.incompatibility && <IncompatibilityBanner data={result.incompatibility} />}

          {/* Resumen + paginación */}
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            sumAmount={result.sumAmount}
          />

          {/* Tabla */}
          <CustomersTable
            data={result.rows}
            currentSort={{ field: opts.sortField ?? 'totalAmount', dir: opts.sortDir ?? 'desc' }}
          />
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center"
          style={{
            borderColor: 'var(--ts-semantic-color-border-base-default)',
            background: 'var(--ts-semantic-color-surface-default)',
          }}
        >
          <Icon name="search" size={40} />
          <p className="text-base font-semibold" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
            Empieza a buscar
          </p>
          <p className="max-w-md text-sm" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
            Selecciona filtros (sociedad, división, importe, centro de coste…) o escribe en el buscador y pulsa <strong>Aplicar</strong>.
          </p>
        </div>
      )}
    </div>
  );
}