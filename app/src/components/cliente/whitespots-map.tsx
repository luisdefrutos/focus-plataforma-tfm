/**
 * Mapa de Whitespots agrupado por empresa (sociedad / legal entity).
 *
 * Cada empresa es un bloque plegable con cabecera coloreada (paleta corporativa
 * TÜV LFD) y total facturado; dentro, las BU del cliente: activas (con facturación,
 * sólidas) y whitespots (sin facturación = oportunidad, en discontinuo).
 * La cabecera de cada empresa pliega/despliega sus BU (abiertas por defecto).
 *
 * Primera iteración — colores y layout se ajustarán.
 */
'use client';

import { useState } from 'react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

type BuItem = {
  buId: number;
  buName: string;
  buCode: string;
  divisionCode: string;
  sapCode: string;
  legalName: string;
  total: number;
  count: number;
  isActive: boolean;
};

// Paleta corporativa (azul TÜV LFD + acentos) para distinguir empresas.
const PALETTE = [
  { bg: '#1c4f9c', fg: '#ffffff' }, // azul TÜV LFD
  { bg: '#0f7b8a', fg: '#ffffff' }, // teal
  { bg: '#5a7d2a', fg: '#ffffff' }, // verde oliva
  { bg: '#7a3b8f', fg: '#ffffff' }, // morado
  { bg: '#9c3a2e', fg: '#ffffff' }, // rojo/teja
  { bg: '#b5651d', fg: '#ffffff' }, // naranja
];

type CompanyGroup = {
  sapCode: string;
  legalName: string;
  bus: BuItem[];
  total: number;
  activeCount: number;
};

export function WhitespotsMap({ items }: { items: BuItem[] }) {
  // Agrupar por empresa (sapCode).
  const groups = new Map<string, BuItem[]>();
  for (const it of items) {
    if (!groups.has(it.sapCode)) groups.set(it.sapCode, []);
    groups.get(it.sapCode)!.push(it);
  }

  const entries = [...groups.entries()]
    .map(([sapCode, bus]): CompanyGroup => ({
      sapCode,
      legalName: bus[0]?.legalName ?? sapCode,
      bus: [...bus].sort((a, b) => b.total - a.total),
      total: bus.reduce((s, b) => s + b.total, 0),
      activeCount: bus.filter(b => b.isActive).length,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-5">
      {entries.map((g, i) => (
        <CompanyBlock key={g.sapCode} group={g} color={PALETTE[i % PALETTE.length]!} />
      ))}
    </div>
  );
}

function CompanyBlock({ group: g, color }: { group: CompanyGroup; color: { bg: string; fg: string } }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: color.bg }}>
      {/* Cabecera de la empresa — pliega/despliega sus BU */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-left"
        style={{ background: color.bg, color: color.fg }}
      >
        <div className="min-w-0">
          <span
            className="block truncate text-sm font-bold tracking-wide"
            title={`${g.legalName} (${g.sapCode})`}
          >
            {g.legalName}
            <span className="ml-2 font-normal opacity-80">{g.sapCode}</span>
          </span>
          <span className="text-[11px] opacity-80">
            {g.activeCount}/{g.bus.length} BU activas
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-none">
            <span className="block text-[10px] font-semibold uppercase tracking-widest opacity-80">
              Total facturado
            </span>
            <span className="block text-xl font-bold tabular-nums">
              {formatCurrency(g.total, { compact: true })}
            </span>
          </div>
          <Icon name={open ? 'expand_less' : 'expand_more'} size={20} color={color.fg} />
        </div>
      </button>

      {/* BU de la empresa */}
      {open && (
        <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {g.bus.map(b => (
            <div
              key={b.buId}
              className="flex flex-col justify-between rounded-md border p-3"
              style={{
                borderTopColor: b.isActive ? color.bg : 'var(--ts-semantic-color-border-base-default)',
                borderRightColor: b.isActive ? color.bg : 'var(--ts-semantic-color-border-base-default)',
                borderBottomColor: b.isActive ? color.bg : 'var(--ts-semantic-color-border-base-default)',
                borderLeftColor: color.bg,
                borderTopStyle: b.isActive ? 'solid' : 'dashed',
                borderRightStyle: b.isActive ? 'solid' : 'dashed',
                borderBottomStyle: b.isActive ? 'solid' : 'dashed',
                borderLeftStyle: 'solid',
                borderLeftWidth: '3px',
                background: b.isActive
                  ? 'var(--ts-semantic-color-surface-default)'
                  : 'var(--ts-semantic-color-background-neutral-subtle-default)',
                opacity: b.isActive ? 1 : 0.9,
              }}
            >
              <div>
                <h4
                  className="text-sm font-semibold leading-tight"
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
                      className="text-xs tabular-nums"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                    >
                      {formatNumber(b.count)} fact.
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
      )}
    </div>
  );
}
