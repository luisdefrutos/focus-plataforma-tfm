/**
 * Logger de auditoría — escribe eventos en AUDIT_EVENTS.
 *
 * Regla de oro: NUNCA lanza. La auditoría es un efecto secundario y jamás debe
 * romper la acción que la origina (login, exportación, alta de usuario…). Cualquier
 * error se captura y se loguea en consola.
 *
 * Server-only: importa `prisma` y, en algunos helpers, `next/headers`.
 */

import { prisma } from './prisma';
import { getEventMeta, type AuditCategory, type AuditEventType, type AuditOutcome } from './audit-events';

export type ClientInfo = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RecordAuditInput = {
  eventType: AuditEventType;
  /** Id del AppUser cuando se conoce (null en logins fallidos de usuarios inexistentes). */
  userId?: number | null;
  username: string;
  userFullName?: string | null;
  outcome?: AuditOutcome;
  /** Resumen legible. Si se omite, se usa la etiqueta del catálogo. */
  description?: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function truncate(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Saneado de campos de texto que se almacenan/exportan: elimina saltos de línea y
 * caracteres de control (anti log-forging, CWE-117) antes de recortar a la longitud
 * de columna. Campos como `username`/`user_agent` pueden venir de un atacante.
 */
function sanitize(s: string | null | undefined, max: number): string | null {
  if (s == null) return null;
  const clean = Array.from(s, ch => { const n = ch.charCodeAt(0); return n < 32 || n === 127 ? ' ' : ch; }).join('').replace(/ +/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) : clean;
}

/**
 * IP del cliente a partir de `x-forwarded-for`, respetando el nº de proxies de
 * confianza (`TRUSTED_PROXY_HOPS`, por defecto 1): se toma el salto situado a
 * `hops` posiciones desde la DERECHA — el que vio el proxy de confianza más externo.
 * Tomar el primero (izquierda) sería el valor que el cliente puede falsificar
 * (CWE-348). El proxy del borde DEBE sobrescribir cualquier XFF entrante.
 */
function clientIpFromXff(xff?: string | null): string | null {
  if (!xff) return null;
  const list = xff.split(',').map(s => s.trim()).filter(Boolean);
  if (list.length === 0) return null;
  const raw = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  const hops = Number.isInteger(raw) && raw > 0 ? raw : 1;
  const idx = list.length - hops;
  return list[idx >= 0 ? idx : 0] || null;
}

/**
 * Normaliza la IP a una forma legible: las IPv6 "mapeadas" de IPv4
 * (`::ffff:1.2.3.4`) se reducen a la IPv4, y el loopback IPv6 (`::1`) se muestra
 * como `127.0.0.1`. En local siempre será loopback; en producción, detrás del
 * proxy inverso, `x-forwarded-for` traerá la IP real del cliente.
 */
function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null;
  let s = ip.trim();
  if (!s) return null;
  const mapped = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) s = mapped[1];
  if (s === '::1') s = '127.0.0.1';
  return s;
}

/**
 * Registra un evento de auditoría. Resuelve categoría y etiqueta del catálogo.
 * "Fire and forget" seguro: captura cualquier error y lo loguea sin propagarlo.
 */
export async function recordAuditEvent(input: RecordAuditInput): Promise<void> {
  try {
    const meta = getEventMeta(input.eventType);
    const category: AuditCategory = meta?.category ?? 'AUTH';
    const description = sanitize(input.description ?? meta?.label ?? input.eventType, 500) ?? input.eventType;

    await prisma.auditEvent.create({
      data: {
        userId: input.userId ?? null,
        username: sanitize(input.username, 128) || 'desconocido',
        userFullName: sanitize(input.userFullName, 255),
        eventType: input.eventType,
        category,
        outcome: input.outcome ?? 'SUCCESS',
        description,
        targetType: sanitize(input.targetType, 32),
        targetId: sanitize(input.targetId, 64),
        metadata: (input.metadata ?? undefined) as never,
        ipAddress: truncate(input.ipAddress, 64),
        userAgent: sanitize(input.userAgent, 512),
      },
    });
  } catch (err) {
    // La auditoría nunca debe tumbar la acción que la origina, PERO un fallo al
    // registrar un evento de seguridad debe ser visible para la monitorización:
    // log estructurado de severidad alta (capturable por el agregador de logs).
    console.error(JSON.stringify({
      level: 'error',
      msg: 'audit_write_failed',
      eventType: input.eventType,
      outcome: input.outcome ?? 'SUCCESS',
      error: err instanceof Error ? err.message : String(err),
    }));
  }
}

/** Extrae IP y user-agent de una Request/NextRequest (route handlers). */
export function clientInfoFromRequest(req: { headers: Headers }): ClientInfo {
  const h = req.headers;
  return {
    ipAddress: normalizeIp(clientIpFromXff(h.get('x-forwarded-for')) ?? h.get('x-real-ip')),
    userAgent: h.get('user-agent'),
  };
}

/**
 * Extrae IP/UA del `req` que NextAuth pasa a `authorize()`, donde `headers` es un
 * objeto plano (estilo IncomingHttpHeaders, claves en minúscula), no un `Headers`.
 */
export function clientInfoFromNextAuthReq(req: unknown): ClientInfo {
  const headers = (req as { headers?: Record<string, string | string[] | undefined> } | undefined)?.headers;
  if (!headers) return {};
  const get = (k: string): string | undefined => {
    const v = headers[k] ?? headers[k.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    ipAddress: normalizeIp(clientIpFromXff(get('x-forwarded-for')) ?? get('x-real-ip')),
    userAgent: get('user-agent') ?? null,
  };
}

/**
 * Extrae IP/UA desde `headers()` de `next/headers` (Server Actions / RSC). Import
 * dinámico para no acoplar este módulo a un contexto de request cuando se usa el
 * logger desde otros sitios (p.ej. el callback de NextAuth).
 */
export async function clientInfoFromHeaders(): Promise<ClientInfo> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    return {
      ipAddress: normalizeIp(clientIpFromXff(h.get('x-forwarded-for')) ?? h.get('x-real-ip')),
      userAgent: h.get('user-agent'),
    };
  } catch {
    return {};
  }
}
