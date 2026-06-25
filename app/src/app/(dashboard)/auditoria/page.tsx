/**
 * Registro de actividad (auditoría) — solo administradores (IAM_MANAGE).
 *
 * Vista de solo lectura del log AUDIT_EVENTS. Los filtros y la página viven en la
 * URL (?username=&category=&event=&outcome=&from=&to=&q=&page=) para que sea
 * linkable, igual que el Buscador 360.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  searchAuditEvents, getAuditFilterUsers, AUDIT_PAGE_SIZE, type AuditSearchOpts,
} from '@/lib/queries/audit';
import { recordAuditEvent, clientInfoFromHeaders } from '@/lib/audit';
import { AuditLogPanel } from '@/components/auditoria/audit-log-panel';

export const metadata = { title: 'Registro de actividad | Focus' };
export const dynamic = 'force-dynamic';

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes('IAM_MANAGE')) {
    if (session?.user) {
      await recordAuditEvent({
        eventType: 'AUTHZ_DENIED',
        userId: session.user.id ? Number(session.user.id) : null,
        username: session.user.email ?? session.user.name ?? 'desconocido',
        userFullName: session.user.name ?? null,
        outcome: 'FAILURE',
        description: 'Intento de abrir /auditoria sin permiso IAM_MANAGE',
        targetType: 'PAGE',
        targetId: '/auditoria',
        ...(await clientInfoFromHeaders()),
      });
    }
    redirect('/dashboard');
  }

  const sp = await searchParams;
  const pageRaw = Number(first(sp.page));
  const opts: AuditSearchOpts = {
    username: first(sp.username) || undefined,
    category: first(sp.category) || undefined,
    eventType: first(sp.event) || undefined,
    outcome: first(sp.outcome) || undefined,
    dateFrom: first(sp.from) || undefined,
    dateTo: first(sp.to) || undefined,
    q: first(sp.q) || undefined,
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
    pageSize: AUDIT_PAGE_SIZE,
  };

  const [result, users] = await Promise.all([
    searchAuditEvents(opts),
    getAuditFilterUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--ts-semantic-color-text-primary-default)' }}>
          Registro de actividad
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--ts-semantic-color-text-secondary-default)' }}>
          Auditoría de acciones de los usuarios: inicios y cierres de sesión (incl. intentos fallidos),
          exportaciones a CSV y administración de accesos.
        </p>
      </div>

      <AuditLogPanel
        key={[opts.username, opts.category, opts.eventType, opts.outcome, opts.dateFrom, opts.dateTo, opts.q].join('|')}
        result={result}
        users={users}
        filters={{
          username: opts.username ?? '',
          category: opts.category ?? '',
          eventType: opts.eventType ?? '',
          outcome: opts.outcome ?? '',
          dateFrom: opts.dateFrom ?? '',
          dateTo: opts.dateTo ?? '',
          q: opts.q ?? '',
        }}
      />
    </div>
  );
}
