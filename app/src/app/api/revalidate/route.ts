/**
 * Refresco de caché. Llamar tras re-seedear para invalidar las agregaciones
 * cacheadas (dashboard, segmentación, top, catálogo, buscador) al instante.
 *
 *   POST /api/revalidate     → revalida el tag 'billing'
 *
 * Autorización (dos vías):
 *   1. Sesión con permiso IAM_MANAGE (uso desde la app).
 *   2. Cabecera `x-revalidate-secret` que coincida con REVALIDATE_SECRET (uso desde
 *      scripts/CI tras un re-seed, sin sesión). Si la env var no está definida, esta
 *      vía queda deshabilitada. La comparación es en tiempo constante (CWE-208).
 */
import { revalidateTag } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { BILLING_TAG } from '@/lib/cache';
import { recordAuditEvent, clientInfoFromRequest } from '@/lib/audit';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

/** Comparación de cadenas en tiempo constante (evita timing oracle sobre el secreto). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const headerSecret = req.headers.get('x-revalidate-secret');
  const bySecret = !!secret && !!headerSecret && safeEqual(headerSecret, secret);

  if (!bySecret) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    // Solo administradores (IAM_MANAGE) pueden forzar la revalidación desde la app.
    if (!session.user.permissions?.includes('IAM_MANAGE')) {
      await recordAuditEvent({
        eventType: 'AUTHZ_DENIED',
        userId: session.user.id ? Number(session.user.id) : null,
        username: session.user.email ?? session.user.name ?? 'desconocido',
        userFullName: session.user.name ?? null,
        outcome: 'FAILURE',
        description: 'Intento de revalidar la caché sin permiso IAM_MANAGE',
        targetType: 'ROUTE',
        targetId: '/api/revalidate',
        ...clientInfoFromRequest(req),
      });
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
  }

  // Next 16: revalidateTag exige un 2º argumento. 'max' = stale-while-revalidate
  // (sirve lo cacheado y refresca en segundo plano en la siguiente visita). Si se
  // necesitara invalidación dura e inmediata, migrar a updateTag.
  revalidateTag(BILLING_TAG, 'max');
  return Response.json({ ok: true, revalidated: BILLING_TAG, at: new Date().toISOString() });
}
