/**
 * Modo whitespot del Buscador 360 — vista agregada de la cartera filtrada por
 * sociedad → BU (reemplaza la página "por estructura" del .pbix).
 *
 * Mismo lenguaje visual que el WhitespotsMap de la ficha de cliente: cada sociedad
 * es un bloque con cabecera coloreada (paleta corporativa TÜV LFD) y total facturado;
 * dentro, sus BU: activas (con facturación, sólidas) y whitespots (sin facturación de
 * la cartera = oportunidad de cross-sell, en discontinuo).
 *
 * Server component (solo presentación): lo renderiza la página RSC del buscador.
 */

import { formatCurrency, formatNumber } from '@/lib/utils';
import type { PortfolioWhitespots } from '@/lib/queries/customers';

// Paleta corporativa (azul TÜV LFD + acentos) para distinguir sociedades.
const PALETTE = [
  { bg: '#1c4f9c', fg: '#ffffff' }, // azul TÜV LFD
  { bg: '#0f7b8a', fg: '#ffffff' }, // teal
  { bg: '#5a7d2a', fg: '#ffffff' }, // verde oliva
  { bg: '#7a3b8f', fg: '#ffffff' }, // morado
  { bg: '#9c3a2e', fg: '#ffffff' }, // rojo/teja
  { bg: '#b5651d', fg: '#ffffff' }, // naranja
];

export function PortfolioWhitespotMap({ data }: { data: PortfolioWhitespots }) {
  return (
    <div className="space-y-5">
      {data.societies.map((g, i) => {
        const color = PALETTE[i % PALETTE.length]!;
        return (
          <div
            key={g.sapCode}
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: color.bg }}
          >
            {/* Cabecera de la sociedad */}
            <div
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5"
              style={{ background: color.bg, color: color.fg }}
            >
              <div className="min-w-0 flex-1 pr-4">
                <span
                  className="block truncate text-sm font-bold tracking-wide"
                  title={`${g.legalName} (${g.sapCode})`}
                >
                  {g.legalName}
                  <span className="ml-2 font-normal opacity-80">{g.sapCode}</span>
                </span>
                <span className="text-[11px] opacity-80">
                  {g.activeCount}/{g.totalBus} BU activas
                </span>
              </div>
              <div className="text-right leading-none">
                <span className="block text-[10px] font-semibold uppercase tracking-widest opacity-80">
                  Total facturado
                </span>
                <span className="block text-xl font-bold tabular-nums">
                  {formatCurrency(g.total, { compact: true })}
                </span>
              </div>
            </div>

            {/* BU de la sociedad */}
            <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.bus.map(b => (
                <div
                  key={b.buId}
                  className="flex flex-col justify-between rounded-md border p-3 min-w-0"
                  style={{
                    borderColor: b.isActive ? color.bg : 'var(--ts-semantic-color-border-base-default)',
                    borderStyle: b.isActive ? 'solid' : 'dashed',
                    borderLeftWidth: '3px',
                    borderLeftColor: color.bg,
                    background: b.isActive
                      ? 'var(--ts-semantic-color-surface-default)'
                      : 'var(--ts-semantic-color-background-neutral-subtle-default)',
                    opacity: b.isActive ? 1 : 0.9,
                  }}
                >
                  <div>
                    <h4
                      className="text-sm font-semibold leading-tight line-clamp-2 break-words"
                      style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
                      title={b.buName}
                    >
                      {b.buName}
                    </h4>
                    <p
                      className="mt-0.5 text-xs"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                    >
                      {b.divisionCode}
                    </p>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    {b.isActive ? (
                      <>
                        <span
                          className="text-base font-bold tabular-nums"
                          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
                        >
                          {formatCurrency(b.total, { compact: true })}
                        </span>
                        <span
                          className="text-right text-xs leading-tight tabular-nums"
                          style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                        >
                          {formatNumber(b.customers)} cli · {formatNumber(b.count)} fact.
                        </span>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-base font-bold tabular-nums"
                          style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                        >
                          {formatCurrency(0, { compact: true })}
                        </span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            background: 'var(--ts-semantic-color-background-primary-subtle-default)',
                            color: 'var(--ts-semantic-color-text-link-default)',
                          }}
                        >
                          Whitespot
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
