/**
 * Top N de clientes — concentración de facturación.
 * Equivalente a "TOP % DE CLIENTES" y "TOP Nº DE CLIENTES" del .pbix v3.6.
 */

import Link from 'next/link';
import { getTopCustomers } from '@/lib/queries/top-customers';
import { getYears } from '@/lib/queries/segmentacion';
import { getFilterCatalogs } from '@/lib/queries/customers';
import { TopFilters } from '@/components/top-clientes/top-filters';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Top clientes | Focus' };
export const dynamic = 'force-dynamic';

export default async function TopClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ top?: string; entity?: string; division?: string; year?: string; ic?: string }>;
}) {
  // Defensa en profundidad: no depender solo del middleware para la autenticación.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const sp = await searchParams;
  const topN = Math.min(100, Math.max(1, Number(sp.top) || 50));
  const filters = {
    entitySapCode: sp.entity || undefined,
    divisionCode: sp.division || undefined,
    year: sp.year ? Number(sp.year) : undefined,
    excludeIntercompany: sp.ic === '0',
  };

  const [result, catalogs, years] = await Promise.all([
    getTopCustomers({ topN, filters }),
    getFilterCatalogs(),
    getYears(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Top {topN} clientes
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          Concentran <strong>{result.pctRevenueConcentrated.toFixed(0)}%</strong>{' '}
          de la facturación ({formatCurrency(result.topNTotal, { compact: true })} de{' '}
          {formatCurrency(result.grandTotalAmount, { compact: true })}) ·{' '}
          {result.topNCustomers} sobre {formatNumber(result.grandTotalCustomers)} clientes con facturación.
        </p>
      </div>

      {/* Filtros */}
      <TopFilters
        entities={catalogs.entities}
        divisions={catalogs.divisions}
        years={years}
      />

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
            <thead className="border-b" style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}>
              <tr>
                <Th align="right">#</Th>
                <Th>Cliente</Th>
                <Th align="right">Facturado</Th>
                <Th align="right">% del total</Th>
                <Th align="right">% acumulado</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map(r => (
                <tr
                  key={r.customerId}
                  className="border-b transition-colors hover:bg-[var(--ts-semantic-color-background-base-hover)]"
                  style={{ borderColor: 'var(--ts-semantic-color-border-base-default)' }}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-right align-top text-sm tabular-nums"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                    {r.rank}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <Link
                      href={`/clientes/${r.customerId}`}
                      className="block max-w-[420px] truncate text-sm font-medium hover:underline"
                      style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
                      title={r.legalName}
                    >
                      {r.legalName}
                    </Link>
                    <p className="text-xs" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                      {r.taxId}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right align-top text-sm font-semibold tabular-nums">
                    {formatCurrency(r.totalAmount, { compact: true })}
                  </td>
                  <td className="px-4 py-2.5 text-right align-top text-sm tabular-nums"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                    {r.pctOfTotal.toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5 text-right align-top">
                    <div className="inline-flex items-center justify-end gap-2">
                      <CumulativeBar pct={r.pctCumulative} />
                      <span className="w-12 text-right text-xs tabular-nums" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
                        {r.pctCumulative.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {result.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                    No hay clientes con facturación para esos filtros.
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

function CumulativeBar({ pct }: { pct: number }) {
  return (
    <div
      className="h-1.5 w-24 overflow-hidden rounded-full"
      style={{ background: 'var(--ts-semantic-color-background-neutral-subtle-default)' }}
    >
      <div
        className="h-full"
        style={{
          width: `${Math.min(100, pct)}%`,
          background: 'var(--ts-semantic-color-background-primary-default)',
        }}
      />
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