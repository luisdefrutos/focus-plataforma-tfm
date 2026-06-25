/**
 * Export CSV del registro de auditoría. Solo administradores (IAM_MANAGE). Aplica
 * los mismos filtros que la pantalla /auditoria y vuelca el log en streaming.
 * La propia exportación queda registrada (EXPORT_AUDITORIA).
 */

import { NextRequest, after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuditEventsChunk, type AuditSearchOpts } from '@/lib/queries/audit';
import { getEventLabel, getEventMeta, AUDIT_CATEGORY_LABELS, type AuditCategory } from '@/lib/audit-events';
import { recordAuditEvent, clientInfoFromRequest } from '@/lib/audit';
import { csvCell } from '@/lib/csv';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_EXPORT_ROWS = 100_000;
const CHUNK = 5_000;

const DT = new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'medium' });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.permissions?.includes('IAM_MANAGE')) {
    // Registrar el intento de acceso denegado de un usuario autenticado (CWE-778).
    if (session?.user) {
      after(() => recordAuditEvent({
        eventType: 'AUTHZ_DENIED',
        userId: session.user.id ? Number(session.user.id) : null,
        username: session.user.email ?? session.user.name ?? 'desconocido',
        userFullName: session.user.name ?? null,
        outcome: 'FAILURE',
        description: 'Intento de exportar el registro de auditoría sin permiso IAM_MANAGE',
        targetType: 'ROUTE', targetId: '/api/auditoria/export',
        ...clientInfoFromRequest(req),
      }));
    }
    return new Response('No autorizado', { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const opts: AuditSearchOpts = {
    username: sp.get('username') || undefined,
    category: sp.get('category') || undefined,
    eventType: sp.get('event') || undefined,
    outcome: sp.get('outcome') || undefined,
    dateFrom: sp.get('from') || undefined,
    dateTo: sp.get('to') || undefined,
    q: sp.get('q') || undefined,
  };

  const header = [
    'fecha_hora', 'usuario', 'nombre', 'evento', 'categoria', 'resultado',
    'descripcion', 'destino', 'ip', 'user_agent', 'metadata',
  ].join(';');

  // Auditar la propia exportación del registro (tras enviar la respuesta).
  const actor = {
    userId: session.user.id ? Number(session.user.id) : null,
    username: session.user.email ?? session.user.name ?? 'desconocido',
    userFullName: session.user.name ?? null,
  };
  const reexportOf = sp.get('reexportOf');
  after(() =>
    recordAuditEvent({
      eventType: 'EXPORT_AUDITORIA',
      ...actor,
      metadata: {
        filters: Object.fromEntries([...sp.entries()].filter(([k]) => k !== 'reexportOf')),
        ...(reexportOf && /^\d+$/.test(reexportOf) ? { reexportOf: Number(reexportOf) } : {}),
      },
      ...clientInfoFromRequest(req),
    })
  );

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(new TextEncoder().encode(String.fromCharCode(0xfeff) + header + '\r\n'));

      let skip = 0;
      while (skip < MAX_EXPORT_ROWS) {
        const take = Math.min(CHUNK, MAX_EXPORT_ROWS - skip);
        const chunk = await getAuditEventsChunk(opts, skip, take);
        if (chunk.length === 0) break;

        const lines = chunk.map(r => {
          const meta = getEventMeta(r.eventType);
          const category = (meta?.category ?? r.category) as AuditCategory;
          return [
            DT.format(r.createdAt),
            r.username,
            r.userFullName ?? '',
            getEventLabel(r.eventType),
            AUDIT_CATEGORY_LABELS[category] ?? r.category,
            r.outcome === 'FAILURE' ? 'Fallo' : 'Éxito',
            r.description,
            r.targetId ? `${r.targetType ? r.targetType + ': ' : ''}${r.targetId}` : '',
            r.ipAddress ?? '',
            r.userAgent ?? '',
            r.metadata == null ? '' : JSON.stringify(r.metadata),
          ].map(csvCell).join(';');
        });
        controller.enqueue(new TextEncoder().encode(lines.join('\r\n') + '\r\n'));

        if (chunk.length < take) break;
        skip += chunk.length;
      }
      controller.close();
    },
  });

  const ts = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="auditoria-${ts}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
