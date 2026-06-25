/**
 * Donut del Pareto de ventas por división: la tarta reparte la facturación del año
 * entre divisiones y la leyenda responde a "¿cuántos clientes me hacen qué
 * facturación?" — nº de organizaciones que concentran el 80% de cada división.
 * Cliente porque Recharts es SSR-incompatible (SVG runtime + ResizeObserver).
 */
'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { ParetoDivision } from '@/lib/queries/dashboard';
import { formatCurrency, formatNumber } from '@/lib/utils';

/** Paleta alineada con tokens TÜV LFD (orden: II, MO, BA, PS, NON). */
const DIVISION_COLORS: Record<string, string> = {
  II:  '#0046AD', // primary brand blue
  MO:  '#1C6A38', // success green
  BA:  '#FF774B', // accent02 orange
  PS:  '#7B2CBF', // (no token oficial — púrpura complementario)
  NON: '#5D5D5D', // neutral grey
};

const DIVISION_LABEL: Record<string, string> = {
  II:  'Industrial Inspection',
  MO:  'Mobility',
  BA:  'Business Assurance',
  PS:  'Product Service',
  NON: 'Non-Group / Others',
};

export function ParetoDivisionDonut({ divisions }: { divisions: ParetoDivision[] }) {
  const grandTotal = divisions.reduce((s, d) => s + d.total, 0);

  if (divisions.length === 0 || grandTotal <= 0) {
    return (
      <p className="py-12 text-center text-sm" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
        Sin facturación en el periodo.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row">
      {/* Tarta */}
      <div className="h-[300px] w-full max-w-[340px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={divisions}
              dataKey="total"
              nameKey="division"
              innerRadius="55%"
              outerRadius="90%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {divisions.map(d => (
                <Cell key={d.division} fill={DIVISION_COLORS[d.division] ?? '#888888'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--ts-semantic-color-surface-default)',
                border: '1px solid var(--ts-semantic-color-border-base-default)',
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                `${formatCurrency(Number(value) || 0)} (${(((Number(value) || 0) / grandTotal) * 100).toFixed(1)}%)`,
                DIVISION_LABEL[String(name)] ?? String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda Pareto: quién concentra el 80% de cada división */}
      <ul className="w-full min-w-0 space-y-3">
        {divisions.map(d => {
          const share = (d.total / grandTotal) * 100;
          const pct80 = d.clients > 0 ? (d.clients80 / d.clients) * 100 : 0;
          return (
            <li key={d.division} className="flex items-start gap-3">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                style={{ background: DIVISION_COLORS[d.division] ?? '#888888' }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
                  {DIVISION_LABEL[d.division] ?? d.division}
                  <span className="ml-2 font-normal tabular-nums" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
                    {formatCurrency(d.total, { compact: true })} · {share.toFixed(1)}%
                  </span>
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                  <strong className="font-semibold" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
                    {formatNumber(d.clients80)}
                  </strong>{' '}
                  de {formatNumber(d.clients)} clientes ({pct80.toFixed(1)}%) concentran el 80% de la facturación
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
