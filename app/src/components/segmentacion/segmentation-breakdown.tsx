/**
 * Breakdown de facturación con tabs: División / Sociedad / BU.
 * Donut para División y Sociedad; barras horizontales para BU (top 10 + "Otras").
 *
 * El donut NO rotula importes alrededor del arco (se solapaban con sectores
 * pequeños): solo muestra el % DENTRO de los sectores grandes y deja el detalle
 * (importe + %) en una leyenda propia debajo, donde nunca puede solaparse.
 */
'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import { TsTabGroup } from '@tuvsud/design-system/react/tab-group';
import { TsTab } from '@tuvsud/design-system/react/tab';
import { TsTabPanel } from '@tuvsud/design-system/react/tab-panel';
import { formatCurrency } from '@/lib/utils';
import type { Breakdown, BreakdownSlice } from '@/lib/queries/segmentacion';

/**
 * Paleta categórica oficial TÜV LFD — todos son `--ts-core-color-*` del design system
 * (blue.800 = brand; teal/orange/green/blue/gray cubren hasta 10 categorías sin repetir tono).
 */
const PALETTE = [
  '#0046AD', // blue-800  (brand)
  '#1CA797', // teal-500
  '#FF774B', // orange-500 (accent02)
  '#1C6A38', // green-800
  '#1D4FD7', // blue-700
  '#187B72', // teal-700
  '#7D2D12', // orange-900
  '#2463EB', // blue-600
  '#6C6C74', // gray-500
  '#0B253B', // blue-950
];

const BRAND_BLUE = '#0046AD';
const RAD = Math.PI / 180;
const LABEL_LINE_COLOR = '#9CA3AF';
const LABEL_TEXT_COLOR = '#43434A';

const TOOLTIP_STYLE = {
  background: 'var(--ts-semantic-color-surface-default)',
  border: '1px solid var(--ts-semantic-color-border-base-default)',
  borderRadius: 6,
  fontSize: 12,
};

type Props = { data: Breakdown };

export function SegmentationBreakdown({ data }: Props) {
  return (
    <TsTabGroup>
      <TsTab slot="nav" panel="division">División</TsTab>
      <TsTab slot="nav" panel="entity">Sociedad</TsTab>
      <TsTab slot="nav" panel="bu">BU</TsTab>

      <TsTabPanel name="division"><Donut slices={data.byDivision} /></TsTabPanel>
      <TsTabPanel name="entity"><Donut slices={data.byEntity} /></TsTabPanel>
      <TsTabPanel name="bu"><BuBars slices={data.byBu} /></TsTabPanel>
    </TsTabGroup>
  );
}

/**
 * Rótulo de % SIEMPRE visible:
 *  - sectores grandes (≥ 8%): el % va dentro del aro, en blanco.
 *  - sectores pequeños: el % va fuera con una línea guía a su porción,
 *    para que no se solape con el aro ni desaparezca.
 */
function renderPctLabel(props: PieLabelRenderProps) {
  const percent = props.percent ?? 0;
  const pct = `${Math.round(percent * 100)}%`;
  const cx = Number(props.cx);
  const cy = Number(props.cy);
  const inner = Number(props.innerRadius);
  const outer = Number(props.outerRadius);
  const midAngle = props.midAngle ?? 0;
  const cos = Math.cos(-midAngle * RAD);
  const sin = Math.sin(-midAngle * RAD);

  if (percent >= 0.08) {
    const r = inner + (outer - inner) * 0.5;
    return (
      <text x={cx + r * cos} y={cy + r * sin} fill="#fff" textAnchor="middle"
        dominantBaseline="central" fontSize={11} fontWeight={600}>
        {pct}
      </text>
    );
  }

  // Sector pequeño → etiqueta fuera con línea guía.
  const sx = cx + outer * cos;
  const sy = cy + outer * sin;
  const ex = cx + (outer + 13) * cos;
  const ey = cy + (outer + 13) * sin;
  const right = cos >= 0;
  return (
    <g>
      <path d={`M${sx},${sy}L${ex},${ey}`} stroke={LABEL_LINE_COLOR} strokeWidth={1} fill="none" />
      <text x={ex + (right ? 3 : -3)} y={ey} textAnchor={right ? 'start' : 'end'}
        dominantBaseline="central" fontSize={10} fontWeight={600} fill={LABEL_TEXT_COLOR}>
        {pct}
      </text>
    </g>
  );
}

function Donut({ slices }: { slices: BreakdownSlice[] }) {
  if (slices.length === 0) {
    return <EmptyState />;
  }
  const total = slices.reduce((s, x) => s + x.total, 0);
  return (
    <div>
      <div className="relative h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={1}
              label={renderPctLabel}
              labelLine={false}
              isAnimationActive={false}
            >
              {slices.map((s, i) => (
                <Cell key={s.key} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value) => formatCurrency(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Total en el hueco central */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px]" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
            Total
          </span>
          <span className="text-lg font-bold" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
            {formatCurrency(total, { compact: true })}
          </span>
        </div>
      </div>

      {/* Leyenda propia: color · etiqueta · importe · % (sin riesgo de solape) */}
      <ul className="mt-3 space-y-1">
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.total / total) * 100 : 0;
          return (
            <li key={s.key} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span
                className="flex-1 truncate"
                title={s.label}
                style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
              >
                {s.label}
              </span>
              <span
                className="shrink-0 font-semibold tabular-nums"
                style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
              >
                {formatCurrency(s.total, { compact: true })}
              </span>
              <span
                className="w-9 shrink-0 text-right tabular-nums"
                style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
              >
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BuBars({ slices }: { slices: BreakdownSlice[] }) {
  if (slices.length === 0) {
    return <EmptyState />;
  }

  const TOP = 10;
  const top = slices.slice(0, TOP);
  const restTotal = slices.slice(TOP).reduce((s, x) => s + x.total, 0);
  const display = restTotal > 0
    ? [...top, { key: '__rest__', label: `Otras (${slices.length - TOP})`, total: restTotal }]
    : top;

  return (
    <div style={{ height: Math.max(280, display.length * 28) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={display} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }}>
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatCurrency(v, { compact: true })}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => formatCurrency(Number(value))}
          />
          <Bar dataKey="total" fill={BRAND_BLUE} radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="total"
              position="right"
              formatter={(v) => formatCurrency(Number(v), { compact: true })}
              style={{ fontSize: 10, fill: '#43434A' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[320px] items-center justify-center text-sm"
      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
      Sin datos para los filtros seleccionados.
    </div>
  );
}
