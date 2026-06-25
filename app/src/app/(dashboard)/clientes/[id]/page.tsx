/**
 * Ficha de cliente / organización — vista 360 del Golden Record.
 *
 * Por defecto agrega todos los registros SAP del mismo CIF (vista de ORGANIZACIÓN).
 * Con `?sap=1` (o si el registro no tiene organización) muestra un único registro SAP.
 *
 * Secciones: Header (con popup de registros SAP unificados si agrega) · Whitespots ·
 *            Direcciones · Contactos (CRM + gestor + titular, unificados y deduplicados) ·
 *            Facturación (tabla de facturas plegada por defecto).
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getEntityContext,
  getCustomerAddresses,
  getUnifiedContacts,
  getBillingByYear,
  getBillingByBu,
  getWhiteSpots,
  getCustomerBillings,
} from '@/lib/queries/customer-detail';
import { BillingTimeline } from '@/components/cliente/billing-timeline';
import { BillingsTable } from '@/components/cliente/billings-table';
import { CollapsibleInvoices } from '@/components/cliente/collapsible-invoices';
import { CollapsibleSection } from '@/components/cliente/collapsible-section';
import { ContactsTable } from '@/components/cliente/contacts-table';
import { SapRecordsChip } from '@/components/cliente/sap-records-popup';
import { WhitespotsMap } from '@/components/cliente/whitespots-map';
import { Icon } from '@/components/ui/icon';
import { formatNumber } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getEntityContext(Number(id));
  return { title: ctx ? `${ctx.legalName} | Focus` : 'Cliente | Focus' };
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; page?: string; sap?: string; from?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();

  const forceSap = sp.sap === '1';
  const yearFilter = sp.year ? Number(sp.year) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  // ─── RLS: alcance de BU del usuario ───
  const session = await getServerSession(authOptions);
  const userBuIds = session?.user?.buIds ?? [];
  const totalBus = await prisma.businessUnit.count();
  const isGlobal = totalBus > 0 && userBuIds.length >= totalBus;
  const scope = isGlobal ? undefined : userBuIds;

  const ctx = await getEntityContext(customerId, forceSap);
  if (!ctx) notFound();
  const ids = ctx.customerIds;

  const [
    addresses,
    contacts,
    billingByYear,
    billingByBu,
    whiteSpots,
    billings,
  ] = await Promise.all([
    getCustomerAddresses(ids),
    getUnifiedContacts(ids, ctx.orgId),
    getBillingByYear(ids, scope),
    getBillingByBu(ids, scope),
    getWhiteSpots(ids, scope),
    getCustomerBillings({ customerIds: ids, year: yearFilter, page, pageSize: 20, buIds: scope }),
  ]);

  // RLS: si el usuario no es global y la entidad no factura en ninguna de sus BU → 404.
  if (!isGlobal && billingByBu.length === 0) notFound();

  const basePath = `/clientes/${customerId}`;
  const isFromOportunidades = sp.from === 'oportunidades';
  const backHref = isFromOportunidades ? '/oportunidades' : '/clientes';
  const backLabel = isFromOportunidades ? 'Volver a oportunidades' : 'Volver al buscador';

  const combinedBus = [
    ...billingByBu.map(b => ({ ...b, isActive: true })),
    ...whiteSpots.map(w => ({ ...w, total: 0, count: 0, isActive: false }))
  ];

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm transition-colors hover:underline"
        style={{ color: 'var(--ts-semantic-color-text-link-default)' }}
      >
        <Icon name="arrow_back" size={18} />
        {backLabel}
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
          >
            {ctx.legalName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <InfoChip icon="badge" label="CIF" value={ctx.taxId || '—'} />
            {ctx.isOrg ? (
              <SapRecordsChip records={ctx.records} />
            ) : (
              ctx.records[0]?.sapCustomerCode && (
                <InfoChip icon="qr_code_2" label="SAP" value={ctx.records[0].sapCustomerCode} />
              )
            )}
            {ctx.phone && <InfoChip icon="phone" label="Tel." value={ctx.phone} />}
            {ctx.industryCode && <InfoChip icon="domain" label="Industry" value={ctx.industryCode} />}
            {ctx.isBlocked && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase"
                style={{
                  background: 'var(--ts-semantic-color-background-danger-subtle-default)',
                  color: 'var(--ts-semantic-color-text-danger-default)',
                }}
              >
                <Icon name="block" size={12} />
                BLOCKED
              </span>
            )}
          </div>
        </div>
        {/* Vuelta a la vista de organización cuando se está en un registro SAP individual.
            (El camino de ida es el popup del chip "N registros SAP" de la cabecera.) */}
        {forceSap ? (
          <Link
            href={basePath}
            className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:underline"
            style={{ borderColor: 'var(--ts-semantic-color-border-base-default)', color: 'var(--ts-semantic-color-text-link-default)' }}
          >
            Ver organización completa
          </Link>
        ) : null}
      </header>

      {/* Whitespots — agrupado por empresa (arriba: es la foto comercial de la entidad) */}
      <CollapsibleSection title="Whitespots" count={combinedBus.length} icon="dashboard">
        {combinedBus.length === 0 ? (
          <Empty>El cliente no tiene BUs disponibles.</Empty>
        ) : (
          <WhitespotsMap items={combinedBus} />
        )}
      </CollapsibleSection>

      {/* Direcciones */}
      <Section title="Direcciones" count={addresses.length} icon="location_on">
        {addresses.length === 0 ? (
          <Empty>No hay direcciones registradas.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {addresses.map(a => (
              <div
                key={a.addressId}
                className="rounded-lg border p-4"
                style={{
                  background: 'var(--ts-semantic-color-surface-default)',
                  borderColor: 'var(--ts-semantic-color-border-base-default)',
                }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
                  {a.fullAddress}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
                  {[a.postalCode, a.city, a.province].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Contactos unificados: CRM + gestor + titular, deduplicados por persona */}
      <Section
        title="Contactos"
        count={contacts.length}
        icon="contacts"
      >
        {contacts.length === 0 ? (
          <Empty>No hay contactos vinculados.</Empty>
        ) : (
          <ContactsTable contacts={contacts} />
        )}
      </Section>

      {/* Facturación — tabla de facturas plegada por defecto */}
      <Section title="Facturación" icon="payments">
        <div className="space-y-6">
          <BillingTimeline data={billingByYear} activeYear={yearFilter} basePath={basePath} />
          <CollapsibleInvoices
            label={yearFilter
              ? `Facturas de ${yearFilter} (${formatNumber(billings.total)})`
              : `Todas las facturas (${formatNumber(billings.total)})`}
            defaultOpen={!!yearFilter || page > 1}
          >
            <BillingsTable
              rows={billings.rows}
              total={billings.total}
              page={billings.page}
              pageSize={billings.pageSize}
            />
          </CollapsibleInvoices>
        </div>
      </Section>
    </div>
  );
}

// ───── Helpers locales ─────

function Section({
  title, icon, count, subtitle, children,
}: {
  title: string;
  icon: string;
  count?: number;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3 flex items-baseline gap-2">
        <Icon name={icon} size={20} color="var(--ts-semantic-color-icon-primary-default)" />
        <h2
          className="text-lg font-semibold"
          style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}
        >
          {title}
          {count != null && (
            <span
              className="ml-2 text-sm font-normal"
              style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}
            >
              ({count})
            </span>
          )}
        </h2>
        {subtitle && (
          <span className="ml-2 text-xs" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>
            {subtitle}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
      <Icon name={icon} size={16} />
      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--ts-semantic-color-text-tertiary-default)' }}>{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg border-2 border-dashed py-8 text-center text-sm"
      style={{
        borderColor: 'var(--ts-semantic-color-border-base-default)',
        color: 'var(--ts-semantic-color-text-tertiary-default)',
      }}
    >
      {children}
    </div>
  );
}

