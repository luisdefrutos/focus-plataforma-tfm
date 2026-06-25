/**
 * Dashboard ejecutivo — ciclo de vida de la cartera + Pareto de ventas.
 *
 * KPIs a nivel de ORGANIZACIÓN (golden record por CIF), no de registro SAP.
 * Todo se calcula como FOTO A CIERRE del último año completo (refYear): el año en
 * curso es parcial y no computa (generaría falsos "no fieles"/"perdidos" a mitad de año).
 *   · Fieles        → facturan todos los años de la ventana móvil [refYear-3 .. refYear].
 *   · Nuevos        → primera factura de su historia en refYear.
 *   · Recuperados   → compraron en el pasado, fallaron refYear-1, volvieron en refYear.
 *   · Perdidos TSI  → facturaron en TÜV LFD Iberia (9999) pero no en refYear.
 *   · Perdidos MOI  → ídem en la división Mobility.
 *   · Perdidos TSA  → próx. inspección INSPECCION_SA vencida a cierre de refYear sin facturación
 *                     TSA posterior (hasta ese cierre).
 *
 * RSC: queries Prisma directas en el servidor; el donut Recharts es client component.
 */

import { KpiCard } from '@/components/ui/kpi-card';
import { DashboardMockup } from '@/components/dashboard/dashboard-mockup';
import { ParetoDivisionDonut } from '@/components/charts/pareto-division-donut';
import {
  getCustomerLifecycle,
  getLostCustomers,
  getLostTsaCustomers,
  getParetoByDivision,
} from '@/lib/queries/dashboard';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const metadata = { title: 'Dashboard | Focus' };
export const dynamic = 'force-dynamic';

/**
 * Modo presentación (alta dirección): muestra el mock-up ejecutivo —
 * misma estructura, sin cifras y sin ejecutar queries. Poner a false
 * para reactivar el dashboard real con datos.
 */
const PRESENTATION_MOCKUP = false;

export default async function DashboardPage() {
  if (PRESENTATION_MOCKUP) return <DashboardMockup />;

  const session = await getServerSession(authOptions);
  const buIds = session?.user?.buIds || [];

  const [lifecycle, lostTsi, lostMoi, lostTsa, pareto] = await Promise.all([
    getCustomerLifecycle(buIds),
    getLostCustomers(buIds, { entitySapCode: '9999' }),
    getLostCustomers(buIds, { divisionCode: 'MO' }),
    getLostTsaCustomers(buIds),
    getParetoByDivision(buIds),
  ]);

  const { year, loyalFromYear, fieles, nuevos, recuperados } = lifecycle;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          
          
        >
          Dashboard
        </h1>
        <p
          
          className="mt-1 text-sm text-muted-foreground"
        >
          Ciclo de vida de la cartera a nivel de organización (CIF) · foto a cierre de {year} (el año en curso no computa)
        </p>
      </div>

      {/* Ciclo de vida del cliente */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          label="Clientes fieles"
          value={formatNumber(fieles.count)}
          icon="loyalty"
          tone="success"
          hint={`${formatCurrency(fieles.amount, { compact: true })} en ${year} · facturan cada año desde ${loyalFromYear}`}
        />
        <KpiCard
          label="Clientes nuevos"
          value={formatNumber(nuevos.count)}
          icon="person_add"
          tone="primary"
          hint={`${formatCurrency(nuevos.amount, { compact: true })} en ${year} · primera compra en ${year}`}
        />
        <KpiCard
          label="Clientes recuperados"
          value={formatNumber(recuperados.count)}
          icon="autorenew"
          tone="primary"
          hint={`${formatCurrency(recuperados.amount, { compact: true })} en ${year} · volvieron tras fallar ${year - 1}`}
        />
        <KpiCard
          label="Clientes perdidos TSI"
          value={formatNumber(lostTsi.count)}
          icon="person_off"
          tone="danger"
          hint={`${formatCurrency(lostTsi.amount, { compact: true })} en su último año activo · TÜV LFD Iberia`}
        />
        <KpiCard
          label="Clientes perdidos MOI"
          value={formatNumber(lostMoi.count)}
          icon="person_off"
          tone="danger"
          hint={`${formatCurrency(lostMoi.amount, { compact: true })} en su último año activo · división Mobility`}
        />
        <KpiCard
          label="Clientes perdidos TSA"
          value={formatNumber(lostTsa.count)}
          icon="event_busy"
          tone="danger"
          hint={`${formatCurrency(lostTsa.amount, { compact: true })} en su último año activo · próx. inspección vencida sin facturar después`}
        />
      </section>

      {/* Pareto de ventas */}
      <section>
        <ChartCard
          title={`Pareto de ventas por división · ${pareto.year}`}
          subtitle="Cuántos clientes concentran el 80% de la facturación del último año cerrado"
        >
          <ParetoDivisionDonut divisions={pareto.divisions} />
        </ChartCard>
      </section>
    </div>
  );
}

// ───── Wrapper de tarjeta de gráfico ─────
function ChartCard({
  title, subtitle, children, className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border bg-card text-card-foreground p-6 ${className}`}
    >
      <div>
        <h2 className="text-base font-semibold text-[#002554]">
          {title}
        </h2>
        {subtitle && (
          <p
            
            className="mt-0.5 text-xs text-muted-foreground"
          >
            {subtitle}
          </p>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
