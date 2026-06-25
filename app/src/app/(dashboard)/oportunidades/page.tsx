/**
 * Buscador de Oportunidades — matriz de clientes x servicios (Material Codes).
 *
 * Utiliza los mismos filtros que el Buscador 360, pero la agrupación es matricial.
 */

import {
  getFilterCatalogs,
  getOpportunitiesMatrix,
  type SortField,
  type SortDir,
  type CustomerSearchOpts,
} from '@/lib/queries/customers';
import { FilterBar } from '@/components/buscador/filter-bar';
import { Pagination } from '@/components/buscador/pagination';
import { OpportunitiesMatrix } from '@/components/oportunidades/opportunities-matrix';
import { Icon } from '@/components/ui/icon';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';

export const metadata = { title: 'Oportunidades | Focus' };
export const dynamic = 'force-dynamic';

const VALID_SORTS = new Set<SortField>(['legalName', 'totalAmount', 'lastInvoiceDate', 'invoiceCount']);

const QUERY_KEYS = [
  'search', 'entity', 'division', 'ccaa', 'province', 'entityType', 'range',
  'cp', 'pc', 'pcMode', 'mat', 'matMode', 'cnae', 'cnaeMode', 'intercompany', 'minAmount',
  'active12m', 'recurring', 'hideBlocked', 'year', 'sort', 'dir', 'page',
];

function parseSearchParams(sp: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const getMulti = (k: string): string[] | undefined => {
    const v = get(k);
    if (!v) return undefined;
    const arr = v.split(',').map(s => s.trim()).filter(Boolean);
    return arr.length > 0 ? arr : undefined;
  };

  const sortRaw = (get('sort') ?? 'totalAmount') as SortField;
  const sortField: SortField = VALID_SORTS.has(sortRaw) ? sortRaw : 'totalAmount';
  const sortDir: SortDir = get('dir') === 'asc' ? 'asc' : 'desc';

  const ic = get('intercompany');
  const intercompany: '0' | '1' | undefined = ic === '0' ? '0' : ic === '1' ? '1' : undefined;
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
    pageSize: 100, // Override pageSize to 100 for matrix
    sortField,
    sortDir,
    group: (get('group') === 'sap' ? 'sap' : 'org') as 'org' | 'sap',
  };
}

export default async function OportunidadesPage({
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

  const hasQuery = QUERY_KEYS.some(k => {
    const v = sp[k];
    return v != null && v !== '';
  });

  const catalogs = await getFilterCatalogs(buIds, allowedFilters);
  const result = hasQuery ? await getOpportunitiesMatrix(opts) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Oportunidades
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          {result
            ? `${formatNumber(result.total)} clientes encontrados. Mostrando ${formatNumber(result.rows.length)} en esta página.`
            : 'Aplica filtros o escribe una búsqueda para visualizar la matriz de oportunidades.'}
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

      {result ? (
        <>
          <div className="flex items-center justify-between gap-2">
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
          </div>

          <div 
            className="rounded-md p-3 text-sm flex items-center gap-2"
            style={{ 
              background: 'var(--ts-semantic-color-background-info-default, #e0f2fe)', 
              color: 'var(--ts-semantic-color-text-primary-default)' 
            }}
          >
            <Icon name="info" size={20} />
            Solo se muestran como columnas los Material Codes (servicios) que tienen facturación mayor a 0 € para los clientes listados en esta página.
          </div>

          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            sumAmount={result.sumAmount}
          />

          <OpportunitiesMatrix data={result} />
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center"
          style={{
            borderColor: 'var(--ts-semantic-color-border-base-default)',
            background: 'var(--ts-semantic-color-surface-default)',
          }}
        >
          <Icon name="table_chart" size={40} />
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
