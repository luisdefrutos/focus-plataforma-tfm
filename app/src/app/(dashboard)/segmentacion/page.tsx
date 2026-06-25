/**
 * Segmentación por facturación — buckets de importe acumulado.
 * Equivalente a la página "SEGMENTACION POR FACT." del .pbix v3.6.
 */

import Link from 'next/link';
import { getSegmentation, getBreakdown, getYears } from '@/lib/queries/segmentacion';
import { getFilterCatalogs } from '@/lib/queries/customers';
import { SegmentationBreakdown } from '@/components/segmentacion/segmentation-breakdown';
import { SegmentationFilters } from '@/components/segmentacion/segmentation-filters';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Segmentación | Focus' };
export const dynamic = 'force-dynamic';

export default async function SegmentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; division?: string; year?: string; ic?: string }>;
}) {
  // Defensa en profundidad: no depender solo del middleware para la autenticación.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const sp = await searchParams;
  const parseMulti = (v?: string) =>
    v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
  const entityCodes = parseMulti(sp.entity);
  const divisionCodes = parseMulti(sp.division);
  const selYears = parseMulti(sp.year).map(Number).filter(n => !Number.isNaN(n));
  const filters = {
    entitySapCodes: entityCodes.length ? entityCodes : undefined,
    divisionCodes: divisionCodes.length ? divisionCodes : undefined,
    years: selYears.length ? selYears : undefined,
    excludeIntercompany: sp.ic === '0',
  };

  const [rows, breakdown, catalogs, years] = await Promise.all([
    getSegmentation(filters),
    getBreakdown(filters),
    getFilterCatalogs(),
    getYears(),
  ]);

  const totalCust = rows.reduce((s, r) => s + r.customerCount, 0);
  const totalAmt = rows.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Segmentación por facturación
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          {formatNumber(totalCust)} clientes · {formatCurrency(totalAmt, { compact: true })} facturados ·
          ¿qué peso tiene cada rango en el negocio?
        </p>
      </div>

      {/* Filtros */}
      <SegmentationFilters
        entities={catalogs.entities}
        divisions={catalogs.divisions}
        entityDivisionMap={catalogs.entityDivisionMap}
        years={years}
      />

      {/* Grid: tabla izquierda + pie derecha */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Tabla (3/5) */}
        <div
          className="overflow-hidden rounded-lg border lg:col-span-3"
          style={{
            background: 'var(--ts-semantic-color-surface-default)',
            borderColor: 'var(--ts-semantic-color-border-base-default)',
          }}
        >
          <table className="w-full text-sm">
            <thead
              className="border-b"
              style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
            >
              <tr>
                <Th>Rango facturación</Th>
                <Th align="right">Clientes</Th>
                <Th align="right">% clientes</Th>
                <Th align="right">Facturado</Th>
                <Th align="right">Media</Th>
                <Th align="right">% facturado</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.code}
                  className="border-b"
                  style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
                >
                  <td className="px-4 py-2.5 text-sm font-medium" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
                    <Link
                      href={`/clientes?range=${r.code}${sp.entity ? `&entity=${sp.entity}` : ''}${sp.division ? `&division=${sp.division}` : ''}`}
                      className="hover:underline"
                      style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
                    >
                      {r.label}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums">
                    {formatNumber(r.customerCount)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                    {r.pctCustomers.toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">
                    {formatCurrency(r.totalAmount, { compact: true })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                    {r.customerCount > 0 ? formatCurrency(r.totalAmount / r.customerCount, { compact: true }) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                    {r.pctAmount.toFixed(0)}%
                  </td>
                </tr>
              ))}
              <tr className="font-bold" style={{ background: 'var(--ts-semantic-color-background-neutral-subtle-default)' }}>
                <td className="px-4 py-2.5 text-sm">Total</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{formatNumber(totalCust)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">100%</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{formatCurrency(totalAmt, { compact: true })}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{totalCust > 0 ? formatCurrency(totalAmt / totalCust, { compact: true }) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Breakdown (2/5) */}
        <div
          className="rounded-lg border p-4 lg:col-span-2"
          style={{
            background: 'var(--ts-semantic-color-surface-default)',
            borderColor: 'var(--ts-semantic-color-border-base-default)',
          }}
        >
          <h2
            className="mb-2 text-sm font-semibold"
            style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
          >
            Distribución del importe facturado
          </h2>
          <p
            className="mb-3 text-xs"
            style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
          >
            Cambia la dimensión para ver el peso por División, Sociedad o BU.
          </p>
          <SegmentationBreakdown data={breakdown} />
        </div>
      </div>
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