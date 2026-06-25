/**
 * Mock-up ejecutivo del dashboard — para presentaciones de FOCUS a dirección.
 *
 * Misma estructura que el dashboard real (ciclo de vida + Pareto) pero SIN datos:
 * transmite la intención de cada indicador con una pregunta de negocio y muestra
 * skeletons donde irán las cifras. No ejecuta ninguna query (es 100% estático),
 * así la demo no desvela números sensibles ni desvía la atención del resto.
 */

import { Icon } from '@/components/ui/icon';

const KPIS = [
  {
    label: 'Clientes fieles',
    icon: 'loyalty',
    tone: 'success' as const,
    intent: '¿Quién nos compra todos los años?',
  },
  {
    label: 'Clientes nuevos',
    icon: 'person_add',
    tone: 'primary' as const,
    intent: '¿Quién empieza a comprarnos este año?',
  },
  {
    label: 'Clientes recuperados',
    icon: 'autorenew',
    tone: 'primary' as const,
    intent: '¿Quién ha vuelto tras dejar de comprar?',
  },
  {
    label: 'Clientes perdidos TSI',
    icon: 'person_off',
    tone: 'danger' as const,
    intent: '¿Quién dejó de comprar en TÜV LFD Iberia?',
  },
  {
    label: 'Clientes perdidos MOI',
    icon: 'person_off',
    tone: 'danger' as const,
    intent: '¿Quién dejó de comprar en Mobility?',
  },
  {
    label: 'Clientes perdidos TSA',
    icon: 'event_busy',
    tone: 'danger' as const,
    intent: '¿Quién no volvió tras vencer su inspección?',
  },
];

/** Tramos de penetración de servicios (mock-up): el detalle que da pista de oportunidades. */
const SERVICE_TIERS = [
  { num: '1', label: '1 servicio', badge: 'Oportunidad de venta cruzada', highlight: true },
  { num: '2', label: '2 servicios', badge: null, highlight: false },
  { num: '3+', label: '3 o más servicios', badge: null, highlight: false },
];

/** Donut decorativo del Pareto: proporciones arbitrarias, colores de división atenuados. */
const DONUT_SEGMENTS = [
  { color: '#0046AD', value: 34 }, // II
  { color: '#1C6A38', value: 26 }, // MO
  { color: '#FF774B', value: 18 }, // BA
  { color: '#7B2CBF', value: 13 }, // PS
  { color: '#5D5D5D', value: 9 },  // NON
];

const DIVISIONS = [
  'Industrial Inspection',
  'Mobility',
  'Business Assurance',
  'Product Service',
  'Non-Group / Others',
];

const TONE_COLOR = {
  primary: 'var(--ts-semantic-color-icon-primary-default)',
  success: 'var(--ts-semantic-color-text-success-default)',
  danger: 'var(--ts-semantic-color-text-danger-default)',
} as const;

const TONE_BG = {
  primary: 'var(--ts-semantic-color-background-primary-subtle-default)',
  success: 'var(--ts-semantic-color-background-success-subtle-default)',
  danger: 'var(--ts-semantic-color-background-danger-subtle-default)',
} as const;

export function DashboardMockup() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          Dashboard
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
        >
          Salud comercial de la cartera de clientes · los indicadores se activarán con datos reales
        </p>
      </div>

      {/* Ciclo de vida — tarjetas sin cifra */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {KPIS.map(k => (
          <div
            key={k.label}
            className="flex items-start gap-4 rounded-lg border p-5"
            style={{
              background: 'var(--ts-semantic-color-surface-default)',
              borderColor: 'var(--ts-semantic-color-border-base-default)',
            }}
          >
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
              style={{ background: TONE_BG[k.tone] }}
            >
              <Icon name={k.icon} size={22} color={TONE_COLOR[k.tone]} />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
              >
                {k.label}
              </p>
              <Skeleton className="mt-2 h-7 w-24" />
              <p
                className="mt-2 text-xs"
                style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
              >
                {k.intent}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Penetración de servicios — detalle de venta cruzada (general a nivel grupo, filtrable por compañía) */}
      <section>
        <div
          className="rounded-lg border p-6"
          style={{
            background: 'var(--ts-semantic-color-surface-default)',
            borderColor: 'var(--ts-semantic-color-border-base-default)',
          }}
        >
          {/* Cabecera con filtro de compañía */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                className="text-base font-semibold"
                style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
              >
                Penetración de servicios por cliente
              </h2>
              <p
                className="mt-0.5 text-xs"
                style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
              >
                ¿Cuántos clientes nos compran un solo servicio? Cada uno es una oportunidad de venta cruzada.
              </p>
            </div>
            <MockFilter />
          </div>

          {/* Tramos: 1 / 2 / 3+ servicios, con venta y nº de clientes */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SERVICE_TIERS.map((t, i) => (
              <div
                key={t.label}
                className="rounded-lg border p-5"
                style={{
                  background: t.highlight
                    ? 'var(--ts-semantic-color-background-primary-subtle-default)'
                    : 'var(--ts-semantic-color-surface-default)',
                  borderColor: t.highlight
                    ? 'var(--ts-semantic-color-border-primary-default)'
                    : 'var(--ts-semantic-color-border-base-default)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums"
                    style={{
                      background: t.highlight
                        ? 'var(--ts-semantic-color-background-primary-default)'
                        : 'var(--ts-semantic-color-background-neutral-subtle-default)',
                      color: t.highlight ? '#fff' : 'var(--ts-semantic-color-text-secondary-default)',
                    }}
                  >
                    {t.num}
                  </span>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
                  >
                    {t.label}
                  </p>
                </div>

                {t.badge && (
                  <span
                    className="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: 'var(--ts-semantic-color-background-primary-default)', color: '#fff' }}
                  >
                    <Icon name="lightbulb" size={12} color="#fff" />
                    {t.badge}
                  </span>
                )}

                <dl className="mt-4 space-y-3">
                  <div>
                    <dt
                      className="text-[11px] font-medium uppercase tracking-wider"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                    >
                      Venta
                    </dt>
                    <Skeleton className="mt-1 h-6 w-24" />
                  </div>
                  <div>
                    <dt
                      className="text-[11px] font-medium uppercase tracking-wider"
                      style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
                    >
                      Nº clientes
                    </dt>
                    <Skeleton className={`mt-1 h-5 ${i === 0 ? 'w-28' : i === 1 ? 'w-20' : 'w-16'}`} />
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pareto de ventas por división — donut decorativo sin datos */}
      <section>
        <div
          className="rounded-lg border p-6"
          style={{
            background: 'var(--ts-semantic-color-surface-default)',
            borderColor: 'var(--ts-semantic-color-border-base-default)',
          }}
        >
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
          >
            Pareto de ventas por división
          </h2>
          <p
            className="mt-0.5 text-xs"
            style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
          >
            ¿Cuántos clientes concentran el 80% de la facturación de cada división?
          </p>

          <div className="mt-4 flex flex-col items-center gap-6 lg:flex-row">
            <MockDonut />
            <ul className="w-full min-w-0 space-y-3">
              {DIVISIONS.map((name, i) => (
                <li key={name} className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm opacity-40"
                    style={{ background: DONUT_SEGMENTS[i]!.color }}
                    aria-hidden
                  />
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}
                  >
                    {name}
                  </span>
                  <Skeleton className="h-3.5 w-28" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Barra placeholder con pulso suave — comunica "aquí irá la cifra". */
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      className={`block animate-pulse rounded ${className}`}
      style={{ background: 'var(--ts-semantic-color-background-neutral-subtle-default)' }}
      aria-hidden
    />
  );
}

/** Filtro de compañía mockeado: comunica "general a nivel grupo, filtrable" sin lógica real. */
function MockFilter() {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
      style={{
        background: 'var(--ts-semantic-color-surface-default)',
        borderColor: 'var(--ts-semantic-color-border-base-default)',
      }}
    >
      <Icon name="business" size={16} color="var(--ts-semantic-color-icon-secondary-default)" />
      <span style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>Compañía:</span>
      <span className="font-medium" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
        Grupo (todas)
      </span>
      <Icon name="expand_more" size={18} color="var(--ts-semantic-color-icon-secondary-default)" />
    </span>
  );
}

/** Donut SVG estático del Pareto (técnica stroke-dasharray sobre circunferencia 100). */
function MockDonut() {
  // Desfase acumulado de cada segmento (parte a las 12 en punto = 25), calculado
  // de forma pura para no reasignar variables durante el render.
  const offsets = DONUT_SEGMENTS.map(
    (_, i) => 25 - DONUT_SEGMENTS.slice(0, i).reduce((sum, seg) => sum + seg.value, 0)
  );
  return (
    <div className="shrink-0">
      <svg width="240" height="240" viewBox="0 0 42 42" role="img" aria-label="Gráfico ilustrativo sin datos">
        {DONUT_SEGMENTS.map((s, i) => (
          <circle
            key={i}
            cx="21" cy="21" r="15.91549430918954"
            fill="transparent"
            stroke={s.color}
            strokeOpacity="0.4"
            strokeWidth="6"
            strokeDasharray={`${s.value - 1.5} ${100 - s.value + 1.5}`}
            strokeDashoffset={offsets[i]}
          />
        ))}
      </svg>
    </div>
  );
}
