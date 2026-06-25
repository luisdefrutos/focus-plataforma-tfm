/**
 * Línea temporal compacta de facturación por año (cards horizontales).
 * Cada año destaca: importe y nº facturas + barra de progreso relativa al máximo.
 */
'use client';

import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LoadingOverlay } from '@/components/ui/loading-overlay';

type Props = {
  data: Array<{ year: number; total: number; count: number }>;
  /** Año actualmente filtrado en la URL (resalta la card activa) */
  activeYear?: number;
  /** Pathname base para construir links (?year=2024) */
  basePath: string;
};

export function BillingTimeline({ data, activeYear, basePath }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (data.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
        Este cliente no tiene facturación registrada en el periodo cargado.
      </p>
    );
  }

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const grandTotal = data.reduce((s, d) => s + d.total, 0);
  const grandCount = data.reduce((s, d) => s + d.count, 0);

  return (
    <>
      <LoadingOverlay isPending={isPending} />
      <div className="space-y-4">
        {/* Summary global */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p
          className="text-2xl font-bold tabular-nums"
          style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
        >
          {formatCurrency(grandTotal)}
        </p>
        <p
          className="text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          en <strong>{formatNumber(grandCount)}</strong> facturas a lo largo de <strong>{data.length}</strong> años
        </p>
      </div>

      {/* Year cards */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${data.length}, minmax(160px, 1fr))` }}
      >
        {data.map(d => {
          const active = d.year === activeYear;
          const pct = (d.total / maxTotal) * 100;
          return (
            <Link
              key={d.year}
              href={`${basePath}?year=${d.year}`}
              onClick={(e) => {
                e.preventDefault();
                startTransition(() => {
                  router.push(`${basePath}?year=${d.year}`, { scroll: false });
                });
              }}
              className={cn(
                'group block rounded-lg border p-4 transition-all hover:shadow-sm',
                active && 'ring-2',
              )}
              style={{
                background: active
                  ? 'var(--ts-semantic-color-background-primary-subtle-default)'
                  : 'var(--ts-semantic-color-surface-default)',
                borderColor: active
                  ? 'var(--ts-semantic-color-border-primary-default)'
                  : 'var(--ts-semantic-color-border-base-default)',
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{
                  color: active
                    ? 'var(--ts-semantic-color-text-link-default)'
                    : 'var(--ts-semantic-color-text-tertiary-default)',
                }}
              >
                {d.year}
              </p>
              <p
                className="mt-1 text-xl font-bold tabular-nums"
                style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
              >
                {formatCurrency(d.total, { compact: true })}
              </p>
              <p
                className="text-xs tabular-nums"
                style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
              >
                {formatNumber(d.count)} {d.count === 1 ? 'factura' : 'facturas'}
              </p>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full"
                style={{ background: 'var(--ts-semantic-color-background-neutral-subtle-default)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: 'var(--ts-semantic-color-background-primary-default)',
                  }}
                />
              </div>
            </Link>
          );
        })}
      </div>

      {activeYear && (
        <div className="flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
            Mostrando facturas de <strong>{activeYear}</strong>.
          </span>
          <Link
            href={basePath}
            onClick={(e) => {
              e.preventDefault();
              startTransition(() => {
                router.push(basePath, { scroll: false });
              });
            }}
            className="font-medium hover:underline"
            style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
          >
            Quitar filtro de año
          </Link>
        </div>
      )}
    </div>
    </>
  );
}